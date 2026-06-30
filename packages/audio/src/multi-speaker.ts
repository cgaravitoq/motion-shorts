import { env } from "./env";
import type { HyperframesCaption } from "./stt-types";

export interface SpeakerRoster {
  [name: string]: string;
}

export interface ScriptSegment {
  voiceId: string | undefined;
  speakerName: string | undefined;
  text: string;
  index: number;
}

export interface ParseScriptOptions {
  roster?: SpeakerRoster;
}

export interface ParseScriptResult {
  segments: ScriptSegment[];
  hasMarkup: boolean;
  unresolved: string[];
}

const SPEAKER_TAG_RE = /^\[speaker:([^\]]+)\]\s*/i;

const resolveFromRoster = (name: string, roster: SpeakerRoster | undefined): string | undefined => {
  if (!roster) return undefined;
  if (name in roster) return roster[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(roster)) {
    if (key.toLowerCase() === lower) return roster[key];
  }
  return undefined;
};

export const parseScript = (raw: string, opts: ParseScriptOptions = {}): ParseScriptResult => {
  if (!SPEAKER_TAG_RE.test(raw) && !raw.includes("[speaker:")) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return { segments: [], hasMarkup: false, unresolved: [] };
    }
    return {
      segments: [{ voiceId: undefined, speakerName: undefined, text: trimmed, index: 0 }],
      hasMarkup: false,
      unresolved: [],
    };
  }

  const lines = raw.split(/\r?\n/);
  const segments: ScriptSegment[] = [];
  const unresolved = new Set<string>();
  let currentName: string | undefined;
  let currentVoiceId: string | undefined;
  let currentBuffer: string[] = [];

  const flush = () => {
    const text = currentBuffer.join("\n").trim();
    if (text.length === 0) {
      currentBuffer = [];
      return;
    }
    segments.push({
      voiceId: currentVoiceId,
      speakerName: currentName,
      text,
      index: segments.length,
    });
    currentBuffer = [];
  };

  for (const line of lines) {
    const match = line.match(SPEAKER_TAG_RE);
    if (match) {
      flush();
      const tagBody = (match[1] ?? "").trim();
      currentName = tagBody;
      const resolved = resolveFromRoster(tagBody, opts.roster);
      if (resolved) {
        currentVoiceId = resolved;
      } else {
        currentVoiceId = tagBody;
        if (opts.roster && !(tagBody in opts.roster)) {
          unresolved.add(tagBody);
        }
      }
      const remainder = line.slice(match[0].length);
      if (remainder.length > 0) currentBuffer.push(remainder);
      continue;
    }
    currentBuffer.push(line);
  }
  flush();

  return {
    segments,
    hasMarkup: true,
    unresolved: [...unresolved],
  };
};

export const parseRosterJson = (raw: string | undefined | null): SpeakerRoster | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(
      `voice roster: invalid JSON (${(err as Error).message}). Expected an object mapping name → voiceId.`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("voice roster: expected a JSON object mapping name → voiceId.");
  }
  const out: SpeakerRoster = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`voice roster: entry "${k}" must be a non-empty string voice id.`);
    }
    out[k] = v;
  }
  return out;
};

export const resolveRoster = (override?: SpeakerRoster): SpeakerRoster | undefined => {
  const fromEnv = parseRosterJson(env.MOTION_SHORTS_VOICE_ROSTER);
  if (!fromEnv && !override) return undefined;
  return { ...(fromEnv ?? {}), ...(override ?? {}) };
};

export interface SpeakerSummaryEntry {
  label: string;
  segments: number;
}

export const summariseSpeakers = (segments: ScriptSegment[]): SpeakerSummaryEntry[] => {
  const counts = new Map<string, number>();
  for (const seg of segments) {
    const label = seg.speakerName ?? "(default)";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, segs]) => ({ label, segments: segs }));
};

export const offsetCaptions = (
  captions: HyperframesCaption[],
  offsetSeconds: number,
): HyperframesCaption[] => {
  const shift = Number.isFinite(offsetSeconds) && offsetSeconds > 0 ? offsetSeconds : 0;
  if (shift === 0) return captions.map((c) => ({ ...c }));
  return captions.map((c) => ({
    ...c,
    start: Number((c.start + shift).toFixed(3)),
    end: Number((c.end + shift).toFixed(3)),
  }));
};

export interface MergedSegmentArtifact {
  audio: Buffer;
  captions: HyperframesCaption[];
  durationSec: number;
  averageConfidence: number | undefined;
}

export interface MergeArtifactsResult {
  audio: Buffer;
  captions: HyperframesCaption[];
  boundaryWarnings: {
    afterSegment: number;
    previousAvg: number;
    nextAvg: number;
    dropPct: number;
  }[];
}

export const CAPTION_CONFIDENCE_DROP_WARN = 0.15;

export const mergeSegmentArtifacts = (artifacts: MergedSegmentArtifact[]): MergeArtifactsResult => {
  if (artifacts.length === 0) {
    return { audio: Buffer.alloc(0), captions: [], boundaryWarnings: [] };
  }
  const audioChunks: Buffer[] = [];
  const merged: HyperframesCaption[] = [];
  const boundaryWarnings: MergeArtifactsResult["boundaryWarnings"] = [];
  let offset = 0;
  for (let i = 0; i < artifacts.length; i++) {
    const art = artifacts[i];
    if (!art) continue;
    audioChunks.push(art.audio);
    for (const c of offsetCaptions(art.captions, offset)) merged.push(c);
    if (i > 0) {
      const prev = artifacts[i - 1];
      if (
        prev &&
        prev.averageConfidence !== undefined &&
        art.averageConfidence !== undefined &&
        prev.averageConfidence > 0
      ) {
        const drop = (prev.averageConfidence - art.averageConfidence) / prev.averageConfidence;
        if (drop >= CAPTION_CONFIDENCE_DROP_WARN) {
          boundaryWarnings.push({
            afterSegment: i - 1,
            previousAvg: Number(prev.averageConfidence.toFixed(3)),
            nextAvg: Number(art.averageConfidence.toFixed(3)),
            dropPct: Number((drop * 100).toFixed(1)),
          });
        }
      }
    }
    offset += art.durationSec;
  }
  return { audio: Buffer.concat(audioChunks), captions: merged, boundaryWarnings };
};

export const averageCaptionConfidence = (captions: HyperframesCaption[]): number | undefined => {
  let sum = 0;
  let n = 0;
  for (const c of captions) {
    if (typeof c.confidence === "number" && Number.isFinite(c.confidence)) {
      sum += c.confidence;
      n += 1;
    }
  }
  if (n === 0) return undefined;
  return sum / n;
};
