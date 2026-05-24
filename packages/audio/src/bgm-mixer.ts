/**
 * BGM mixer — overlays a background music track onto a narration mp3 with
 * caption-driven ducking, head/tail fades, and a final loudness pass.
 *
 * Why caption-driven ducking
 * --------------------------
 * Every episode already produces word-level captions (the same array consumed
 * by `captions-export.ts`). Each caption becomes a ducking envelope with a
 * short attack, a hold while the word is active, and a release afterwards.
 * Overlapping envelopes merge by taking the quietest active gain at each point,
 * so dense narration stays smoothly ducked instead of pumping between words.
 *
 * Filter graph
 * ------------
 *   [0:a] -> narration passthrough
 *   [1:a] -> aloop (cover narration duration) -> atrim -> asetpts
 *         -> volume=<bgmGain>                 [base BGM gain]
 *         -> volume=<ramp gain>:enable=...    [piecewise-linear duck segment 1]
 *         -> volume=<ramp gain>:enable=...    [piecewise-linear duck segment N]
 *         -> afade=in (head) -> afade=out (tail)
 *   amix=inputs=2:duration=first:normalize=0
 *   loudnorm=I=-14:TP=-1.5:LRA=11             [YouTube/streaming target]
 *
 * The graph is built as a pure function (`buildBgmFilterGraph`) so unit tests
 * snapshot the exact string ffmpeg will see. Subprocess execution lives in
 * `mixBgm` and is the only side-effecting export.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HyperframesCaption } from "./stt-types";

const execFileAsync = promisify(execFile);

/** Default gain envelope tuning. Tuned for narration shorts (30-50s, voice-led). */
export const BGM_DEFAULTS = {
  /** Base BGM gain when narration is silent. */
  bgmGain: 0.3,
  /** Multiplier applied on top of bgmGain during narration windows. */
  ducking: 0.6,
  /** Head + tail fade duration in seconds. */
  fadeSec: 1.5,
  /** Linear duck attack duration in seconds. */
  attackSec: 0.08,
  /** Linear duck release duration in seconds. */
  releaseSec: 0.2,
  /** Caption gaps shorter than this are bridged into one narration window. */
  mergeGapSec: 0.35,
  /** Each narration window is widened by this much on both edges. */
  padSec: 0.12,
  /** Integrated LUFS target for the final loudness pass. */
  loudnessLufs: -14,
  /** True peak ceiling (dBTP). */
  loudnessTruePeak: -1.5,
  /** Loudness range (LU). */
  loudnessLra: 11,
} as const;

export interface DuckWindow {
  start: number;
  end: number;
}

export interface BuildEnvelopeOptions {
  /** Bridge gaps shorter than this between adjacent captions. Default 0.35s. */
  mergeGapSec?: number;
  /** Widen each window by this much on each side. Default 0.12s. */
  padSec?: number;
}

/**
 * Compute narration-active windows from word-level captions. Adjacent words
 * are merged when the gap between them is shorter than `mergeGapSec`; the
 * resulting windows are widened by `padSec` on each side so the duck has a
 * small attack/release margin.
 *
 * Empty or whitespace-only captions are ignored. Windows clamp to non-negative
 * starts; callers responsible for clamping to the narration duration if needed.
 */
export const buildDuckWindows = (
  captions: HyperframesCaption[],
  opts: BuildEnvelopeOptions = {},
): DuckWindow[] => {
  const mergeGap = opts.mergeGapSec ?? BGM_DEFAULTS.mergeGapSec;
  const pad = opts.padSec ?? BGM_DEFAULTS.padSec;
  const windows: DuckWindow[] = [];
  let current: DuckWindow | null = null;

  for (const caption of captions) {
    if (!caption.text || caption.text.trim().length === 0) continue;
    if (!Number.isFinite(caption.start) || !Number.isFinite(caption.end)) continue;
    if (caption.end <= caption.start) continue;
    if (!current) {
      current = { start: caption.start, end: caption.end };
      continue;
    }
    if (caption.start - current.end <= mergeGap) {
      current.end = Math.max(current.end, caption.end);
    } else {
      windows.push(current);
      current = { start: caption.start, end: caption.end };
    }
  }
  if (current) windows.push(current);

  // Pad after merging so adjacent post-pad windows can collapse cleanly.
  const padded: DuckWindow[] = [];
  for (const w of windows) {
    const start = Math.max(0, w.start - pad);
    const end = w.end + pad;
    const last = padded[padded.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      padded.push({ start, end });
    }
  }
  return padded;
};

