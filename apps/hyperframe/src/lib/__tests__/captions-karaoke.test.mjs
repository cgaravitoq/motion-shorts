import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SOURCE_PATH = path.resolve(import.meta.dir, "../captions-karaoke.js");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

const loadNormalize = () => {
  const fakeWindow = {};
  const warn = mock(() => {});
  const sandbox = { window: fakeWindow, console: { warn, error: () => {} } };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { normalize: fakeWindow.__hf.normalizeCaptions, warn };
};

describe("captions-karaoke normalize()", () => {
  let normalize;
  let warn;

  beforeEach(() => {
    ({ normalize, warn } = loadNormalize());
  });

  afterEach(() => {
    normalize = undefined;
    warn = undefined;
  });

  it("keeps valid entries with start < end", () => {
    const result = normalize([{ text: "hello", start: 0, end: 0.5 }]);
    expect(result).toEqual([{ text: "hello", start: 0, end: 0.5 }]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("drops entries with reversed timestamps (start > end) and warns with the original entry", () => {
    const bad = { text: "oops", start: 1.2, end: 0.4 };
    const result = normalize([bad]);
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message, payload] = warn.mock.calls[0];
    expect(message).toContain("reversed or zero-length");
    expect(payload).toBe(bad);
  });

  it("drops zero-length entries (start === end) and warns", () => {
    const bad = { text: "zero", start: 1, end: 1 };
    const result = normalize([bad]);
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toBe(bad);
  });

  it("drops entries missing start without warning", () => {
    const result = normalize([{ text: "no-start", end: 0.5 }]);
    expect(result).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("drops entries missing end without warning", () => {
    const result = normalize([{ text: "no-end", start: 0.1 }]);
    expect(result).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("filters mixed input, keeping only well-formed entries", () => {
    const result = normalize([
      { text: "ok", start: 0, end: 0.3 },
      { text: "reversed", start: 1, end: 0.9 },
      { text: "zero", start: 2, end: 2 },
      { text: "ok2", start: 3, end: 3.4, confidence: 0.91 },
    ]);
    expect(result).toEqual([
      { text: "ok", start: 0, end: 0.3 },
      { text: "ok2", start: 3, end: 3.4, confidence: 0.91 },
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
