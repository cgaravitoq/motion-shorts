import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "./env";
import { type Lang, MAX_TTS_CHARS, type SynthesizeOptions, type TTSProvider } from "./types";

export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_v3";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128" as const;

/**
 * Spanish narration preset. The default ES voice is a peninsular Spanish
 * narrator; Carlos's personal clone is kept as an explicit secondary voice
 * because lowering stability / adding style can duplicate words in short
 * technical scripts.
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

interface ProviderOptions {
  apiKey?: string;
  client?: ElevenLabsClient;
}

const resolveVoiceId = (lang: Lang, override?: string): string | undefined => {
  if (override) return override;
  return lang === "es" ? env.ELEVENLABS_VOICE_ID_ES : env.ELEVENLABS_VOICE_ID_EN;
};

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

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = "elevenlabs";
  private readonly client: ElevenLabsClient;

  constructor(opts: ProviderOptions = {}) {
    if (opts.client) {
      this.client = opts.client;
      return;
    }
    const apiKey = opts.apiKey ?? env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ELEVENLABS_API_KEY missing — set it in .env or pass opts.apiKey to ElevenLabsTTSProvider",
      );
    }
    this.client = new ElevenLabsClient({ apiKey });
  }

  async synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error("ElevenLabsTTSProvider.synthesize: text is empty");
    }
    if (trimmed.length > MAX_TTS_CHARS) {
      throw new Error(
        `ElevenLabsTTSProvider.synthesize: text exceeds soft cap (${trimmed.length} > ${MAX_TTS_CHARS} chars). Refusing to burn ElevenLabs credits.`,
      );
    }

    const voiceId = resolveVoiceId(opts.lang, opts.voiceId);
    if (!voiceId) {
      throw new Error(
        `No voice ID configured for lang="${opts.lang}". Set ELEVENLABS_VOICE_ID_${opts.lang.toUpperCase()} or pass opts.voiceId.`,
      );
    }

    // Always send a settings block so the provider's narration preset wins
    // over whatever ElevenLabs has stored on the voice. Per-call overrides
    // shadow the preset; `style` stays undefined unless explicitly requested.
    const voiceSettings = {
      stability: opts.stability ?? DEFAULT_VOICE_SETTINGS.stability,
      similarityBoost: opts.similarityBoost ?? DEFAULT_VOICE_SETTINGS.similarityBoost,
      style: opts.style,
      speed: opts.speed ?? DEFAULT_VOICE_SETTINGS.speed,
    };

    const stream = await this.client.textToSpeech.convert(voiceId, {
      text: trimmed,
      modelId: resolveElevenLabsModelId(opts.modelId),
      outputFormat: DEFAULT_OUTPUT_FORMAT,
      languageCode: opts.lang,
      voiceSettings,
    });

    const buffer = await streamToBuffer(stream);
    if (buffer.length === 0) {
      throw new Error(
        "ElevenLabsTTSProvider.synthesize: API returned an empty audio stream. " +
          "This usually means the request was silently rate-limited or the text " +
          "produced no phonemes — check the ElevenLabs dashboard.",
      );
    }
    return buffer;
  }
}