export interface FilterGraphOptions {
  /** Narration duration in seconds; used to trim the looped BGM. Required so the BGM doesn't outlast the voice. */
  narrationDurationSec: number;
  /** Base BGM gain multiplier (silent narration). Default 0.3. */
  bgmGain?: number;
  /** Multiplier applied on top of bgmGain during narration windows. Default 0.6. */
  ducking?: number;
  /** Head/tail fade in seconds. Default 1.5. */
  fadeSec?: number;
  /** Linear duck attack duration in seconds. Default 0.08. */
  attackSec?: number;
  /** Linear duck release duration in seconds. Default 0.20. */
  releaseSec?: number;
  /** Pre-computed ducking windows. Pass `[]` to disable ducking entirely. */
  duckWindows: DuckWindow[];
  /** Integrated LUFS target. Default -14. */
  loudnessLufs?: number;
  /** True peak ceiling (dBTP). Default -1.5. */
  loudnessTruePeak?: number;
  /** Loudness range (LU). Default 11. */
  loudnessLra?: number;
}

const fmtNumber = (n: number, decimals = 3): string => {
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(decimals);
  // Strip trailing zeros but keep at least one decimal-free integer ("0") clean.
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
};

export interface DuckSegment {
  start: number;
  end: number;
  gain: number;
}

const RAMP_STEP_SEC = 0.01;
const EPSILON = 1e-9;

const uniqueSortedTimes = (times: number[]): number[] => {
  const sorted = times.filter(Number.isFinite).map((t) => Math.max(0, t)).sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of sorted) {
    const last = out[out.length - 1];
    if (last == null || Math.abs(t - last) > EPSILON) out.push(t);
  }
  return out;
};

const addRampTicks = (times: number[], start: number, end: number) => {
  const from = Math.max(0, start);
  const to = Math.max(0, end);
  if (to <= from) return;
  times.push(from, to);
  // Ramps are approximated by constant-gain ffmpeg volume segments sampled at
  // each segment midpoint. Keeping ramp spans <=10ms makes the staircase
  // perceptually smooth without exploding hold-region filter counts.
  for (let t = from + RAMP_STEP_SEC; t < to - EPSILON; t += RAMP_STEP_SEC) {
    times.push(Number(t.toFixed(6)));
  }
};

const envelopeGainAt = (t: number, w: DuckWindow, attackSec: number, releaseSec: number, ducking: number) => {
  const attackStart = Math.max(0, w.start - attackSec);
  if (attackSec > 0 && t >= attackStart && t < w.start) {
    const progress = (t - attackStart) / (w.start - attackStart);
    return 1 - (1 - ducking) * progress;
  }
  if (t >= w.start && t <= w.end) return ducking;
  if (releaseSec > 0 && t > w.end && t <= w.end + releaseSec) {
    const progress = (t - w.end) / releaseSec;
    return ducking + (1 - ducking) * progress;
  }
  return 1;
};

