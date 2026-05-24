import { InworldTTS } from "@inworld/tts";
import { env } from "./env";
import { type Lang, MAX_TTS_CHARS, type SynthesizeOptions, type TTSProvider } from "./types";

type InworldTTSClient = ReturnType<typeof InworldTTS>;

interface ProviderOptions {
  apiKey?: string;
  client?: InworldTTSClient;
}

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

export class InworldTTSProvider implements TTSProvider {
  readonly name = "inworld";
  private readonly client: InworldTTSClient;

  constructor(opts: ProviderOptions = {}) {
    if (opts.client) {
      this.client = opts.client;
      return;
    }
    const apiKey = opts.apiKey ?? env.INWORLD_API_KEY;
    if (!apiKey) {
      throw new Error(
        "INWORLD_API_KEY missing — set it in .env or pass opts.apiKey to InworldTTSProvider",
      );
    }
    this.client = InworldTTS({ apiKey });
  }

  resolveDefaults(opts: { lang: Lang; voice?: string; model?: string }): {
    voiceId: string;
    modelId: string;
  } {
    const voiceId = resolveVoiceId(opts.lang, opts.voice);
    if (!voiceId) {
      throw new Error(
        `No Inworld voice ID configured for lang="${opts.lang}". Set INWORLD_VOICE_ID_${opts.lang.toUpperCase()} or pass opts.voiceId.`,
      );
    }
    return {
      voiceId,
      modelId: opts.model ?? env.INWORLD_TTS_MODEL,
    };
  }

  async synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error("InworldTTSProvider.synthesize: text is empty");
    }
    if (trimmed.length > MAX_TTS_CHARS) {
      throw new Error(
        `InworldTTSProvider.synthesize: text exceeds soft cap (${trimmed.length} > ${MAX_TTS_CHARS} chars). Refusing to burn Inworld credits.`,
      );
    }

    const { voiceId, modelId } = this.resolveDefaults({
      lang: opts.lang,
      voice: opts.voiceId,
      model: opts.modelId,
    });

    const speakingRate = resolveSpeakingRate(opts.speed);
    warnIgnoredOptionsOnce(opts);

    const request: Parameters<typeof this.client.generate>[0] = {
      text: trimmed,
      voice: voiceId,
      model: modelId,
      encoding: "MP3",
      language: toLanguageCode(opts.lang),
    };
    if (speakingRate !== undefined) {
      request.speakingRate = speakingRate;
    }

    const audio = await this.client.generate(request);

    const buffer = Buffer.from(audio);
    if (buffer.length === 0) {
      throw new Error(
        "InworldTTSProvider.synthesize: API returned an empty audio buffer. " +
          "This usually means the request was silently rate-limited or the text " +
          "produced no phonemes — check the Inworld dashboard.",
      );
    }
    return buffer;
  }
}
