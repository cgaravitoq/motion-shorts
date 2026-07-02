import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HyperframesCaption } from "./stt-types";

const execFileAsync = promisify(execFile);

export const BGM_DEFAULTS = {
  bgmGain: 0.3,
  ducking: 0.6,
  fadeSec: 1.5,
  attackSec: 0.08,
  releaseSec: 0.2,
  mergeGapSec: 0.35,
  padSec: 0.12,
  loudnessLufs: -14,
  loudnessTruePeak: -1.5,
  loudnessLra: 11,
} as const;

export interface DuckWindow {
  start: number;
  end: number;
}

export interface BuildEnvelopeOptions {
  mergeGapSec?: number;
  padSec?: number;
}

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
  narrationDurationSec: number;
  bgmGain?: number;
  ducking?: number;
  fadeSec?: number;
  attackSec?: number;
  releaseSec?: number;
  duckWindows: DuckWindow[];
  loudnessLufs?: number;
  loudnessTruePeak?: number;
  loudnessLra?: number;
}

const fmtNumber = (n: number, decimals = 3): string => {
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(decimals);
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
  const sorted = times
    .filter(Number.isFinite)
    .map((t) => Math.max(0, t))
    .sort((a, b) => a - b);
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
  for (let t = from + RAMP_STEP_SEC; t < to - EPSILON; t += RAMP_STEP_SEC) {
    times.push(Number(t.toFixed(6)));
  }
};

const envelopeGainAt = (
  t: number,
  w: DuckWindow,
  attackSec: number,
  releaseSec: number,
  ducking: number,
) => {
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
      (minGain, w) =>
        Math.min(minGain, envelopeGainAt(midpoint, w, attackSec, releaseSec, ducking)),
      1,
    );
    if (gain >= 1 - EPSILON) continue;
    const last = segments[segments.length - 1];
    const roundedGain = Number(fmtNumber(gain, 6));
    if (
      last &&
      Math.abs(last.end - start) <= EPSILON &&
      Math.abs(last.gain - roundedGain) <= EPSILON
    ) {
      last.end = end;
    } else {
      segments.push({ start, end, gain: roundedGain });
    }
  }
  return segments;
};

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
  const fade = Math.max(0, Math.min(fadeSec, dur / 2));
  const tailStart = Math.max(0, dur - fade);

  const bgmStages: string[] = [
    "aloop=loop=-1:size=2e+09",
    `atrim=duration=${fmtNumber(dur)}`,
    "asetpts=PTS-STARTPTS",
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

export type FfmpegRunner = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

const defaultRunner: FfmpegRunner = async (args) => {
  const { stdout, stderr } = await execFileAsync("ffmpeg", args, {
    maxBuffer: 16 * 1024 * 1024,
  });
  return { stdout, stderr };
};

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
