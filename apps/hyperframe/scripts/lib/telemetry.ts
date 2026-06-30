import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

export interface StageTimer {
  start(stage: string): void;
  end(stage: string): number | null;
  durations(): Record<string, number>;
  totalMs(): number;
}

export const createTimer = (): StageTimer => {
  const stages = new Map<string, { startedAt: number; durationMs: number | null }>();
  const t0 = performance.now();
  return {
    start(stage) {
      stages.set(stage, { startedAt: performance.now(), durationMs: null });
    },
    end(stage) {
      const entry = stages.get(stage);
      if (!entry) return null;
      entry.durationMs = performance.now() - entry.startedAt;
      return entry.durationMs;
    },
    durations() {
      const out: Record<string, number> = {};
      for (const [k, v] of stages) {
        if (v.durationMs !== null) out[k] = Number(v.durationMs.toFixed(1));
      }
      return out;
    },
    totalMs() {
      return performance.now() - t0;
    },
  };
};

export interface AssetInventory {
  fileCount: number;
  totalBytes: number;
  topFiles: Array<{ path: string; bytes: number }>;
}

export const collectAssetInventory = (
  dir: string,
  { topN = 5 }: { topN?: number } = {},
): AssetInventory => {
  const files: Array<{ path: string; bytes: number }> = [];
  const seen = new Set<string>();
  const walk = (current: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      try {
        const real = fs.realpathSync(full);
        if (seen.has(real)) continue;
        seen.add(real);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        files.push({ path: path.relative(dir, full), bytes: stat.size });
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  files.sort((a, b) => b.bytes - a.bytes);
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  return {
    fileCount: files.length,
    totalBytes,
    topFiles: files.slice(0, topN),
  };
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const useDecimal = unit > 0 && value < 10 && Math.round(value * 10) % 10 !== 0;
  const rounded = useDecimal ? value.toFixed(1) : Math.round(value);
  return `${rounded}${units[unit]}`;
};

const formatStageSeconds = (ms: number): string => {
  const s = ms / 1000;
  if (s >= 10) return `${s.toFixed(0)}s`;
  return `${s.toFixed(1)}s`;
};

export const formatSummaryLine = ({
  slug,
  durations,
  totalMs,
  totalBytes,
}: {
  slug: string;
  durations: Record<string, number>;
  totalMs: number;
  totalBytes: number;
}): string => {
  const stageOrder = ["materialise", "render", "upload"];
  const parts = [];
  for (const stage of stageOrder) {
    if (durations[stage] !== undefined) {
      parts.push(`${stage} ${formatStageSeconds(durations[stage])}`);
    }
  }
  const breakdown = parts.length > 0 ? ` (${parts.join(" · ")})` : "";
  const total = formatStageSeconds(totalMs);
  return `✓ rendered ${slug} in ${total}${breakdown} · ${formatBytes(totalBytes)}`;
};

export const appendLedger = (ledgerPath: string, record: Record<string, unknown>): void => {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);
};

export interface RenderRecord {
  ts: string;
  slug: string;
  format: string;
  variant: string;
  quality: string;
  fps: number;
  totalMs: number;
  stages: Record<string, number>;
  assets: AssetInventory;
  uploaded: boolean;
}

export const buildRecord = ({
  slug,
  format,
  variant,
  quality,
  fps,
  durations,
  totalMs,
  inventory,
  uploaded,
}: {
  slug: string;
  format: string;
  variant?: string;
  quality: string;
  fps: number;
  durations: Record<string, number>;
  totalMs: number;
  inventory: AssetInventory;
  uploaded: boolean;
}): RenderRecord => ({
  ts: new Date().toISOString(),
  slug,
  format,
  variant: variant ?? "short",
  quality,
  fps,
  totalMs: Number(totalMs.toFixed(1)),
  stages: durations,
  assets: {
    fileCount: inventory.fileCount,
    totalBytes: inventory.totalBytes,
    topFiles: inventory.topFiles,
  },
  uploaded: Boolean(uploaded),
});
