import { describe, expect, it, vi } from "vitest";
import { computeTtsCacheKey } from "../cache";
import {
  averageCaptionConfidence,
  CAPTION_CONFIDENCE_DROP_WARN,
  mergeSegmentArtifacts,
  offsetCaptions,
  parseRosterJson,
  parseScript,
  resolveRoster,
  summariseSpeakers,
} from "../multi-speaker";
import type { HyperframesCaption } from "../stt-types";

const mockEnv = vi.hoisted(() => ({
  MOTION_SHORTS_VOICE_ROSTER: undefined as string | undefined,
  MOTION_SHORTS_TTS_CACHE_DIR: undefined as string | undefined,
  XDG_CACHE_HOME: undefined as string | undefined,
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

describe("parseScript — no markup (single-speaker passthrough)", () => {
  it("returns a single default segment carrying the exact trimmed script", () => {
    const text = "Hola mundo. Esto es un script normal.";
    const result = parseScript(text);
    expect(result.hasMarkup).toBe(false);
    expect(result.unresolved).toEqual([]);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      voiceId: undefined,
      speakerName: undefined,
      text,
      index: 0,
    });
  });

  it("preserves whitespace inside the script (only trims edges)", () => {
    const text = "Linea uno.\n\nLinea dos con  doble  espacio.";
    const result = parseScript(text);
    expect(result.segments[0]?.text).toBe(text);
  });

  it("returns the exact same text byte-for-byte that would be sent to TTS today (passthrough guarantee)", () => {
    // Documents the byte-identical contract: the cache key computed over the
    // single-segment passthrough must match the key the legacy single-speaker
    // code path would compute. The cache key hashes raw text, so equality of
    // `segments[0].text` to the original script is the contract.
    const text = "Texto que ya contiene [pause] y tags v3.";
    const result = parseScript(text);
    expect(result.segments[0]?.text).toBe(text);
    const passthroughKey = computeTtsCacheKey({
      text: result.segments[0]?.text ?? "",
      voiceId: "v",
      modelId: "m",
    });
    const legacyKey = computeTtsCacheKey({ text, voiceId: "v", modelId: "m" });
    expect(passthroughKey).toBe(legacyKey);
  });

  it("returns an empty segments list for an empty/whitespace-only script", () => {
    expect(parseScript("").segments).toEqual([]);
    expect(parseScript("   \n  \n").segments).toEqual([]);
  });
});

describe("parseScript — with markup", () => {
  it("splits into one segment per speaker tag", () => {
    const script = `[speaker:alex] Hola, soy Alex.
[speaker:morgan] Y yo soy Morgan.`;
    const result = parseScript(script, {
      roster: { alex: "voice-1", morgan: "voice-2" },
    });
    expect(result.hasMarkup).toBe(true);
    expect(result.unresolved).toEqual([]);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({
      voiceId: "voice-1",
      speakerName: "alex",
      text: "Hola, soy Alex.",
      index: 0,
    });
    expect(result.segments[1]).toMatchObject({
      voiceId: "voice-2",
      speakerName: "morgan",
      text: "Y yo soy Morgan.",
      index: 1,
    });
  });

  it("treats a raw voice id (no roster match) as the voice id verbatim", () => {
    const script = `[speaker:voice-abc-123] Línea con voice id directo.`;
    const result = parseScript(script);
    expect(result.segments[0]?.voiceId).toBe("voice-abc-123");
    expect(result.segments[0]?.speakerName).toBe("voice-abc-123");
    expect(result.unresolved).toEqual([]);
  });

  it("flags unresolved names when a roster is provided but the name is unknown", () => {
    const script = `[speaker:typo] hola.`;
    const result = parseScript(script, { roster: { alex: "v1" } });
    expect(result.segments[0]?.voiceId).toBe("typo");
    expect(result.unresolved).toEqual(["typo"]);
  });

  it("is case-insensitive on roster lookups", () => {
    const result = parseScript(`[speaker:ALEX] x`, { roster: { alex: "voice-1" } });
    expect(result.segments[0]?.voiceId).toBe("voice-1");
  });

  it("joins multi-line text under the same speaker until the next tag", () => {
    const script = `[speaker:alex] Primera línea.
Segunda línea del mismo speaker.
[speaker:morgan] Otra voz.`;
    const result = parseScript(script, { roster: { alex: "v1", morgan: "v2" } });
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.text).toBe("Primera línea.\nSegunda línea del mismo speaker.");
    expect(result.segments[1]?.text).toBe("Otra voz.");
  });

  it("emits an untagged opening segment (voiceId undefined) when text precedes the first tag", () => {
    const script = `Intro sin speaker.
[speaker:alex] Y aquí entra Alex.`;
    const result = parseScript(script, { roster: { alex: "v1" } });
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({
      voiceId: undefined,
      speakerName: undefined,
      text: "Intro sin speaker.",
    });
    expect(result.segments[1]?.voiceId).toBe("v1");
  });

  it("drops empty segments (tag with no body)", () => {
    const script = `[speaker:alex]
[speaker:morgan] Hola.`;
    const result = parseScript(script, { roster: { alex: "v1", morgan: "v2" } });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.speakerName).toBe("morgan");
  });

  it("accepts the tag even when not on its own line (text on same line)", () => {
    const result = parseScript(`[speaker:alex]Buen día.`);
    expect(result.segments[0]?.text).toBe("Buen día.");
  });
});

