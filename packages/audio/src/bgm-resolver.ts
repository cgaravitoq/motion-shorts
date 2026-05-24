import { getObject, isR2Configured } from "@cgaravitoq/r2-client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env } from "./env";

const DEFAULT_BGM_CACHE_SUBDIR = path.join("motion-shorts", "bgm");

export class BgmTrackNotFoundError extends Error {
  constructor(trackName: string, bucket: string, key: string) {
    super(`BGM track "${trackName}" was not found in R2 bucket "${bucket}" at key "${key}".`);
    this.name = "BgmTrackNotFoundError";
  }
}

export const getBgmCacheRoot = (): string => {
  if (env.MOTION_SHORTS_BGM_CACHE_DIR && env.MOTION_SHORTS_BGM_CACHE_DIR.length > 0) {
    return path.resolve(env.MOTION_SHORTS_BGM_CACHE_DIR);
  }
  const xdg = env.XDG_CACHE_HOME && env.XDG_CACHE_HOME.length > 0 ? env.XDG_CACHE_HOME : null;
  const base = xdg ?? path.join(os.homedir(), ".cache");
  return path.join(base, DEFAULT_BGM_CACHE_SUBDIR);
};

const requireBgmR2Config = (trackName: string, key: string): string => {
  const bucket = env.R2_BUCKET;
  if (!bucket || !isR2Configured({ bucket, env })) {
    throw new Error(
      `Cannot hydrate BGM track "${trackName}" from R2 key "${key}" because R2 is not configured. ` +
        "Set R2_BUCKET plus either R2_UPLOAD_GATEWAY_URL/R2_UPLOAD_GATEWAY_TOKEN or " +
        "R2_ACCOUNT_ID/R2_ACCESS_KEY_ID_WRITE/R2_SECRET_ACCESS_KEY_WRITE.",
    );
  }
  return bucket;
};

/**
 * Resolve a --bgm argument to a local file path.
 *
 * - "bgm:<name>" → hydrate from R2 bgm/<name>.mp3 into ~/.cache/motion-shorts/bgm/<name>.mp3
 * - "./path" or "/abs/path" or "path/relative.mp3" → return path unchanged (after resolve)
 */
export async function resolveBgmPath(arg: string): Promise<string> {
  if (!arg.startsWith("bgm:")) return path.resolve(arg);

  const trackName = arg.slice("bgm:".length).trim();
  if (!trackName) throw new Error("BGM track name is required after bgm:. Example: --bgm=bgm:warm-cinematic");
  if (!/^[A-Za-z0-9._-]+$/.test(trackName) || trackName === "." || trackName.startsWith(".") || trackName.includes("..")) {
    throw new Error(
      `Invalid BGM track name "${trackName}". Allowed characters: letters, digits, dot, dash, underscore.`,
    );
  }

  const key = `bgm/${trackName}.mp3`;
  const cachePath = path.join(getBgmCacheRoot(), `${trackName}.mp3`);
  if (fs.existsSync(cachePath)) return cachePath;

  const bucket = requireBgmR2Config(trackName, key);
  const object = await getObject({ bucket, key, env });
  if (!object) throw new BgmTrackNotFoundError(trackName, bucket, key);

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const tmpPath = `${cachePath}.tmp`;
  // Write then rename so interrupted downloads never leave a partial cache hit behind.
  fs.writeFileSync(tmpPath, object.body);
  fs.renameSync(tmpPath, cachePath);
  return cachePath;
}
