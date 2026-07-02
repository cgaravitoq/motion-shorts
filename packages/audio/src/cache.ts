import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type GetObjectResult, getObject, isR2Configured, putObject } from "@cgaravitoq/r2-client";
import { env } from "./env";
import type { HyperframesCaption } from "./stt-types";

export type CacheMode = "use" | "refresh" | "off" | "local-only";

export interface TtsCacheKeyInputs {
  text: string;
  voiceId: string;
  modelId: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
}

export interface CachedTts {
  audio: Buffer;
  captions: HyperframesCaption[];
}

export type TtsCacheSource = "local-hit" | "r2-hit" | "miss";

export interface CachedTtsLookup {
  payload: CachedTts | null;
  source: TtsCacheSource;
}

export interface ResolveCacheModeArgs {
  flag?: string;
}

const NORMALIZED_VALUES = new Set<CacheMode>(["use", "refresh", "off", "local-only"]);

const DEFAULT_CACHE_SUBDIR = path.join("motion-shorts", "tts");

export const getCacheRoot = (): string => {
  if (env.MOTION_SHORTS_TTS_CACHE_DIR && env.MOTION_SHORTS_TTS_CACHE_DIR.length > 0) {
    return path.resolve(env.MOTION_SHORTS_TTS_CACHE_DIR);
  }
  const xdg = env.XDG_CACHE_HOME && env.XDG_CACHE_HOME.length > 0 ? env.XDG_CACHE_HOME : null;
  const base = xdg ?? path.join(os.homedir(), ".cache");
  return path.join(base, DEFAULT_CACHE_SUBDIR);
};

export const computeTtsCacheKey = (inputs: TtsCacheKeyInputs): string => {
  const payload: Record<string, string | number> = {
    text: inputs.text,
    voiceId: inputs.voiceId,
    modelId: inputs.modelId,
  };
  if (inputs.speed !== undefined) payload.speed = inputs.speed;
  if (inputs.stability !== undefined) payload.stability = inputs.stability;
  if (inputs.similarityBoost !== undefined) payload.similarityBoost = inputs.similarityBoost;

  const serialized = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(serialized).digest("hex");
};

export const cacheEntryDir = (hash: string, root: string = getCacheRoot()): string =>
  path.join(root, hash);

export const cacheEntryPaths = (hash: string, root?: string) => {
  const dir = cacheEntryDir(hash, root);
  return {
    dir,
    audioPath: path.join(dir, "voice.mp3"),
    captionsPath: path.join(dir, "captions.json"),
  };
};

export const readCachedTts = (hash: string, root?: string): CachedTts | null => {
  const { audioPath, captionsPath } = cacheEntryPaths(hash, root);
  if (!fs.existsSync(audioPath) || !fs.existsSync(captionsPath)) return null;
  const audio = fs.readFileSync(audioPath);
  let captions: HyperframesCaption[];
  try {
    captions = JSON.parse(fs.readFileSync(captionsPath, "utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(captions)) return null;
  return { audio, captions };
};

export const writeCachedTts = (
  hash: string,
  payload: CachedTts,
  root?: string,
): { audioPath: string; captionsPath: string } => {
  const { dir, audioPath, captionsPath } = cacheEntryPaths(hash, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(audioPath, payload.audio);
  fs.writeFileSync(captionsPath, JSON.stringify(payload.captions, null, 2));
  return { audioPath, captionsPath };
};

const r2KeyFor = (hash: string, filename: "voice.mp3" | "captions.json") =>
  `tts-cache/${hash}/${filename}`;

export const isTtsCacheR2Enabled = (cacheMode: CacheMode = "use"): boolean => {
  if (cacheMode === "local-only" || cacheMode === "off") return false;
  if (env.MOTION_SHORTS_TTS_CACHE_R2 === "off") return false;
  if (!env.R2_BUCKET) return false;
  return isR2Configured({ bucket: env.R2_BUCKET, env });
};

export const readCachedTtsWithSource = async (
  hash: string,
  { root, cacheMode = "use" }: { root?: string; cacheMode?: CacheMode } = {},
): Promise<CachedTtsLookup> => {
  const local = readCachedTts(hash, root);
  if (local) return { payload: local, source: "local-hit" };
  if (!isTtsCacheR2Enabled(cacheMode) || !env.R2_BUCKET) return { payload: null, source: "miss" };

  let audioObject: GetObjectResult | null;
  let captionsObject: GetObjectResult | null;
  try {
    [audioObject, captionsObject] = await Promise.all([
      getObject({ bucket: env.R2_BUCKET, key: r2KeyFor(hash, "voice.mp3"), env }),
      getObject({ bucket: env.R2_BUCKET, key: r2KeyFor(hash, "captions.json"), env }),
    ]);
  } catch (error) {
    console.warn(
      `[tts-cache] R2 mirror read failed for ${hash.slice(0, 12)}: ${(error as Error).message}`,
    );
    return { payload: null, source: "miss" };
  }
  if (!audioObject || !captionsObject) return { payload: null, source: "miss" };

  let captions: HyperframesCaption[];
  try {
    captions = JSON.parse(captionsObject.body.toString("utf8"));
  } catch {
    return { payload: null, source: "miss" };
  }
  if (!Array.isArray(captions)) return { payload: null, source: "miss" };

  const payload = { audio: audioObject.body, captions };
  writeCachedTts(hash, payload, root);
  return { payload, source: "r2-hit" };
};

export const writeCachedTtsToR2 = async (
  hash: string,
  payload: CachedTts,
  { cacheMode = "use" }: { cacheMode?: CacheMode } = {},
): Promise<boolean> => {
  if (!isTtsCacheR2Enabled(cacheMode) || !env.R2_BUCKET) return false;
  try {
    await Promise.all([
      putObject({
        bucket: env.R2_BUCKET,
        key: r2KeyFor(hash, "voice.mp3"),
        body: payload.audio,
        contentType: "audio/mpeg",
        env,
      }),
      putObject({
        bucket: env.R2_BUCKET,
        key: r2KeyFor(hash, "captions.json"),
        body: JSON.stringify(payload.captions, null, 2),
        contentType: "application/json",
        env,
      }),
    ]);
    return true;
  } catch (error) {
    console.warn(
      `[tts-cache] R2 mirror write failed for ${hash.slice(0, 12)}: ${(error as Error).message}`,
    );
    return false;
  }
};

export const resolveCacheMode = ({ flag }: ResolveCacheModeArgs): CacheMode => {
  if (flag === undefined || flag === null || flag === "") return "use";
  const value = flag.toLowerCase();
  if (NORMALIZED_VALUES.has(value as CacheMode)) return value as CacheMode;
  throw new Error(`--cache must be one of "use" | "refresh" | "off" | "local-only", got "${flag}"`);
};