describe("parseRosterJson", () => {
  it("returns undefined for empty input", () => {
    expect(parseRosterJson(undefined)).toBeUndefined();
    expect(parseRosterJson(null)).toBeUndefined();
    expect(parseRosterJson("")).toBeUndefined();
    expect(parseRosterJson("   ")).toBeUndefined();
  });

  it("parses a valid JSON object", () => {
    expect(parseRosterJson(`{"alex":"v1","morgan":"v2"}`)).toEqual({
      alex: "v1",
      morgan: "v2",
    });
  });

  it("throws on malformed JSON", () => {
    expect(() => parseRosterJson("{not-json")).toThrow(/invalid JSON/);
  });

  it("throws on non-object input", () => {
    expect(() => parseRosterJson(`"a string"`)).toThrow(/expected a JSON object/);
    expect(() => parseRosterJson(`["a","list"]`)).toThrow(/expected a JSON object/);
  });

  it("throws when a value is not a non-empty string", () => {
    expect(() => parseRosterJson(`{"alex":""}`)).toThrow(/must be a non-empty string/);
    expect(() => parseRosterJson(`{"alex":42}`)).toThrow(/must be a non-empty string/);
  });
});

describe("resolveRoster", () => {
  it("returns undefined when neither env nor override is set", () => {
    mockEnv.MOTION_SHORTS_VOICE_ROSTER = undefined;
    expect(resolveRoster()).toBeUndefined();
  });

  it("uses env when override is missing", () => {
    mockEnv.MOTION_SHORTS_VOICE_ROSTER = `{"alex":"env-voice"}`;
    expect(resolveRoster()).toEqual({ alex: "env-voice" });
  });

  it("merges override on top of env, with override winning conflicts", () => {
    mockEnv.MOTION_SHORTS_VOICE_ROSTER = `{"alex":"env-voice","morgan":"env-morgan"}`;
    expect(resolveRoster({ alex: "episode-voice" })).toEqual({
      alex: "episode-voice",
      morgan: "env-morgan",
    });
  });
});

describe("summariseSpeakers", () => {
  it("counts segments per label in first-appearance order", () => {
    const segments = [
      { voiceId: "v1", speakerName: "alex", text: "a", index: 0 },
      { voiceId: "v2", speakerName: "morgan", text: "b", index: 1 },
      { voiceId: "v1", speakerName: "alex", text: "c", index: 2 },
      { voiceId: "v1", speakerName: "alex", text: "d", index: 3 },
    ];
    expect(summariseSpeakers(segments)).toEqual([
      { label: "alex", segments: 3 },
      { label: "morgan", segments: 1 },
    ]);
  });

  it("labels untagged segments as (default)", () => {
    expect(
      summariseSpeakers([{ voiceId: undefined, speakerName: undefined, text: "x", index: 0 }]),
    ).toEqual([{ label: "(default)", segments: 1 }]);
  });
});

describe("offsetCaptions", () => {
  it("shifts start/end by the given offset", () => {
    const captions: HyperframesCaption[] = [
      { text: "hola", start: 0.0, end: 0.5 },
      { text: " mundo", start: 0.5, end: 1.1 },
    ];
    const shifted = offsetCaptions(captions, 2.5);
    expect(shifted).toEqual([
      { text: "hola", start: 2.5, end: 3.0 },
      { text: " mundo", start: 3.0, end: 3.6 },
    ]);
  });

  it("returns a deep copy at offset 0 (no aliasing)", () => {
    const captions: HyperframesCaption[] = [{ text: "x", start: 0, end: 0.1 }];
    const out = offsetCaptions(captions, 0);
    expect(out).not.toBe(captions);
    expect(out[0]).not.toBe(captions[0]);
    const firstOut = out[0];
    if (firstOut) firstOut.start = 99;
    expect(captions[0]?.start).toBe(0);
  });

  it("treats NaN / negative offsets as 0", () => {
    const captions: HyperframesCaption[] = [{ text: "x", start: 1, end: 2 }];
    expect(offsetCaptions(captions, Number.NaN)).toEqual(captions);
    expect(offsetCaptions(captions, -3)).toEqual(captions);
  });
});

