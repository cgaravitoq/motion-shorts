import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheEntryPaths,
  computeTtsCacheKey,
  getCacheRoot,
  isTtsCacheR2Enabled,
  readCachedTts,
  readCachedTtsWithSource,
  resolveCacheMode,
  type TtsCacheKeyInputs,
  writeCachedTts,
  writeCachedTtsToR2,
} from "../cache";

const mockEnv = vi.hoisted(() => ({
  MOTION_SHORTS_TTS_CACHE_DIR: undefined as string | undefined,
  MOTION_SHORTS_TTS_CACHE_R2: "on" as "on" | "off",
  R2_ACCOUNT_ID: undefined as string | undefined,
  R2_BUCKET: undefined as string | undefined,
  R2_UPLOAD_GATEWAY_URL: undefined as string | undefined,
  R2_UPLOAD_GATEWAY_TOKEN: undefined as string | undefined,
  XDG_CACHE_HOME: undefined as string | undefined,
}));

const r2Mocks = vi.hoisted(() => ({
  getObject: vi.fn(),
  isR2Configured: vi.fn(),
  putObject: vi.fn(),
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

vi.mock("@cgaravitoq/r2-client", () => r2Mocks);

const resetEnv = () => {
  mockEnv.MOTION_SHORTS_TTS_CACHE_DIR = undefined;
  mockEnv.MOTION_SHORTS_TTS_CACHE_R2 = "on";
  mockEnv.R2_ACCOUNT_ID = undefined;
  mockEnv.R2_BUCKET = undefined;
  mockEnv.R2_UPLOAD_GATEWAY_URL = undefined;
  mockEnv.R2_UPLOAD_GATEWAY_TOKEN = undefined;
  mockEnv.XDG_CACHE_HOME = undefined;
};

const makeTmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "tts-cache-"));

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
    resetEnv();
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
    resetEnv();
    vi.resetAllMocks();
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

  it("reports local-hit before checking R2", async () => {
    const hash = computeTtsCacheKey(baseInputs());
    const audio = Buffer.from([0x49, 0x44, 0x33, 0x01]);
    const captions = [{ text: "hola", start: 0, end: 0.5 }];
    writeCachedTts(hash, { audio, captions }, tmpRoot);

    const hit = await readCachedTtsWithSource(hash, { root: tmpRoot });
    expect(hit.source).toBe("local-hit");
    expect(hit.payload?.captions).toEqual(captions);
    expect(r2Mocks.getObject).not.toHaveBeenCalled();
  });

  it("hydrates local cache from an R2 hit", async () => {
    mockEnv.R2_ACCOUNT_ID = "account";
    mockEnv.R2_BUCKET = "bucket";
    r2Mocks.isR2Configured.mockReturnValue(true);
    const audio = Buffer.from("audio");
    const captions = [{ text: "hola", start: 0, end: 0.5 }];
    r2Mocks.getObject
      .mockResolvedValueOnce({ body: audio, contentType: "audio/mpeg" })
      .mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify(captions)),
        contentType: "application/json",
      });

    const hit = await readCachedTtsWithSource("3".repeat(64), { root: tmpRoot });
    expect(hit.source).toBe("r2-hit");
    expect(hit.payload?.captions).toEqual(captions);
    expect(readCachedTts("3".repeat(64), tmpRoot)?.captions).toEqual(captions);
  });

  it("returns miss when either R2 object is missing", async () => {
    mockEnv.R2_ACCOUNT_ID = "account";
    mockEnv.R2_BUCKET = "bucket";
    r2Mocks.isR2Configured.mockReturnValue(true);
    r2Mocks.getObject
      .mockResolvedValueOnce({ body: Buffer.from("audio"), contentType: "audio/mpeg" })
      .mockResolvedValueOnce(null);

    const hit = await readCachedTtsWithSource("4".repeat(64), { root: tmpRoot });
    expect(hit).toEqual({ payload: null, source: "miss" });
  });

  it("skips R2 when disabled by env or local-only mode", async () => {
    mockEnv.R2_ACCOUNT_ID = "account";
    mockEnv.R2_BUCKET = "bucket";
    r2Mocks.isR2Configured.mockReturnValue(true);
    mockEnv.MOTION_SHORTS_TTS_CACHE_R2 = "off";
    expect(isTtsCacheR2Enabled()).toBe(false);
    expect(await readCachedTtsWithSource("5".repeat(64), { root: tmpRoot })).toEqual({
      payload: null,
      source: "miss",
    });
    mockEnv.MOTION_SHORTS_TTS_CACHE_R2 = "on";
    expect(
      await readCachedTtsWithSource("5".repeat(64), { root: tmpRoot, cacheMode: "local-only" }),
    ).toEqual({ payload: null, source: "miss" });
    expect(r2Mocks.getObject).not.toHaveBeenCalled();
  });

  it("falls back to local-only when R2 env is missing", async () => {
    expect(isTtsCacheR2Enabled()).toBe(false);
    expect(await readCachedTtsWithSource("6".repeat(64), { root: tmpRoot })).toEqual({
      payload: null,
      source: "miss",
    });
    expect(r2Mocks.getObject).not.toHaveBeenCalled();
  });

  it("mirrors writes to R2 best-effort", async () => {
    mockEnv.R2_ACCOUNT_ID = "account";
    mockEnv.R2_BUCKET = "bucket";
    r2Mocks.isR2Configured.mockReturnValue(true);
    r2Mocks.putObject.mockResolvedValue(undefined);
    await expect(
      writeCachedTtsToR2("7".repeat(64), { audio: Buffer.from("audio"), captions: [] }),
    ).resolves.toBe(true);
    expect(r2Mocks.putObject).toHaveBeenCalledTimes(2);

    r2Mocks.putObject.mockRejectedValueOnce(new Error("boom"));
    await expect(
      writeCachedTtsToR2("8".repeat(64), { audio: Buffer.from("audio"), captions: [] }),
    ).resolves.toBe(false);
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
    expect(resolveCacheMode({ flag: "local-only" })).toBe("local-only");
    expect(resolveCacheMode({ flag: "REFRESH" })).toBe("refresh");
  });

  it("throws on an unknown flag value", () => {
    expect(() => resolveCacheMode({ flag: "yes" })).toThrow(/--cache must be one of/);
  });
});
