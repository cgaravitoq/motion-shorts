export type Lang = "es" | "en";

export interface SynthesizeOptions {
  lang: Lang;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

export interface TTSProvider {
  readonly name: string;
  resolveDefaults(opts: { lang: Lang; voice?: string; model?: string }): {
    voiceId: string;
    modelId: string;
  };
  synthesize(text: string, opts: SynthesizeOptions): Promise<Buffer>;
}

export const MAX_TTS_CHARS = 5000;
