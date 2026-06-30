import { InworldTTS } from "@inworld/tts";
import { env } from "./env";
import { BaseTTSProvider, type ProviderConstructorOptions } from "./tts-provider";
import type { Lang, SynthesizeOptions } from "./types";

type InworldTTSClient = ReturnType<typeof InworldTTS>;

let warnedElevenLabsOnlyOptions = false;

const resolveVoiceId = (lang: Lang, override?: string): string | undefined => {
  if (override) return override;
  return lang === "es" ? env.INWORLD_VOICE_ID_ES : env.INWORLD_VOICE_ID_EN;
};

const toLanguageCode = (lang: Lang): "es-ES" | "en-US" => (lang === "es" ? "es-ES" : "en-US");

const resolveSpeakingRate = (speed: number | undefined): number | undefined => {
  if (speed === undefined) return undefined;
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 1.5) {
    throw new Error(
      `InworldTTSProvider.synthesize: speed=${speed} outside Inworld's supported range [0.5, 1.5]`,
    );
  }
  return speed;
};

const warnIgnoredOptionsOnce = (opts: SynthesizeOptions) => {
  if (
    warnedElevenLabsOnlyOptions ||
    (opts.stability === undefined && opts.similarityBoost === undefined && opts.style === undefined)
  ) {
    return;
  }
  warnedElevenLabsOnlyOptions = true;
  console.warn(
    "[inworld-tts] stability/similarityBoost/style are ElevenLabs-only and ignored on Inworld.",
  );
};

export class InworldTTSProvider extends BaseTTSProvider<InworldTTSClient> {
  constructor(opts: ProviderConstructorOptions<InworldTTSClient> = {}) {
    super(
      {
        name: "inworld",
        displayName: "Inworld",
        emptyBufferNoun: "buffer",
        apiKeyEnvName: "INWORLD_API_KEY",
        readApiKey: () => env.INWORLD_API_KEY,
        createClient: (apiKey) => InworldTTS({ apiKey }),
        resolveDefaults: ({ lang, voice, model }) => {
          const voiceId = resolveVoiceId(lang, voice);
          if (!voiceId) {
            throw new Error(
              `No Inworld voice ID configured for lang="${lang}". Set INWORLD_VOICE_ID_${lang.toUpperCase()} or pass opts.voice.`,
            );
          }
          return { voiceId, modelId: model ?? env.INWORLD_TTS_MODEL };
        },
        synthesize: async ({ client, text, voiceId, modelId, opts }) => {
          const speakingRate = resolveSpeakingRate(opts.speed);
          warnIgnoredOptionsOnce(opts);

          const request: Parameters<typeof client.generate>[0] = {
            text,
            voice: voiceId,
            model: modelId,
            encoding: "MP3",
            language: toLanguageCode(opts.lang),
          };
          if (speakingRate !== undefined) {
            request.speakingRate = speakingRate;
          }

          const audio = await client.generate(request);
          return Buffer.from(audio);
        },
      },
      opts,
    );
  }
}
