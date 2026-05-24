import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BgmTrackNotFoundError, getBgmCacheRoot, resolveBgmPath } from "../bgm-resolver";

const mockEnv = vi.hoisted(() => ({
  MOTION_SHORTS_BGM_CACHE_DIR: undefined as string | undefined,
  R2_ACCOUNT_ID: undefined as string | undefined,
  R2_BUCKET: undefined as string | undefined,
  R2_UPLOAD_GATEWAY_URL: undefined as string | undefined,
  R2_UPLOAD_GATEWAY_TOKEN: undefined as string | undefined,
  R2_ACCESS_KEY_ID_WRITE: undefined as string | undefined,
  R2_SECRET_ACCESS_KEY_WRITE: undefined as string | undefined,
  XDG_CACHE_HOME: undefined as string | undefined,
}));

const r2Mocks = vi.hoisted(() => ({
  getObject: vi.fn(),
  isR2Configured: vi.fn(),
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

vi.mock("@cgaravitoq/r2-client", () => r2Mocks);

const resetEnv = () => {
  mockEnv.MOTION_SHORTS_BGM_CACHE_DIR = undefined;
  mockEnv.R2_ACCOUNT_ID = undefined;
  mockEnv.R2_BUCKET = undefined;
  mockEnv.R2_UPLOAD_GATEWAY_URL = undefined;
  mockEnv.R2_UPLOAD_GATEWAY_TOKEN = undefined;
  mockEnv.R2_ACCESS_KEY_ID_WRITE = undefined;
  mockEnv.R2_SECRET_ACCESS_KEY_WRITE = undefined;
  mockEnv.XDG_CACHE_HOME = undefined;
};

const makeTmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "bgm-cache-"));

describe("resolveBgmPath", () => {
  let tmpRoot: string;

  beforeEach(() => {
    resetEnv();
    vi.resetAllMocks();
    tmpRoot = makeTmpDir();
    mockEnv.MOTION_SHORTS_BGM_CACHE_DIR = tmpRoot;
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it.each(["/abs/path.mp3", "./relative.mp3", "relative/path.mp3"])(
    "resolves local path %s without R2",
    async (input) => {
      await expect(resolveBgmPath(input)).resolves.toBe(path.resolve(input));
      expect(r2Mocks.getObject).not.toHaveBeenCalled();
    },
  );

  it("returns the cache path on bgm cache hit without R2", async () => {
    const cachedPath = path.join(tmpRoot, "warm-cinematic.mp3");
    fs.writeFileSync(cachedPath, Buffer.from("cached-audio"));

    await expect(resolveBgmPath("bgm:warm-cinematic")).resolves.toBe(cachedPath);
    expect(r2Mocks.getObject).not.toHaveBeenCalled();
    expect(r2Mocks.isR2Configured).not.toHaveBeenCalled();
  });

  it("hydrates a bgm cache miss from R2", async () => {
    mockEnv.R2_BUCKET = "motion-shorts";
    r2Mocks.isR2Configured.mockReturnValue(true);
    r2Mocks.getObject.mockResolvedValue({ body: Buffer.from("r2-audio"), contentType: "audio/mpeg" });

    const resolved = await resolveBgmPath("bgm:warm-cinematic");

    expect(resolved).toBe(path.join(tmpRoot, "warm-cinematic.mp3"));
    expect(fs.readFileSync(resolved, "utf8")).toBe("r2-audio");
    expect(r2Mocks.getObject).toHaveBeenCalledWith({
      bucket: "motion-shorts",
      key: "bgm/warm-cinematic.mp3",
      env: mockEnv,
    });
  });

  it("throws BgmTrackNotFoundError when R2 returns 404", async () => {
    mockEnv.R2_BUCKET = "motion-shorts";
    r2Mocks.isR2Configured.mockReturnValue(true);
    r2Mocks.getObject.mockResolvedValue(null);

    await expect(resolveBgmPath("bgm:missing-track")).rejects.toThrow(BgmTrackNotFoundError);
    await expect(resolveBgmPath("bgm:missing-track")).rejects.toThrow(
      'BGM track "missing-track" was not found in R2 bucket "motion-shorts" at key "bgm/missing-track.mp3".',
    );
  });

  it("throws a clean remediation hint when R2 env is missing", async () => {
    await expect(resolveBgmPath("bgm:warm-cinematic")).rejects.toThrow(
      /Set R2_BUCKET plus either R2_UPLOAD_GATEWAY_URL\/R2_UPLOAD_GATEWAY_TOKEN or R2_ACCOUNT_ID\/R2_ACCESS_KEY_ID_WRITE\/R2_SECRET_ACCESS_KEY_WRITE/,
    );
    expect(r2Mocks.getObject).not.toHaveBeenCalled();
  });
});

describe("getBgmCacheRoot", () => {
  beforeEach(() => {
    resetEnv();
  });

  it("honors MOTION_SHORTS_BGM_CACHE_DIR", () => {
    mockEnv.MOTION_SHORTS_BGM_CACHE_DIR = "/tmp/bgm-cache";
    expect(getBgmCacheRoot()).toBe("/tmp/bgm-cache");
  });

  it("falls back to XDG_CACHE_HOME/motion-shorts/bgm", () => {
    mockEnv.XDG_CACHE_HOME = "/tmp/xdg";
    expect(getBgmCacheRoot()).toBe(path.join("/tmp/xdg", "motion-shorts", "bgm"));
  });
});