export const buildDuckSegments = (
  duckWindows: DuckWindow[],
  opts: { durationSec: number; ducking?: number; attackSec?: number; releaseSec?: number },
): DuckSegment[] => {
  const dur = Math.max(0, opts.durationSec);
  const ducking = opts.ducking ?? BGM_DEFAULTS.ducking;
  const attackSec = Math.max(0, opts.attackSec ?? BGM_DEFAULTS.attackSec);
  const releaseSec = Math.max(0, opts.releaseSec ?? BGM_DEFAULTS.releaseSec);
  const windows = duckWindows
    .map((w) => ({ start: Math.max(0, w.start), end: Math.min(dur, w.end) }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const times: number[] = [];
  for (const w of windows) {
    const attackStart = Math.max(0, w.start - attackSec);
    addRampTicks(times, attackStart, w.start);
    times.push(w.start, w.end);
    addRampTicks(times, w.end, Math.min(dur, w.end + releaseSec));
  }
  const points = uniqueSortedTimes(times).filter((t) => t <= dur + EPSILON);
  const segments: DuckSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i] ?? 0;
    const end = points[i + 1] ?? 0;
    if (end <= start) continue;
    const midpoint = (start + end) / 2;
    const gain = windows.reduce(
      (minGain, w) => Math.min(minGain, envelopeGainAt(midpoint, w, attackSec, releaseSec, ducking)),
      1,
    );
    if (gain >= 1 - EPSILON) continue;
    const last = segments[segments.length - 1];
    const roundedGain = Number(fmtNumber(gain, 6));
    if (last && Math.abs(last.end - start) <= EPSILON && Math.abs(last.gain - roundedGain) <= EPSILON) {
      last.end = end;
    } else {
      segments.push({ start, end, gain: roundedGain });
    }
  }
  return segments;
};

/**
 * Build the `-filter_complex` graph for the mix. Pure function — returns the
 * exact string ffmpeg will see, so it can be snapshot-tested.
 *
 * The graph is one long chain on the BGM input ([1:a]) followed by an amix
 * with the narration ([0:a]) and a final loudnorm pass. Multiple `volume`
 * filters with `enable='between(t,a,b)'` stack multiplicatively, which lets us
 * keep the base gain on a separate stage and only apply the ducking factor
 * during narration windows.
 */
export const buildBgmFilterGraph = (opts: FilterGraphOptions): string => {
  const bgmGain = opts.bgmGain ?? BGM_DEFAULTS.bgmGain;
  const ducking = opts.ducking ?? BGM_DEFAULTS.ducking;
  const fadeSec = opts.fadeSec ?? BGM_DEFAULTS.fadeSec;
  const attackSec = opts.attackSec ?? BGM_DEFAULTS.attackSec;
  const releaseSec = opts.releaseSec ?? BGM_DEFAULTS.releaseSec;
  const lufs = opts.loudnessLufs ?? BGM_DEFAULTS.loudnessLufs;
  const tp = opts.loudnessTruePeak ?? BGM_DEFAULTS.loudnessTruePeak;
  const lra = opts.loudnessLra ?? BGM_DEFAULTS.loudnessLra;

  const dur = Math.max(0, opts.narrationDurationSec);
  // Clamp head+tail fades so they never exceed the narration length.
  const fade = Math.max(0, Math.min(fadeSec, dur / 2));
  const tailStart = Math.max(0, dur - fade);

  const bgmStages: string[] = [
    // Loop the BGM track so a short source still covers the narration.
    "aloop=loop=-1:size=2e+09",
    // Trim to narration duration in seconds, reset PTS so amix aligns.
    `atrim=duration=${fmtNumber(dur)}`,
    "asetpts=PTS-STARTPTS",
    // Base BGM gain.
    `volume=${fmtNumber(bgmGain)}`,
  ];

  const duckSegments = buildDuckSegments(opts.duckWindows, {
    durationSec: dur,
    ducking,
    attackSec,
    releaseSec,
  });
  for (const w of duckSegments) {
    bgmStages.push(
      `volume=${fmtNumber(w.gain, 6)}:enable='between(t,${fmtNumber(w.start)},${fmtNumber(w.end)})'`,
    );
  }

  if (fade > 0) {
    bgmStages.push(`afade=t=in:st=0:d=${fmtNumber(fade)}`);
    bgmStages.push(`afade=t=out:st=${fmtNumber(tailStart)}:d=${fmtNumber(fade)}`);
  }

  const bgmChain = `[1:a]${bgmStages.join(",")}[bgm]`;
  const mix = "[0:a][bgm]amix=inputs=2:duration=first:normalize=0[mix]";
  const loud = `[mix]loudnorm=I=${fmtNumber(lufs)}:TP=${fmtNumber(tp)}:LRA=${fmtNumber(lra)}[out]`;

  return [bgmChain, mix, loud].join(";");
};

