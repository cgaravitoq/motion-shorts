import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  appendLedger,
  buildRecord,
  collectAssetInventory,
  createTimer,
  formatBytes,
  formatSummaryLine,
} from "./telemetry";

const setupWorkdir = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "telemetry-"));
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(path.join(root, "index.html"), "x".repeat(2048));
  await writeFile(path.join(root, "assets", "voice.mp3"), Buffer.alloc(8 * 1024));
  await writeFile(path.join(root, "assets", "captions.json"), "[]");
  return root;
};

describe("createTimer", () => {
  it("records monotonically increasing stage durations", async () => {
    const timer = createTimer();
    timer.start("materialise");
    await new Promise((r) => setTimeout(r, 5));
    timer.end("materialise");
    timer.start("render");
    await new Promise((r) => setTimeout(r, 5));
    timer.end("render");
    const durations = timer.durations();
    expect(durations.materialise).toBeGreaterThan(0);
    expect(durations.render).toBeGreaterThan(0);
    expect(timer.totalMs()).toBeGreaterThanOrEqual(durations.materialise + durations.render);
  });

  it("ignores end without matching start", () => {
    const timer = createTimer();
    expect(timer.end("ghost")).toBeNull();
    expect(timer.durations()).toEqual({});
  });
});

describe("collectAssetInventory", () => {
  it("walks recursively and ranks the largest files", async () => {
    const root = await setupWorkdir();
    try {
      const inv = collectAssetInventory(root, { topN: 3 });
      expect(inv.fileCount).toBe(3);
      expect(inv.totalBytes).toBe(2048 + 8 * 1024 + 2);
      expect(inv.topFiles[0].path).toBe(path.join("assets", "voice.mp3"));
      expect(inv.topFiles[0].bytes).toBe(8 * 1024);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns empty inventory for missing directories", () => {
    const inv = collectAssetInventory(path.join(tmpdir(), `nope-${Date.now()}`));
    expect(inv).toEqual({ fileCount: 0, totalBytes: 0, topFiles: [] });
  });
});

describe("formatBytes", () => {
  it("uses MB above 1MiB and KB below", () => {
    expect(formatBytes(0)).toBe("0B");
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(18 * 1024 * 1024)).toBe("18MB");
  });
});

describe("formatSummaryLine", () => {
  it("orders stages and surfaces total + size", () => {
    const line = formatSummaryLine({
      slug: "demo-explainer-blocks",
      durations: { materialise: 1200, render: 38000, upload: 400 },
      totalMs: 42000,
      totalBytes: 18 * 1024 * 1024,
    });
    expect(line).toBe(
      "✓ rendered demo-explainer-blocks in 42s (materialise 1.2s · render 38s · upload 0.4s) · 18MB",
    );
  });

  it("omits stages that never ran", () => {
    const line = formatSummaryLine({
      slug: "no-upload",
      durations: { materialise: 1100, render: 22000 },
      totalMs: 23200,
      totalBytes: 4 * 1024 * 1024,
    });
    expect(line).toBe("✓ rendered no-upload in 23s (materialise 1.1s · render 22s) · 4MB");
  });
});

describe("appendLedger", () => {
  it("creates the directory and appends one JSON line per record", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ledger-"));
    const ledgerPath = path.join(root, ".metrics", "runs.ndjson");
    try {
      const recordA = buildRecord({
        slug: "a",
        format: "mp4",
        quality: "standard",
        fps: 30,
        durations: { materialise: 1100, render: 2200 },
        totalMs: 3400,
        inventory: { fileCount: 1, totalBytes: 100, topFiles: [{ path: "a", bytes: 100 }] },
        uploaded: false,
      });
      const recordB = buildRecord({
        slug: "b",
        format: "mp4",
        quality: "standard",
        fps: 30,
        durations: { materialise: 1200, render: 2400 },
        totalMs: 3700,
        inventory: { fileCount: 0, totalBytes: 0, topFiles: [] },
        uploaded: true,
      });
      appendLedger(ledgerPath, recordA);
      appendLedger(ledgerPath, recordB);
      const raw = await readFile(ledgerPath, "utf8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(2);
      const parsedA = JSON.parse(lines[0]);
      expect(parsedA.slug).toBe("a");
      expect(parsedA.stages.materialise).toBe(1100);
      expect(parsedA.assets.topFiles[0].bytes).toBe(100);
      expect(parsedA.uploaded).toBe(false);
      const parsedB = JSON.parse(lines[1]);
      expect(parsedB.slug).toBe("b");
      expect(parsedB.uploaded).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
