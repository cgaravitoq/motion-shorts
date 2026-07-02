import {
  ElevenLabsTTSProvider,
  resolveElevenLabsModelId,
  resolveElevenLabsVoiceId,
} from "./elevenlabs";
import { env } from "./env";
import { InworldTTSProvider } from "./inworld";
import type { Lang, TTSProvider } from "./types";

type TTSProviderName = typeof env.TTS_PROVIDER;

export const getTTSProviderName = (): TTSProviderName => env.TTS_PROVIDER;

export const resolveTTSProviderDefaults = (opts: {
  providerName?: TTSProviderName;
  lang: Lang;
  voice?: string;
  model?: string;
}): { voiceId: string; modelId: string } => {
  const providerName = opts.providerName ?? getTTSProviderName();
  switch (providerName) {
    case "elevenlabs": {
      const voiceId = resolveElevenLabsVoiceId(opts.lang, opts.voice);
      if (!voiceId) {
        throw new Error(
          `No voice ID configured for lang="${opts.lang}". Set ELEVENLABS_VOICE_ID_${opts.lang.toUpperCase()} or pass opts.voice.`,
        );
      }
      return { voiceId, modelId: resolveElevenLabsModelId(opts.model) };
    }
    case "inworld": {
      const voiceId =
        opts.voice ?? (opts.lang === "es" ? env.INWORLD_VOICE_ID_ES : env.INWORLD_VOICE_ID_EN);
      if (!voiceId) {
        throw new Error(
          `No Inworld voice ID configured for lang="${opts.lang}". Set INWORLD_VOICE_ID_${opts.lang.toUpperCase()} or pass opts.voice.`,
        );
      }
      return { voiceId, modelId: opts.model ?? env.INWORLD_TTS_MODEL };
    }
    default: {
      const _exhaustive: never = providerName;
      throw new Error(`Unknown TTS_PROVIDER: ${_exhaustive}`);
    }
  }
};

export const createTTSProvider = (
  providerName: TTSProviderName,
  opts: { apiKey?: string } = {},
): TTSProvider => {
  switch (providerName) {
    case "elevenlabs":
      return new ElevenLabsTTSProvider(opts);
    case "inworld":
      return new InworldTTSProvider(opts);
    default: {
      const _exhaustive: never = providerName;
      throw new Error(`Unknown TTS_PROVIDER: ${_exhaustive}`);
    }
  }
};

export const getTTSProvider = (): TTSProvider => createTTSProvider(env.TTS_PROVIDER);
