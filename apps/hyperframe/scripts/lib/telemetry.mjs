/**
 * Render telemetry — stage timers, asset inventory, NDJSON ledger.
 *
 * Wraps `apps/hyperframe/scripts/render-episode.mjs` boundaries with
 * `performance.now()` timers and persists a one-line summary per run to
 * `apps/hyperframe/.metrics/runs.ndjson`. The dashboard surfacing the
 * ledger is intentionally deferred to a follow-up.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

export const createTimer = () => {
  const stages = new Map();
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
      const out = {};
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

// Walks `dir` recursively and returns the file inventory. Symlinks are
// followed for file content (assets/voice.mp3 lives behind a symlink in the
// working copy), but the walker skips already-visited real paths so a
// pathological loop can't hang the render. Errors on individual files are
// swallowed; the inventory is best-effort observability, not a correctness
// signal.
export const collectAssetInventory = (dir, { topN = 5 } = {}) => {
  const files = [];
  const seen = new Set();
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      let stat;
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
        // Broken symlink — skip.
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

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Show one decimal only when the value has a fractional part below 10.
  // Whole values like 2048B (=2KB) and 4MiB (=4MB) read cleaner as "2KB",
  // not "2.0KB".
  const useDecimal = unit > 0 && value < 10 && Math.round(value * 10) % 10 !== 0;
  const rounded = useDecimal ? value.toFixed(1) : Math.round(value);
  return `${rounded}${units[unit]}`;
};

const formatStageSeconds = (ms) => {
  const s = ms / 1000;
  if (s >= 10) return `${s.toFixed(0)}s`;
  return `${s.toFixed(1)}s`;
};

export const formatSummaryLine = ({ slug, durations, totalMs, totalBytes }) => {
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

export const appendLedger = (ledgerPath, record) => {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);
};

export const buildRecord = ({
  slug,
  format,
  quality,
  fps,
  durations,
  totalMs,
  inventory,
  uploaded,
}) => ({
  ts: new Date().toISOString(),
  slug,
  format,
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
