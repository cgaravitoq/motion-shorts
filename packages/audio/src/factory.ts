import { ElevenLabsTTSProvider } from "./elevenlabs";
import { env } from "./env";
import { InworldTTSProvider } from "./inworld";
import type { TTSProvider } from "./types";

export const getTTSProvider = (): TTSProvider => {
  switch (env.TTS_PROVIDER) {
    case "elevenlabs":
      return new ElevenLabsTTSProvider();
    case "inworld":
      return new InworldTTSProvider();
    default: {
      const _exhaustive: never = env.TTS_PROVIDER;
      throw new Error(`Unknown TTS_PROVIDER: ${_exhaustive}`);
    }
  }
};
