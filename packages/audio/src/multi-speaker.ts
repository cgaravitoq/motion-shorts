/**
 * Multi-speaker scripts: parse inline `[speaker:<name>]` markup, route each
 * segment through the existing TTS provider, and merge the resulting audio +
 * captions into a single voice.mp3 + captions.json pair.
 *
 * Markup
 * ------
 * Lines may be prefixed with a bracketed speaker tag:
 *
 *   [speaker:alex] Hello, this is Alex.
 *   [speaker:morgan] And this is Morgan.
 *
 * The tag is the FIRST non-whitespace token on the line. Lines without a tag
 * inherit the previous segment's speaker; the very first untagged line is
 * synthesised as a "default" segment (matching today's single-speaker path).
 *
 * The token after `speaker:` is either a roster name (resolved via the roster
 * arg → typically loaded from env / episode meta.json) or, if no roster entry
 * matches, a raw voice id passed through unchanged. This dual behavior keeps
 * one-off shorts ergonomic without forcing every author to set up a roster.
 *
 * Single-speaker passthrough
 * --------------------------
 * A script with zero `[speaker:...]` tags returns a single segment carrying
 * the verbatim text (no normalisation, no trimming beyond what callers
 * already do). The byte-identical guarantee for the single-speaker path
 * lives in tests/__tests__/multi-speaker.test.ts.
 */
import { env } from "./env";
import type { HyperframesCaption } from "./stt-types";

export interface SpeakerRoster {
  /** name → ElevenLabs voice id. Names are case-insensitive on lookup. */
  [name: string]: string;
}

export interface ScriptSegment {
  /**
   * Resolved voice id, OR `undefined` for the default/untagged opening
   * segment of a single-speaker script. `undefined` means "use whatever the
   * CLI/env resolves for the language" — i.e. the legacy code path.
   */
  voiceId: string | undefined;
  /** Roster name as written in the markup (e.g. "alex"). `undefined` for the default segment. */
  speakerName: string | undefined;
  /** Trimmed segment text. Never empty. */
  text: string;
  /** 0-indexed segment order in the script. */
  index: number;
}

export interface ParseScriptOptions {
  /** name → voiceId. Optional; markup falls through to raw voice ids if absent. */
  roster?: SpeakerRoster;
}

export interface ParseScriptResult {
  segments: ScriptSegment[];
  /** True iff the script contains any `[speaker:...]` tag. Drives the "byte-identical passthrough" branch. */
  hasMarkup: boolean;
  /** Names referenced by the script that did NOT resolve through the roster (likely typos or raw voice ids). */
  unresolved: string[];
}

const SPEAKER_TAG_RE = /^\[speaker:([^\]]+)\]\s*/i;

/**
 * Look the name up case-insensitively. We keep the original casing in the
 * roster on purpose — env-loaded rosters tend to mirror user casing.
 */
const resolveFromRoster = (name: string, roster: SpeakerRoster | undefined): string | undefined => {
  if (!roster) return undefined;
  if (name in roster) return roster[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(roster)) {
    if (key.toLowerCase() === lower) return roster[key];
  }
  return undefined;
};

/**
 * Parse a script into ordered speaker-tagged segments. Behavior:
 *
 * - No `[speaker:...]` tag anywhere → one segment with the entire script,
 *   voiceId/speakerName = undefined. `hasMarkup = false`.
 * - One or more tags → split at each tag boundary; untagged opening text
 *   (if any) is emitted as a default segment with voiceId = undefined.
 *
 * Empty segments (tag followed by no text on its own line and no continuation)
 * are dropped silently — they don't contribute anything to the render.
 */
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

/**
 * Parse a JSON roster string (env-shaped). Accepts:
 *
 *   {"alex":"voice-id-1","morgan":"voice-id-2"}
 *
 * Returns `undefined` when the input is falsy/empty so callers can pipe
 * env values straight through. Throws a descriptive error on malformed
 * JSON or non-string values — failing loudly here is cheaper than producing
 * a silent single-speaker run on a multi-speaker script.
 */
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

/**
 * Resolve a roster by merging env (`MOTION_SHORTS_VOICE_ROSTER`) and an
 * optional caller-provided override (e.g. an episode `meta.json` `voices`
 * map). The override wins on conflict — episode metadata is more specific
 * than a process-wide env default.
 */
export const resolveRoster = (override?: SpeakerRoster): SpeakerRoster | undefined => {
  const fromEnv = parseRosterJson(env.MOTION_SHORTS_VOICE_ROSTER);
  if (!fromEnv && !override) return undefined;
  return { ...(fromEnv ?? {}), ...(override ?? {}) };
};

export interface SpeakerSummaryEntry {
  /** Roster name or raw voice id from the markup. `(default)` for the untagged opening segment. */
  label: string;
  /** Number of segments authored under this label. */
  segments: number;
}

export const summariseSpeakers = (segments: ScriptSegment[]): SpeakerSummaryEntry[] => {
  const counts = new Map<string, number>();
  for (const seg of segments) {
    const label = seg.speakerName ?? "(default)";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // Preserve first-appearance order so the recap reads in the same order the
  // script does. Map insertion is already first-appearance-ordered.
  return [...counts.entries()].map(([label, segs]) => ({ label, segments: segs }));
};

/**
 * Shift caption timestamps by `offsetSeconds`. Negative or NaN offsets are
 * coerced to 0 — callers should never pass them, but defensive zeroing is
 * cheap and keeps the merged output monotonic.
 */
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
  /** Measured duration of this segment's audio, in seconds. Used to offset captions of later segments. */
  durationSec: number;
  /** Average word-level confidence over this segment, in [0,1]. `undefined` if no caption carried confidence. */
  averageConfidence: number | undefined;
}

export interface MergeArtifactsResult {
  audio: Buffer;
  captions: HyperframesCaption[];
  /** Per-boundary diagnostics: `dropPct` = how much the average confidence drops vs the previous segment. */
  boundaryWarnings: {
    afterSegment: number;
    previousAvg: number;
    nextAvg: number;
    dropPct: number;
  }[];
}

/** Threshold beyond which a confidence drop at a speaker boundary becomes a warning. */
export const CAPTION_CONFIDENCE_DROP_WARN = 0.15;

/**
 * Concatenate MP3 buffers and re-time captions so the merged track is
 * continuous. MP3 frames are independent; back-to-back Buffer.concat is
 * the canonical "good enough" approach for ElevenLabs `mp3_44100_128`
 * output. Players that probe duration off the file header (a few do)
 * may show the first segment's duration — render-time ffprobe rescans
 * the whole file and reports correctly.
 */
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
