/**
 * Local TTS cache keyed by sha256 of the inputs that affect the synthesised
 * audio. A cache hit returns both the audio bytes and the matching captions,
 * so re-running `bun run audio` on an unchanged script + voice + tuning is a
 * no-op against ElevenLabs.
 *
 * Layout: `<cacheRoot>/<hash>/{voice.mp3, captions.json}`. The cache root
 * defaults to `~/.cache/motion-shorts/tts/`; override with
 * `MOTION_SHORTS_TTS_CACHE_DIR` (handled in `env.ts`).
 *
 * Captions are part of the cache because the run output is the
 * voice+captions pair, and we want a cache hit to also short-circuit STT.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env } from "./env";
import type { HyperframesCaption } from "./stt-types";

export type CacheMode = "use" | "refresh" | "off";

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

export interface ResolveCacheModeArgs {
  flag?: string;
}

const NORMALIZED_VALUES = new Set<CacheMode>(["use", "refresh", "off"]);

const DEFAULT_CACHE_SUBDIR = path.join("motion-shorts", "tts");

export const getCacheRoot = (): string => {
  if (env.MOTION_SHORTS_TTS_CACHE_DIR && env.MOTION_SHORTS_TTS_CACHE_DIR.length > 0) {
    return path.resolve(env.MOTION_SHORTS_TTS_CACHE_DIR);
  }
  // Honor XDG when set; otherwise fall back to `~/.cache` (the linux default
  // and a sane spot on macOS too — we don't store user-facing files here).
  const xdg = env.XDG_CACHE_HOME && env.XDG_CACHE_HOME.length > 0 ? env.XDG_CACHE_HOME : null;
  const base = xdg ?? path.join(os.homedir(), ".cache");
  return path.join(base, DEFAULT_CACHE_SUBDIR);
};

/**
 * Stable, order-independent hash over the inputs that materially affect TTS
 * output. Undefined tuning values are excluded so adding a flag with the
 * provider default doesn't invalidate prior cache entries.
 */
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
    // Corrupt entry — treat as miss; the caller will overwrite on success.
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

export const resolveCacheMode = ({ flag }: ResolveCacheModeArgs): CacheMode => {
  if (flag === undefined || flag === null || flag === "") return "use";
  const value = flag.toLowerCase();
  if (NORMALIZED_VALUES.has(value as CacheMode)) return value as CacheMode;
  throw new Error(`--cache must be one of "use" | "refresh" | "off", got "${flag}"`);
};
