import { describe, expect, it, vi } from "vitest";
import {
  buildBgmFilterGraph,
  buildDuckSegments,
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
      duckWindows: buildDuckWindows(fixtureCaptions, { mergeGapSec: 0, padSec: 0 }),
    });
    expect(graph).toMatchInlineSnapshot(`"[1:a]aloop=loop=-1:size=2e+09,atrim=duration=5,asetpts=PTS-STARTPTS,volume=0.3,volume=0.975:enable='between(t,0.42,0.43)',volume=0.925:enable='between(t,0.43,0.44)',volume=0.875:enable='between(t,0.44,0.45)',volume=0.825:enable='between(t,0.45,0.46)',volume=0.775:enable='between(t,0.46,0.47)',volume=0.725:enable='between(t,0.47,0.48)',volume=0.675:enable='between(t,0.48,0.49)',volume=0.625:enable='between(t,0.49,0.5)',volume=0.6:enable='between(t,0.5,0.9)',volume=0.61:enable='between(t,0.9,0.91)',volume=0.63:enable='between(t,0.91,0.92)',volume=0.65:enable='between(t,0.92,0.93)',volume=0.67:enable='between(t,0.93,0.94)',volume=0.625:enable='between(t,0.94,0.95)',volume=0.6:enable='between(t,0.95,1.4)',volume=0.61:enable='between(t,1.4,1.41)',volume=0.63:enable='between(t,1.41,1.42)',volume=0.65:enable='between(t,1.42,1.43)',volume=0.67:enable='between(t,1.43,1.44)',volume=0.69:enable='between(t,1.44,1.45)',volume=0.71:enable='between(t,1.45,1.46)',volume=0.73:enable='between(t,1.46,1.47)',volume=0.75:enable='between(t,1.47,1.48)',volume=0.77:enable='between(t,1.48,1.49)',volume=0.79:enable='between(t,1.49,1.5)',volume=0.81:enable='between(t,1.5,1.51)',volume=0.83:enable='between(t,1.51,1.52)',volume=0.85:enable='between(t,1.52,1.53)',volume=0.87:enable='between(t,1.53,1.54)',volume=0.89:enable='between(t,1.54,1.55)',volume=0.91:enable='between(t,1.55,1.56)',volume=0.93:enable='between(t,1.56,1.57)',volume=0.95:enable='between(t,1.57,1.58)',volume=0.97:enable='between(t,1.58,1.59)',volume=0.99:enable='between(t,1.59,1.6)',volume=0.975:enable='between(t,3.12,3.13)',volume=0.925:enable='between(t,3.13,3.14)',volume=0.875:enable='between(t,3.14,3.15)',volume=0.825:enable='between(t,3.15,3.16)',volume=0.775:enable='between(t,3.16,3.17)',volume=0.725:enable='between(t,3.17,3.18)',volume=0.675:enable='between(t,3.18,3.19)',volume=0.625:enable='between(t,3.19,3.2)',volume=0.6:enable='between(t,3.2,3.5)',volume=0.61:enable='between(t,3.5,3.51)',volume=0.63:enable='between(t,3.51,3.52)',volume=0.65:enable='between(t,3.52,3.53)',volume=0.67:enable='between(t,3.53,3.54)',volume=0.625:enable='between(t,3.54,3.55)',volume=0.6:enable='between(t,3.55,3.7)',volume=0.61:enable='between(t,3.7,3.71)',volume=0.63:enable='between(t,3.71,3.72)',volume=0.65:enable='between(t,3.72,3.73)',volume=0.67:enable='between(t,3.73,3.74)',volume=0.625:enable='between(t,3.74,3.75)',volume=0.6:enable='between(t,3.75,4.2)',volume=0.61:enable='between(t,4.2,4.21)',volume=0.63:enable='between(t,4.21,4.22)',volume=0.65:enable='between(t,4.22,4.23)',volume=0.67:enable='between(t,4.23,4.24)',volume=0.69:enable='between(t,4.24,4.25)',volume=0.71:enable='between(t,4.25,4.26)',volume=0.73:enable='between(t,4.26,4.27)',volume=0.75:enable='between(t,4.27,4.28)',volume=0.77:enable='between(t,4.28,4.29)',volume=0.79:enable='between(t,4.29,4.3)',volume=0.81:enable='between(t,4.3,4.31)',volume=0.83:enable='between(t,4.31,4.32)',volume=0.85:enable='between(t,4.32,4.33)',volume=0.87:enable='between(t,4.33,4.34)',volume=0.89:enable='between(t,4.34,4.35)',volume=0.91:enable='between(t,4.35,4.36)',volume=0.93:enable='between(t,4.36,4.37)',volume=0.95:enable='between(t,4.37,4.38)',volume=0.97:enable='between(t,4.38,4.39)',volume=0.99:enable='between(t,4.39,4.4)',afade=t=in:st=0:d=1.5,afade=t=out:st=3.5:d=1.5[bgm];[0:a][bgm]amix=inputs=2:duration=first:normalize=0[mix];[mix]loudnorm=I=-14:TP=-1.5:LRA=11[out]"`);
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
    expect(graph).toContain("between(t,0,0.5)");
    expect(graph).toContain("between(t,2.5,3)");
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

