import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    ELEVENLABS_API_KEY: z.string().min(1).optional(),
    ELEVENLABS_MODEL_ID: z.string().min(1).optional(),
    ELEVENLABS_SCRIBE_MODEL: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_ES: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_ES_PERSONAL: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_EN: z.string().min(1).optional(),
    TTS_PROVIDER: z.enum(["elevenlabs", "inworld"]).default("elevenlabs"),
    INWORLD_API_KEY: z.string().min(1).optional(),
    INWORLD_VOICE_ID_ES: z.string().min(1).optional(),
    INWORLD_VOICE_ID_EN: z.string().min(1).optional(),
    INWORLD_TTS_MODEL: z.string().min(1).default("inworld-tts-2"),
    STT_PROVIDER: z.string().min(1).default("elevenlabs"),
  },
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
});
