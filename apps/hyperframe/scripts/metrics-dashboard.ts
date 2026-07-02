import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatBytes } from "./lib/telemetry";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const defaultLedgerPath = path.resolve(scriptDir, "..", ".metrics", "runs.ndjson");

interface LedgerRecord {
  episode?: string;
  slug?: string;
  ts?: string;
  format?: string;
  variant?: string;
  totalMs?: number;
  stages?: Record<string, unknown>;
  assets?: { fileCount?: number; totalBytes?: number };
}

interface Stats {
  p50: number | null;
  p95: number | null;
}

interface EpisodeGroup {
  episode: string;
  runs: LedgerRecord[];
  stageKeys: string[];
  totalStats: Stats;
  stageStats: Record<string, Stats>;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const formatMs = (ms: number): string => {
  if (!Number.isFinite(ms)) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
};

export const parseLedger = (
  raw: string,
  { warn = (): void => {} }: { warn?: (message: string) => void } = {},
): LedgerRecord[] => {
  const records: LedgerRecord[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (line.trim() === "") continue;
    try {
      const record = JSON.parse(line) as unknown;
      if (record && typeof record === "object") records.push(record as LedgerRecord);
    } catch (error) {
      warn(`Skipping malformed ledger line ${index + 1}: ${(error as Error).message}`);
    }
  }
  return records;
};

export const readLedger = async (
  ledgerPath = defaultLedgerPath,
  { warn = console.warn }: { warn?: (message: string) => void } = {},
): Promise<LedgerRecord[]> => {
  try {
    return parseLedger(await readFile(ledgerPath, "utf8"), { warn });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw error;
  }
};

export const percentile = (values: number[], p: number): number | null => {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? null;
};

const statsFor = (values: number[]): Stats => ({
  p50: percentile(values, 50),
  p95: percentile(values, 95),
});

export const groupByEpisode = (
  records: LedgerRecord[],
  { limit = 30 }: { limit?: number } = {},
): EpisodeGroup[] => {
  const groups = new Map<string, LedgerRecord[]>();
  for (const record of records) {
    const episode = record.episode ?? record.slug ?? "unknown";
    const list = groups.get(episode) ?? [];
    if (!groups.has(episode)) groups.set(episode, list);
    list.push({ ...record, episode });
  }

  return [...groups.entries()]
    .map(([episode, runs]): EpisodeGroup => {
      const window = runs
        .toSorted((a, b) => String(a.ts ?? "").localeCompare(String(b.ts ?? "")))
        .slice(-limit);
      const stageKeys = [...new Set(window.flatMap((run) => Object.keys(run.stages ?? {})))].sort();
      const stageStats: Record<string, Stats> = Object.fromEntries(
        stageKeys.map((stage): [string, Stats] => [
          stage,
          statsFor(window.map((run) => Number(run.stages?.[stage]))),
        ]),
      );
      return {
        episode,
        runs: window,
        stageKeys,
        totalStats: statsFor(window.map((run) => Number(run.totalMs))),
        stageStats,
      };
    })
    .sort((a, b) => a.episode.localeCompare(b.episode));
};

export const sparklineSvg = (
  values: number[],
  { width = 220, height = 48 }: { width?: number; height?: number } = {},
): string => {
  const nums = values.filter(Number.isFinite);
  if (nums.length === 0)
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="No data"></svg>`;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = nums.length > 1 ? width / (nums.length - 1) : width;
  const points = nums.map((value, index) => {
    const x = nums.length > 1 ? index * step : width / 2;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Total milliseconds sparkline"><polyline points="${points.join(" ")}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};

const renderStats = (group: EpisodeGroup): string => {
  const rows = [
    `<tr><th>Total</th><td>${formatMs(group.totalStats.p50 as number)}</td><td>${formatMs(group.totalStats.p95 as number)}</td></tr>`,
    ...group.stageKeys.map(
      (stage) =>
        `<tr><th>${escapeHtml(stage)}</th><td>${formatMs(group.stageStats[stage]?.p50 as number)}</td><td>${formatMs(group.stageStats[stage]?.p95 as number)}</td></tr>`,
    ),
  ];
  return `<table class="stats"><thead><tr><th>Metric</th><th>p50</th><th>p95</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
};

const renderRuns = (group: EpisodeGroup): string => {
  const rows = group.runs
    .toReversed()
    .map((run) => {
      const stages = group.stageKeys
        .map(
          (stage) =>
            `<span><b>${escapeHtml(stage)}</b> ${formatMs(Number(run.stages?.[stage]))}</span>`,
        )
        .join("");
      return `<tr><td>${escapeHtml(run.ts ?? "—")}</td><td>${escapeHtml(run.format ?? "—")}</td><td>${escapeHtml(run.variant ?? "—")}</td><td>${formatMs(Number(run.totalMs))}</td><td>${Number(run.assets?.fileCount ?? 0)}</td><td>${formatBytes(Number(run.assets?.totalBytes ?? 0))}</td><td class="stages">${stages}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>Timestamp</th><th>Format</th><th>Variant</th><th>Total</th><th>Assets</th><th>Bytes</th><th>Stages</th></tr></thead><tbody>${rows}</tbody></table>`;
};

export const renderDashboard = (groups: EpisodeGroup[]): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Render telemetry dashboard</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0d1117; color: #e6edf3; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
    h1 { margin: 0 0 8px; font-size: 34px; }
    .muted { color: #8b949e; }
    section { margin-top: 24px; padding: 22px; border: 1px solid #30363d; border-radius: 18px; background: #161b22; }
    .top { display: flex; gap: 20px; justify-content: space-between; align-items: center; flex-wrap: wrap; }
    .spark { color: #7ee787; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #30363d; text-align: left; vertical-align: top; }
    th { color: #8b949e; font-weight: 600; }
    .stats { max-width: 520px; }
    .stages { display: flex; gap: 8px; flex-wrap: wrap; }
    .stages span { padding: 3px 7px; border-radius: 999px; background: #21262d; white-space: nowrap; }
    .empty { margin-top: 28px; padding: 28px; border: 1px dashed #30363d; border-radius: 16px; color: #8b949e; }
  </style>
</head>
<body><main>
  <h1>Render telemetry dashboard</h1>
  <p class="muted">Read-only view of <code>.metrics/runs.ndjson</code>. Showing the last 30 runs per episode.</p>
  ${
    groups.length === 0
      ? '<div class="empty">No render telemetry yet. Run <code>bun run render:episode &lt;slug&gt;</code> to create ledger entries.</div>'
      : groups
          .map(
            (group) =>
              `<section><div class="top"><div><h2>${escapeHtml(group.episode)}</h2><p class="muted">${group.runs.length} run${group.runs.length === 1 ? "" : "s"}</p></div><div class="spark">${sparklineSvg(group.runs.map((run) => Number(run.totalMs)))}</div></div>${renderStats(group)}${renderRuns(group)}</section>`,
          )
          .join("")
  }
</main></body></html>`;

export const createDashboardServer = ({
  ledgerPath = defaultLedgerPath,
  warn = console.warn,
}: {
  ledgerPath?: string;
  warn?: (message: string) => void;
} = {}): http.Server =>
  http.createServer(async (_req, res) => {
    try {
      const records = await readLedger(ledgerPath, { warn });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderDashboard(groupByEpisode(records)));
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`Failed to render dashboard: ${(error as Error).message}`);
    }
  });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(Bun.env.PORT) || 0;
  const server = createDashboardServer({ warn: (message) => console.warn(message) });
  server.listen(port, "127.0.0.1", () => {
    const address = server.address() as import("node:net").AddressInfo;
    console.log(`http://127.0.0.1:${address.port}`);
    console.log("[Ctrl+C to stop]");
  });
}