describe("mergeSegmentArtifacts", () => {
  const makeCaption = (text: string, start: number, end: number, confidence?: number) =>
    confidence !== undefined ? { text, start, end, confidence } : { text, start, end };

  it("concatenates audio buffers and re-times captions across boundaries", () => {
    const result = mergeSegmentArtifacts([
      {
        audio: Buffer.from([0x01, 0x02, 0x03]),
        captions: [makeCaption("hola", 0, 0.5, 0.9), makeCaption(" alex", 0.5, 1.0, 0.92)],
        durationSec: 1.0,
        averageConfidence: 0.91,
      },
      {
        audio: Buffer.from([0x04, 0x05]),
        captions: [makeCaption("morgan", 0, 0.6, 0.88)],
        durationSec: 0.6,
        averageConfidence: 0.88,
      },
    ]);
    expect(Buffer.compare(result.audio, Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]))).toBe(0);
    expect(result.captions).toEqual([
      { text: "hola", start: 0, end: 0.5, confidence: 0.9 },
      { text: " alex", start: 0.5, end: 1.0, confidence: 0.92 },
      { text: "morgan", start: 1.0, end: 1.6, confidence: 0.88 },
    ]);
    expect(result.boundaryWarnings).toEqual([]);
  });

  it("emits a boundaryWarning when confidence drops more than the threshold", () => {
    const result = mergeSegmentArtifacts([
      {
        audio: Buffer.from([0x01]),
        captions: [makeCaption("a", 0, 0.5, 0.95)],
        durationSec: 0.5,
        averageConfidence: 0.95,
      },
      {
        audio: Buffer.from([0x02]),
        captions: [makeCaption("b", 0, 0.5, 0.5)],
        durationSec: 0.5,
        averageConfidence: 0.5,
      },
    ]);
    expect(result.boundaryWarnings).toHaveLength(1);
    expect(result.boundaryWarnings[0]).toMatchObject({
      afterSegment: 0,
      previousAvg: 0.95,
      nextAvg: 0.5,
    });
    // (0.95 - 0.5) / 0.95 ≈ 0.4737 → 47.4%
    expect(result.boundaryWarnings[0]?.dropPct).toBeGreaterThan(CAPTION_CONFIDENCE_DROP_WARN * 100);
  });

  it("does not warn for small drops within the threshold", () => {
    const result = mergeSegmentArtifacts([
      {
        audio: Buffer.from([0x01]),
        captions: [makeCaption("a", 0, 0.5, 0.92)],
        durationSec: 0.5,
        averageConfidence: 0.92,
      },
      {
        audio: Buffer.from([0x02]),
        captions: [makeCaption("b", 0, 0.5, 0.88)],
        durationSec: 0.5,
        averageConfidence: 0.88,
      },
    ]);
    expect(result.boundaryWarnings).toEqual([]);
  });

  it("returns empty payload for zero artifacts", () => {
    const result = mergeSegmentArtifacts([]);
    expect(result.audio.length).toBe(0);
    expect(result.captions).toEqual([]);
    expect(result.boundaryWarnings).toEqual([]);
  });
});

describe("averageCaptionConfidence", () => {
  it("returns undefined when no caption carries confidence", () => {
    expect(averageCaptionConfidence([{ text: "x", start: 0, end: 1 }])).toBeUndefined();
  });

  it("averages only the captions that have confidence", () => {
    const avg = averageCaptionConfidence([
      { text: "a", start: 0, end: 1, confidence: 0.8 },
      { text: "b", start: 1, end: 2 },
      { text: "c", start: 2, end: 3, confidence: 1.0 },
    ]);
    expect(avg).toBeCloseTo(0.9, 5);
  });
});

describe("segment-level cache keys (interaction with computeTtsCacheKey)", () => {
  it("changing one segment's text only changes that segment's cache key", () => {
    const baseKeyA = computeTtsCacheKey({
      text: "Hola, soy Alex.",
      voiceId: "v1",
      modelId: "m",
    });
    const baseKeyB = computeTtsCacheKey({
      text: "Y yo Morgan.",
      voiceId: "v2",
      modelId: "m",
    });
    const editedKeyA = computeTtsCacheKey({
      text: "Hola, soy Alex (editado).",
      voiceId: "v1",
      modelId: "m",
    });
    const sameKeyB = computeTtsCacheKey({
      text: "Y yo Morgan.",
      voiceId: "v2",
      modelId: "m",
    });
    expect(editedKeyA).not.toBe(baseKeyA);
    expect(sameKeyB).toBe(baseKeyB);
  });

  it("same text but different voiceId produces a different segment key", () => {
    const a = computeTtsCacheKey({ text: "Hola.", voiceId: "v1", modelId: "m" });
    const b = computeTtsCacheKey({ text: "Hola.", voiceId: "v2", modelId: "m" });
    expect(a).not.toBe(b);
  });
});