export interface BuildArgsOptions extends FilterGraphOptions {
  narrationPath: string;
  bgmPath: string;
  outputPath: string;
}

/**
 * Compose the full ffmpeg argv (without the leading binary). Exposed for
 * snapshot tests and for callers that want to log/exec the command themselves.
 */
export const buildFfmpegArgs = (opts: BuildArgsOptions): string[] => {
  const filter = buildBgmFilterGraph(opts);
  return [
    "-y",
    "-i",
    opts.narrationPath,
    "-i",
    opts.bgmPath,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    opts.outputPath,
  ];
};

export interface MixBgmOptions {
  narrationPath: string;
  narrationDurationSec: number;
  bgmPath: string;
  outputPath: string;
  captions: HyperframesCaption[];
  bgmGain?: number;
  ducking?: number;
  fadeSec?: number;
  attackSec?: number;
  releaseSec?: number;
  mergeGapSec?: number;
  padSec?: number;
  loudnessLufs?: number;
  loudnessTruePeak?: number;
  loudnessLra?: number;
}

export interface MixBgmResult {
  outputPath: string;
  command: string;
  args: string[];
  filterGraph: string;
  duckWindowCount: number;
  stderr: string;
}

/** Injectable runner for tests; default shells out to ffmpeg via execFile. */
export type FfmpegRunner = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

const defaultRunner: FfmpegRunner = async (args) => {
  const { stdout, stderr } = await execFileAsync("ffmpeg", args, {
    maxBuffer: 16 * 1024 * 1024,
  });
  return { stdout, stderr };
};

/**
 * Mix BGM into the narration. Returns the mixed file path plus the exact
 * ffmpeg invocation used (handy for the run recap and for reproducing in a
 * shell). The runner is injectable so unit tests can mock the subprocess.
 */
export const mixBgm = async (
  opts: MixBgmOptions,
  runner: FfmpegRunner = defaultRunner,
): Promise<MixBgmResult> => {
  const duckWindows = buildDuckWindows(opts.captions, { mergeGapSec: 0, padSec: 0 });
  const filterGraph = buildBgmFilterGraph({
    narrationDurationSec: opts.narrationDurationSec,
    bgmGain: opts.bgmGain,
    ducking: opts.ducking,
    fadeSec: opts.fadeSec,
    attackSec: opts.attackSec,
    releaseSec: opts.releaseSec,
    duckWindows,
    loudnessLufs: opts.loudnessLufs,
    loudnessTruePeak: opts.loudnessTruePeak,
    loudnessLra: opts.loudnessLra,
  });
  const args = buildFfmpegArgs({
    narrationPath: opts.narrationPath,
    bgmPath: opts.bgmPath,
    outputPath: opts.outputPath,
    narrationDurationSec: opts.narrationDurationSec,
    bgmGain: opts.bgmGain,
    ducking: opts.ducking,
    fadeSec: opts.fadeSec,
    attackSec: opts.attackSec,
    releaseSec: opts.releaseSec,
    duckWindows,
    loudnessLufs: opts.loudnessLufs,
    loudnessTruePeak: opts.loudnessTruePeak,
    loudnessLra: opts.loudnessLra,
  });
  const { stderr } = await runner(args);
  return {
    outputPath: opts.outputPath,
    command: `ffmpeg ${args.join(" ")}`,
    args,
    filterGraph,
    duckWindowCount: duckWindows.length,
    stderr,
  };
};
