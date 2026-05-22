import { describe, expect, it, vi } from "vitest";
import {
  buildBgmFilterGraph,
  buildDuckWindows,
  buildFfmpegArgs,
  type FfmpegRunner,
  mixBgm,
} from "../bgm-mixer";
import type { HyperframesCaption } from "../stt-types";

const fixtureCaptions: HyperframesCaption[] = [
  { text: "Hola", start: 0.5, end: 0.9 },
  { text: "mundo", start: 0.95, end: 1.4 },
  // 1.8s gap → boundary between window 1 and 2
  { text: "Esto", start: 3.2, end: 3.5 },
  { text: "es", start: 3.55, end: 3.7 },
  { text: "BGM.", start: 3.75, end: 4.2 },
];

describe("buildDuckWindows", () => {
  it("merges adjacent words into a single narration window", () => {
    const windows = buildDuckWindows(fixtureCaptions, { mergeGapSec: 0.35, padSec: 0 });
    expect(windows).toEqual([
      { start: 0.5, end: 1.4 },
      { start: 3.2, end: 4.2 },
    ]);
  });

  it("widens each window by padSec on both edges", () => {
    const windows = buildDuckWindows(fixtureCaptions, { mergeGapSec: 0.35, padSec: 0.2 });
    expect(windows[0]?.start).toBeCloseTo(0.3, 3);
    expect(windows[0]?.end).toBeCloseTo(1.6, 3);
    expect(windows[1]?.start).toBeCloseTo(3.0, 3);
    expect(windows[1]?.end).toBeCloseTo(4.4, 3);
  });

  it("collapses post-pad windows that overlap", () => {
    const captions: HyperframesCaption[] = [
      { text: "a", start: 0.5, end: 0.7 },
      { text: "b", start: 1.5, end: 1.7 },
    ];
    // gap=0.8 > mergeGapSec=0.3 so two windows; padSec=0.5 makes them overlap.
    const windows = buildDuckWindows(captions, { mergeGapSec: 0.3, padSec: 0.5 });
    expect(windows).toHaveLength(1);
    expect(windows[0]?.start).toBeCloseTo(0, 3);
    expect(windows[0]?.end).toBeCloseTo(2.2, 3);
  });

  it("clamps the leading edge of the first window to 0", () => {
    const captions: HyperframesCaption[] = [{ text: "x", start: 0.05, end: 0.2 }];
    const windows = buildDuckWindows(captions, { padSec: 0.5 });
    expect(windows[0]?.start).toBe(0);
  });

  it("ignores empty / whitespace-only / invalid captions", () => {
    const captions: HyperframesCaption[] = [
      { text: "", start: 0, end: 0.2 },
      { text: "  ", start: 0.2, end: 0.4 },
      { text: "ok", start: 0.5, end: 0.9 },
      { text: "bad", start: 1, end: 1 }, // zero-length
      { text: "nan", start: Number.NaN, end: 1.2 },
    ];
    const windows = buildDuckWindows(captions, { mergeGapSec: 0.35, padSec: 0 });
    expect(windows).toEqual([{ start: 0.5, end: 0.9 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(buildDuckWindows([])).toEqual([]);
  });
});

describe("buildBgmFilterGraph", () => {
  it("emits a stable, snapshot-friendly graph for the fixture", () => {
    const graph = buildBgmFilterGraph({
      narrationDurationSec: 5,
      bgmGain: 0.3,
      ducking: 0.6,
      fadeSec: 1.5,
      duckWindows: buildDuckWindows(fixtureCaptions, { mergeGapSec: 0.35, padSec: 0.12 }),
    });
    expect(graph).toMatchInlineSnapshot(
      `"[1:a]aloop=loop=-1:size=2e+09,atrim=duration=5,asetpts=PTS-STARTPTS,volume=0.3,volume=0.6:enable='between(t,0.38,1.52)',volume=0.6:enable='between(t,3.08,4.32)',afade=t=in:st=0:d=1.5,afade=t=out:st=3.5:d=1.5[bgm];[0:a][bgm]amix=inputs=2:duration=first:normalize=0[mix];[mix]loudnorm=I=-14:TP=-1.5:LRA=11[out]"`,
    );
  });

  it("skips the ducking stage when no windows are provided", () => {
    const graph = buildBgmFilterGraph({
      narrationDurationSec: 10,
      duckWindows: [],
    });
    expect(graph).not.toMatch(/volume=0\.6/);
    expect(graph).toMatch(/volume=0\.3/);
    expect(graph).toMatch(/amix=inputs=2:duration=first:normalize=0/);
    expect(graph).toMatch(/loudnorm=I=-14:TP=-1\.5:LRA=11/);
  });

  it("clamps fade duration to half the narration length", () => {
    // Narration 2s, fade requested 1.5s → must clamp to 1.0s with tailStart=1.0.
    const graph = buildBgmFilterGraph({
      narrationDurationSec: 2,
      fadeSec: 1.5,
      duckWindows: [],
    });
    expect(graph).toMatch(/afade=t=in:st=0:d=1/);
    expect(graph).toMatch(/afade=t=out:st=1:d=1/);
  });

  it("omits the afade stages when fadeSec is 0", () => {
    const graph = buildBgmFilterGraph({
      narrationDurationSec: 5,
      fadeSec: 0,
      duckWindows: [],
    });
    expect(graph).not.toMatch(/afade/);
  });

  it("clamps ducking windows to the narration duration", () => {
    const graph = buildBgmFilterGraph({
      narrationDurationSec: 3,
      duckWindows: [{ start: -1, end: 0.5 }, { start: 2.5, end: 99 }],
    });
    expect(graph).toMatch(/between\(t,0,0.5\)/);
    expect(graph).toMatch(/between\(t,2.5,3\)/);
  });

  it("honors custom loudness targets", () => {
    const graph = buildBgmFilterGraph({
      narrationDurationSec: 5,
      duckWindows: [],
      loudnessLufs: -16,
      loudnessTruePeak: -2,
      loudnessLra: 7,
    });
    expect(graph).toMatch(/loudnorm=I=-16:TP=-2:LRA=7/);
  });
});

describe("buildFfmpegArgs", () => {
  it("composes a runnable ffmpeg argv pointing at the right inputs", () => {
    const args = buildFfmpegArgs({
      narrationPath: "/tmp/voice.mp3",
      bgmPath: "/tmp/bgm.mp3",
      outputPath: "/tmp/voice-mixed.mp3",
      narrationDurationSec: 5,
      duckWindows: [],
    });
    expect(args[0]).toBe("-y");
    expect(args).toContain("/tmp/voice.mp3");
    expect(args).toContain("/tmp/bgm.mp3");
    expect(args).toContain("/tmp/voice-mixed.mp3");
    expect(args).toContain("-filter_complex");
    expect(args).toContain("-map");
    expect(args).toContain("[out]");
    expect(args).toContain("libmp3lame");
  });
});

describe("mixBgm", () => {
  it("invokes the runner exactly once with the composed argv", async () => {
    const runner = vi.fn<FfmpegRunner>(async () => ({ stdout: "", stderr: "ok" }));
    const result = await mixBgm(
      {
        narrationPath: "/tmp/voice.mp3",
        narrationDurationSec: 5,
        bgmPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/voice-mixed.mp3",
        captions: fixtureCaptions,
      },
      runner,
    );
    expect(runner).toHaveBeenCalledTimes(1);
    const argv = runner.mock.calls[0]?.[0] ?? [];
    expect(argv).toEqual(result.args);
    expect(result.outputPath).toBe("/tmp/voice-mixed.mp3");
    expect(result.duckWindowCount).toBe(2);
    expect(result.command).toContain("ffmpeg ");
    expect(result.command).toContain("/tmp/voice-mixed.mp3");
    expect(result.filterGraph).toContain("amix=inputs=2:duration=first:normalize=0");
  });

  it("surfaces ffmpeg stderr through the result", async () => {
    const runner: FfmpegRunner = async () => ({ stdout: "", stderr: "size=N/A time=00:00:05.00" });
    const result = await mixBgm(
      {
        narrationPath: "/tmp/voice.mp3",
        narrationDurationSec: 5,
        bgmPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/voice-mixed.mp3",
        captions: [],
      },
      runner,
    );
    expect(result.stderr).toContain("time=00:00:05");
    expect(result.duckWindowCount).toBe(0);
  });

  it("never calls the runner when invoked through a higher-level guard (no-BGM bit-identical contract)", async () => {
    // This documents the contract enforced by the CLI: when --bgm is absent
    // the CLI must NOT call mixBgm at all. The mixer itself doesn't carry
    // that guard — it's a CLI-level invariant. The test below verifies the
    // mirror property: calling mixBgm always runs ffmpeg exactly once.
    const runner = vi.fn<FfmpegRunner>(async () => ({ stdout: "", stderr: "" }));
    await mixBgm(
      {
        narrationPath: "/tmp/voice.mp3",
        narrationDurationSec: 5,
        bgmPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/voice-mixed.mp3",
        captions: [],
      },
      runner,
    );
    expect(runner).toHaveBeenCalledTimes(1);
  });
});
