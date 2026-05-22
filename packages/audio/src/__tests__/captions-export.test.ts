import { describe, expect, it } from "vitest";
import { parseCaptionFormats, toSrt, toVtt } from "../captions-export";
import type { HyperframesCaption } from "../stt-types";

const sample: HyperframesCaption[] = [
  { text: "Hola", start: 0, end: 0.42 },
  { text: "mundo", start: 0.42, end: 0.9 },
  { text: "este", start: 1.2, end: 1.55 },
  { text: "es", start: 1.55, end: 1.7 },
  { text: "un", start: 1.7, end: 1.82 },
  { text: "test.", start: 1.82, end: 2.34 },
];

describe("toSrt", () => {
  it("emits sequential cues with comma millisecond separator", () => {
    const srt = toSrt(sample);
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:02,340\nHola mundo este es un test.\n");
  });

  it("splits cues that exceed the duration cap", () => {
    const captions: HyperframesCaption[] = [
      { text: "uno", start: 0, end: 1 },
      { text: "dos", start: 1, end: 4 },
      { text: "tres", start: 4, end: 8 },
    ];
    const srt = toSrt(captions, { maxCueDurationSec: 5, maxCueChars: 200 });
    expect(srt).toContain("00:00:00,000 --> 00:00:04,000\nuno dos");
    expect(srt).toContain("00:00:04,000 --> 00:00:08,000\ntres");
  });

  it("splits cues that exceed the character cap", () => {
    const captions: HyperframesCaption[] = [
      { text: "alpha", start: 0, end: 0.5 },
      { text: "bravo", start: 0.5, end: 1 },
      { text: "charlie", start: 1, end: 1.5 },
    ];
    const srt = toSrt(captions, { maxCueChars: 12 });
    const cueIndexes = srt.match(/^\d+$/gm) ?? [];
    expect(cueIndexes).toEqual(["1", "2"]);
  });

  it("handles hours / minutes correctly", () => {
    const captions: HyperframesCaption[] = [{ text: "late", start: 3661.5, end: 3662.25 }];
    expect(toSrt(captions)).toContain("01:01:01,500 --> 01:01:02,250");
  });

  it("returns empty string for empty input", () => {
    expect(toSrt([])).toBe("");
  });

  it("skips whitespace-only tokens", () => {
    const captions: HyperframesCaption[] = [
      { text: "  ", start: 0, end: 0.1 },
      { text: "hola", start: 0.1, end: 0.5 },
    ];
    expect(toSrt(captions)).toBe("1\n00:00:00,100 --> 00:00:00,500\nhola\n");
  });
});

describe("toVtt", () => {
  it("emits a WEBVTT header and dot millisecond separator", () => {
    const vtt = toVtt(sample);
    expect(vtt).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:02.340\nHola mundo este es un test.\n");
  });

  it("emits header-only output for empty input", () => {
    expect(toVtt([])).toBe("WEBVTT\n\n");
  });

  it("uses dots in timestamps even for hour-long offsets", () => {
    const captions: HyperframesCaption[] = [{ text: "late", start: 3661.5, end: 3662.25 }];
    expect(toVtt(captions)).toContain("01:01:01.500 --> 01:01:02.250");
  });
});

describe("parseCaptionFormats", () => {
  it("parses a comma-separated list, deduping", () => {
    expect(parseCaptionFormats("srt,vtt,srt")).toEqual(["srt", "vtt"]);
  });

  it("returns an empty list for null / empty input", () => {
    expect(parseCaptionFormats(undefined)).toEqual([]);
    expect(parseCaptionFormats("")).toEqual([]);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseCaptionFormats(" SRT , Vtt ")).toEqual(["srt", "vtt"]);
  });

  it("throws on unknown formats", () => {
    expect(() => parseCaptionFormats("srt,ass")).toThrow(/unknown caption format/);
  });
});