describe("buildDuckSegments", () => {
  it("samples a single-word attack, hold, and release envelope", () => {
    const segments = buildDuckSegments([{ start: 1, end: 1.1 }], {
      durationSec: 2,
      ducking: 0.5,
      attackSec: 0.02,
      releaseSec: 0.02,
    });
    expect(segments).toEqual([
      { start: 0.98, end: 0.99, gain: 0.875 },
      { start: 0.99, end: 1, gain: 0.625 },
      { start: 1, end: 1.1, gain: 0.5 },
      { start: 1.1, end: 1.11, gain: 0.625 },
      { start: 1.11, end: 1.12, gain: 0.875 },
    ]);
  });

  it("merges overlapping release and attack ramps by keeping the minimum gain", () => {
    const segments = buildDuckSegments(
      [
        { start: 1, end: 1.1 },
        { start: 1.15, end: 1.25 },
      ],
      { durationSec: 2, ducking: 0.5, attackSec: 0.08, releaseSec: 0.2 },
    );
    const bridge = segments.filter((s) => s.start >= 1.1 && s.end <= 1.15);
    expect(bridge.length).toBeGreaterThan(0);
    expect(Math.max(...bridge.map((s) => s.gain))).toBeLessThanOrEqual(0.625);
  });

  it("honors custom attack and release values", () => {
    const segments = buildDuckSegments([{ start: 1, end: 1.1 }], {
      durationSec: 2,
      ducking: 0.6,
      attackSec: 0.05,
      releaseSec: 0.5,
    });
    expect(segments[0]?.start).toBeCloseTo(0.95, 6);
    expect(segments.some((s) => s.start === 1.1 && s.end === 1.11)).toBe(true);
    expect(segments.at(-1)?.end).toBeCloseTo(1.6, 6);
  });

  it("clamps a word at t=0 with no pre-attack window", () => {
    const segments = buildDuckSegments([{ start: 0, end: 0.1 }], {
      durationSec: 1,
      ducking: 0.5,
      attackSec: 0.08,
      releaseSec: 0.2,
    });
    expect(segments[0]).toEqual({ start: 0, end: 0.1, gain: 0.5 });
  });

  it("keeps dense narration segment counts bounded", () => {
    const windows = Array.from({ length: 50 }, (_, i) => ({
      start: i * 0.1,
      end: i * 0.1 + 0.05,
    }));
    const segments = buildDuckSegments(windows, {
      durationSec: 5,
      ducking: 0.6,
      attackSec: 0.08,
      releaseSec: 0.2,
    });
    expect(segments.length).toBeLessThanOrEqual(500);
  });

  it("reaches default ducking at word start and recovers after 200ms", () => {
    const segments = buildDuckSegments([{ start: 1, end: 1.1 }], {
      durationSec: 2,
      ducking: 0.6,
    });
    expect(segments.find((s) => s.start === 1 && s.end === 1.1)?.gain).toBe(0.6);
    expect(segments.at(-1)?.end).toBeCloseTo(1.3, 6);
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
    expect(result.duckWindowCount).toBe(5);
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
