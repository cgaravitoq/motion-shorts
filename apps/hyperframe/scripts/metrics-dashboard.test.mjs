import { describe, expect, it } from "bun:test";
import { groupByEpisode, parseLedger, percentile, renderDashboard, sparklineSvg } from "./metrics-dashboard.mjs";

const record = (slug, totalMs, stages = {}, ts = "2026-01-01T00:00:00.000Z") =>
  JSON.stringify({
    ts,
    slug,
    format: "mp4",
    variant: "short",
    totalMs,
    stages,
    assets: { fileCount: 2, totalBytes: 2048 },
  });

describe("metrics dashboard helpers", () => {
  it("renders an empty ledger state", () => {
    const groups = groupByEpisode(parseLedger(""));
    expect(groups).toEqual([]);
    expect(renderDashboard(groups)).toContain("No render telemetry yet");
  });

  it("skips malformed ledger lines with a warning", () => {
    const warnings = [];
    const records = parseLedger(`${record("a", 100)}\nnot-json\n${record("b", 200)}`, {
      warn: (message) => warnings.push(message),
    });
    expect(records).toHaveLength(2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("line 2");
  });

  it("groups the last 30 records by episode", () => {
    const raw = Array.from({ length: 32 }, (_, i) =>
      record("alpha", i + 1, { render: i + 1 }, `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`),
    )
      .concat(record("beta", 999, { upload: 3 }))
      .join("\n");
    const groups = groupByEpisode(parseLedger(raw));
    expect(groups.map((group) => group.episode)).toEqual(["alpha", "beta"]);
    expect(groups[0].runs).toHaveLength(30);
    expect(groups[0].runs[0].totalMs).toBe(3);
    expect(groups[0].stageKeys).toEqual(["render"]);
  });

  it("calculates p50 and p95 using nearest-rank percentiles", () => {
    expect(percentile([100, 200, 300, 400], 50)).toBe(200);
    expect(percentile([100, 200, 300, 400], 95)).toBe(400);
    const [group] = groupByEpisode(
      parseLedger([record("alpha", 100, { render: 10 }), record("alpha", 200, { render: 20 }), record("alpha", 300, { render: 30 })].join("\n")),
    );
    expect(group.totalStats).toEqual({ p50: 200, p95: 300 });
    expect(group.stageStats.render).toEqual({ p50: 20, p95: 30 });
  });

  it("generates an inline SVG sparkline polyline", () => {
    const svg = sparklineSvg([100, 200, 150], { width: 100, height: 20 });
    expect(svg).toContain("<svg");
    expect(svg).toContain("<polyline");
    expect(svg).toContain('points="0.0,16.0 50.0,4.0 100.0,10.0"');
  });
});
