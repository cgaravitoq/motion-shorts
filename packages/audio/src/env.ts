import fs from "node:fs";
import path from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

type RuntimeEnv = Record<string, string | undefined>;

const parseDotenv = (source: string): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
};

const findWorkspaceEnvPath = (startDir: string = import.meta.dirname): string | null => {
  let current = path.resolve(startDir);
  while (true) {
    const envPath = path.join(current, ".env");
    const hasWorkspaceMarker = ["turbo.json", "bun.lockb", "bun.lock"].some((marker) =>
      fs.existsSync(path.join(current, marker)),
    );
    if (hasWorkspaceMarker && fs.existsSync(envPath)) {
      return envPath;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const loadWorkspaceEnv = (runtimeEnv: RuntimeEnv): RuntimeEnv => {
  const envPath = findWorkspaceEnvPath();
  if (!envPath) return runtimeEnv;

  const source = fs.readFileSync(envPath, "utf8");
  for (const [key, value] of parseDotenv(source)) {
    if (!runtimeEnv[key]) {
      runtimeEnv[key] = value;
    }
  }
  return runtimeEnv;
};

export const env = createEnv({
  server: {
    ELEVENLABS_API_KEY: z.string().min(1).optional(),
    ELEVENLABS_MODEL_ID: z.string().min(1).optional(),
    ELEVENLABS_SCRIBE_MODEL: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_ES: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_EN: z.string().min(1).optional(),
    TTS_PROVIDER: z.enum(["elevenlabs", "inworld"]).default("elevenlabs"),
    INWORLD_API_KEY: z.string().min(1).optional(),
    INWORLD_VOICE_ID_ES: z.string().min(1).optional(),
    INWORLD_VOICE_ID_EN: z.string().min(1).optional(),
    INWORLD_TTS_MODEL: z.string().min(1).default("inworld-tts-2"),
    STT_PROVIDER: z.string().min(1).default("elevenlabs"),
    HEYGEN_API_KEY: z.string().min(1).optional(),
    MOTION_SHORTS_BGM_CACHE_DIR: z.string().min(1).optional(),
    MOTION_SHORTS_TTS_CACHE_DIR: z.string().min(1).optional(),
    MOTION_SHORTS_TTS_CACHE_R2: z.enum(["on", "off"]).default("on"),
    MOTION_SHORTS_VOICE_ROSTER: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    R2_ENDPOINT_URL: z.string().min(1).optional(),
    R2_REQUEST_TIMEOUT_MS: z.string().min(1).optional(),
    R2_UPLOAD_GATEWAY_URL: z.string().min(1).optional(),
    R2_UPLOAD_GATEWAY_TOKEN: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID_WRITE: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY_WRITE: z.string().min(1).optional(),
    XDG_CACHE_HOME: z.string().min(1).optional(),
  },
  emptyStringAsUndefined: true,
  runtimeEnv: loadWorkspaceEnv(process.env),
});
