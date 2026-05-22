import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheEntryPaths,
  computeTtsCacheKey,
  getCacheRoot,
  readCachedTts,
  resolveCacheMode,
  type TtsCacheKeyInputs,
  writeCachedTts,
} from "../cache";

const mockEnv = vi.hoisted(() => ({
  MOTION_SHORTS_TTS_CACHE_DIR: undefined as string | undefined,
  XDG_CACHE_HOME: undefined as string | undefined,
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

const makeTmpDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "tts-cache-"));

const baseInputs = (): TtsCacheKeyInputs => ({
  text: "hola mundo",
  voiceId: "voice-es-fixture",
  modelId: "eleven_v3",
  speed: 1.04,
  stability: 0.5,
  similarityBoost: 0.82,
});

describe("computeTtsCacheKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeTtsCacheKey(baseInputs());
    const b = computeTtsCacheKey(baseInputs());
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each<keyof TtsCacheKeyInputs>([
    "text",
    "voiceId",
    "modelId",
    "speed",
    "stability",
    "similarityBoost",
  ])("changes when %s changes", (field) => {
    const base = baseInputs();
    const a = computeTtsCacheKey(base);
    const mutated: TtsCacheKeyInputs = { ...base };
    if (field === "text" || field === "voiceId" || field === "modelId") {
      mutated[field] = `${base[field]}-x`;
    } else {
      const current = base[field] ?? 0;
      mutated[field] = current + 0.01;
    }
    const b = computeTtsCacheKey(mutated);
    expect(b).not.toBe(a);
  });

  it("treats undefined tuning as distinct from the same value explicitly set", () => {
    const a = computeTtsCacheKey({ ...baseInputs(), speed: undefined });
    const b = computeTtsCacheKey({ ...baseInputs(), speed: 1.04 });
    expect(a).not.toBe(b);
  });

  it("ignores key order in the inputs object (object spread keeps insertion order)", () => {
    const a = computeTtsCacheKey({
      text: "t",
      voiceId: "v",
      modelId: "m",
      similarityBoost: 0.5,
      stability: 0.3,
      speed: 1.0,
    });
    const b = computeTtsCacheKey({
      speed: 1.0,
      stability: 0.3,
      similarityBoost: 0.5,
      modelId: "m",
      voiceId: "v",
      text: "t",
    });
    expect(a).toBe(b);
  });
});

describe("getCacheRoot", () => {
  beforeEach(() => {
    mockEnv.MOTION_SHORTS_TTS_CACHE_DIR = undefined;
    mockEnv.XDG_CACHE_HOME = undefined;
  });

  it("honors MOTION_SHORTS_TTS_CACHE_DIR when set", () => {
    mockEnv.MOTION_SHORTS_TTS_CACHE_DIR = "/tmp/my-cache";
    expect(getCacheRoot()).toBe("/tmp/my-cache");
  });

  it("falls back to XDG_CACHE_HOME/motion-shorts/tts", () => {
    mockEnv.XDG_CACHE_HOME = "/tmp/xdg";
    expect(getCacheRoot()).toBe(path.join("/tmp/xdg", "motion-shorts", "tts"));
  });

  it("falls back to ~/.cache/motion-shorts/tts when nothing is set", () => {
    expect(getCacheRoot()).toBe(path.join(os.homedir(), ".cache", "motion-shorts", "tts"));
  });
});

describe("read/writeCachedTts", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns null on miss", () => {
    expect(readCachedTts("deadbeef", tmpRoot)).toBeNull();
  });

  it("writes then reads back identical audio + captions", () => {
    const hash = computeTtsCacheKey(baseInputs());
    const audio = Buffer.from([0x49, 0x44, 0x33, 0x01]);
    const captions = [{ text: "hola", start: 0, end: 0.5 }];
    writeCachedTts(hash, { audio, captions }, tmpRoot);

    const hit = readCachedTts(hash, tmpRoot);
    expect(hit).not.toBeNull();
    expect(Buffer.compare(hit?.audio ?? Buffer.alloc(0), audio)).toBe(0);
    expect(hit?.captions).toEqual(captions);
  });

  it("treats a partially-written entry (audio without captions) as a miss", () => {
    const hash = "1".repeat(64);
    const { dir, audioPath } = cacheEntryPaths(hash, tmpRoot);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(audioPath, Buffer.from([0x00]));
    expect(readCachedTts(hash, tmpRoot)).toBeNull();
  });

  it("treats a corrupt captions.json as a miss", () => {
    const hash = "2".repeat(64);
    const { dir, audioPath, captionsPath } = cacheEntryPaths(hash, tmpRoot);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(audioPath, Buffer.from([0x00]));
    fs.writeFileSync(captionsPath, "{not-json");
    expect(readCachedTts(hash, tmpRoot)).toBeNull();
  });
});

describe("resolveCacheMode", () => {
  it("defaults to 'use' when no flag is passed", () => {
    expect(resolveCacheMode({})).toBe("use");
    expect(resolveCacheMode({ flag: undefined })).toBe("use");
    expect(resolveCacheMode({ flag: "" })).toBe("use");
  });

  it("accepts 'use', 'refresh', 'off' (case-insensitive)", () => {
    expect(resolveCacheMode({ flag: "use" })).toBe("use");
    expect(resolveCacheMode({ flag: "refresh" })).toBe("refresh");
    expect(resolveCacheMode({ flag: "off" })).toBe("off");
    expect(resolveCacheMode({ flag: "REFRESH" })).toBe("refresh");
  });

  it("throws on an unknown flag value", () => {
    expect(() => resolveCacheMode({ flag: "yes" })).toThrow(/--cache must be one of/);
  });
});
