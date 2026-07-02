import { loadWorkspaceEnv } from "@cgaravitoq/r2-client";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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
  runtimeEnv: loadWorkspaceEnv(process.env).runtimeEnv,
});
