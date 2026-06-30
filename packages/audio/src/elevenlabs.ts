import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "./env";
import { BaseTTSProvider, type ProviderConstructorOptions } from "./tts-provider";
import type { Lang } from "./types";

export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_v3";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128" as const;

/**
 * Spanish narration preset, tuned for a peninsular Spanish narrator on
 * eleven_v3. Cloned voices are sensitive to style/stability changes —
 * lowering stability or adding style can duplicate words in short technical
 * scripts, so leave the defaults unless A/B-testing per call.
 *
 * Override per call (e.g. `--stability=0.35 --similarity-boost=0.75 --speed=1.0`
 * for a 3-5 s hook intro) — per-call values take precedence.
 *
 * `style` keeps the ElevenLabs default (0 / flat). Use it only per-call after
 * listening to the generated MP3 and checking Scribe captions.
 */
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.82,
  speed: 1.04,
} as const;

const resolveVoiceId = (lang: Lang, override?: string): string | undefined => {
  if (override) return override;
  return lang === "es" ? env.ELEVENLABS_VOICE_ID_ES : env.ELEVENLABS_VOICE_ID_EN;
};

export const resolveElevenLabsVoiceId = (lang: Lang, override?: string): string | undefined =>
  resolveVoiceId(lang, override);

export const resolveElevenLabsModelId = (override?: string): string =>
  override ?? env.ELEVENLABS_MODEL_ID ?? DEFAULT_ELEVENLABS_MODEL_ID;

const streamToBuffer = async (stream: ReadableStream<Uint8Array>): Promise<Buffer> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
};

export class ElevenLabsTTSProvider extends BaseTTSProvider<ElevenLabsClient> {
  constructor(opts: ProviderConstructorOptions<ElevenLabsClient> = {}) {
    super(
      {
        name: "elevenlabs",
        displayName: "ElevenLabs",
        emptyBufferNoun: "stream",
        apiKeyEnvName: "ELEVENLABS_API_KEY",
        readApiKey: () => env.ELEVENLABS_API_KEY,
        createClient: (apiKey) => new ElevenLabsClient({ apiKey }),
        resolveDefaults: ({ lang, voice, model }) => {
          const voiceId = resolveElevenLabsVoiceId(lang, voice);
          if (!voiceId) {
            throw new Error(
              `No voice ID configured for lang="${lang}". Set ELEVENLABS_VOICE_ID_${lang.toUpperCase()} or pass opts.voice.`,
            );
          }
          return { voiceId, modelId: resolveElevenLabsModelId(model) };
        },
        synthesize: async ({ client, text, voiceId, modelId, opts }) => {
          // Always send a settings block so the provider's narration preset wins
          // over whatever ElevenLabs has stored on the voice. Per-call overrides
          // shadow the preset; `style` stays undefined unless explicitly requested.
          const voiceSettings = {
            stability: opts.stability ?? DEFAULT_VOICE_SETTINGS.stability,
            similarityBoost: opts.similarityBoost ?? DEFAULT_VOICE_SETTINGS.similarityBoost,
            style: opts.style,
            speed: opts.speed ?? DEFAULT_VOICE_SETTINGS.speed,
          };

          const stream = await client.textToSpeech.convert(voiceId, {
            text,
            modelId,
            outputFormat: DEFAULT_OUTPUT_FORMAT,
            languageCode: opts.lang,
            voiceSettings,
          });

          return streamToBuffer(stream);
        },
      },
      opts,
    );
  }
}
