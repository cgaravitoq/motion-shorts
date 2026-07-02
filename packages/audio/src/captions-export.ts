import type { HyperframesCaption } from "./stt-types";

export type CaptionSidecarFormat = "srt" | "vtt";

const pad2 = (n: number) => n.toString().padStart(2, "0");
const pad3 = (n: number) => n.toString().padStart(3, "0");

const splitSeconds = (seconds: number) => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return { h, m, s, ms };
};

const formatTimestamp = (seconds: number, msSep: "," | ".") => {
  const { h, m, s, ms } = splitSeconds(seconds);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}${msSep}${pad3(ms)}`;
};

const DEFAULT_MAX_CUE_DURATION_S = 5;
const DEFAULT_MAX_CUE_CHARS = 80;

interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface CaptionExportOptions {
  maxCueDurationSec?: number;
  maxCueChars?: number;
}

const buildCues = (captions: HyperframesCaption[], opts: CaptionExportOptions = {}): Cue[] => {
  const maxDur = opts.maxCueDurationSec ?? DEFAULT_MAX_CUE_DURATION_S;
  const maxChars = opts.maxCueChars ?? DEFAULT_MAX_CUE_CHARS;
  const cues: Cue[] = [];
  let current: Cue | null = null;

  for (const word of captions) {
    const token = word.text.trim();
    if (!token) continue;
    if (!current) {
      current = { start: word.start, end: word.end, text: token };
      continue;
    }
    const candidateText = `${current.text} ${token}`;
    const candidateDur = word.end - current.start;
    if (candidateText.length > maxChars || candidateDur > maxDur) {
      cues.push(current);
      current = { start: word.start, end: word.end, text: token };
      continue;
    }
    current.end = word.end;
    current.text = candidateText;
  }
  if (current) cues.push(current);
  return cues;
};

export const toSrt = (captions: HyperframesCaption[], opts: CaptionExportOptions = {}): string => {
  const cues = buildCues(captions, opts);
  if (cues.length === 0) return "";
  const blocks = cues.map((cue, i) => {
    const start = formatTimestamp(cue.start, ",");
    const end = formatTimestamp(cue.end, ",");
    return `${i + 1}\n${start} --> ${end}\n${cue.text}`;
  });
  return `${blocks.join("\n\n")}\n`;
};

export const toVtt = (captions: HyperframesCaption[], opts: CaptionExportOptions = {}): string => {
  const cues = buildCues(captions, opts);
  const header = "WEBVTT\n";
  if (cues.length === 0) return `${header}\n`;
  const blocks = cues.map((cue) => {
    const start = formatTimestamp(cue.start, ".");
    const end = formatTimestamp(cue.end, ".");
    return `${start} --> ${end}\n${cue.text}`;
  });
  return `${header}\n${blocks.join("\n\n")}\n`;
};

export const parseCaptionFormats = (raw: string | undefined | null): CaptionSidecarFormat[] => {
  if (!raw) return [];
  const seen = new Set<CaptionSidecarFormat>();
  for (const part of raw.split(",")) {
    const token = part.trim().toLowerCase();
    if (token === "srt" || token === "vtt") seen.add(token);
    else if (token.length > 0) {
      throw new Error(`unknown caption format "${token}" (expected "srt" or "vtt")`);
    }
  }
  return [...seen];
};
