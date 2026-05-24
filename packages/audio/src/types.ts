/**
 * Provider-agnostic shape for text-to-speech.
 *
 * Implementations live in this folder — `elevenlabs.ts` (default), `local.ts`
 * (stub for the future voice-cloning project). Resolved at runtime by
 * `factory.ts` from `TTS_PROVIDER`.
 */

export type Lang = "es" | "en";

export interface SynthesizeOptions {
  lang: Lang;
  voiceId?: string;
  modelId?: string;
  /** 0–1. Lower = more expressive / variable; higher = more consistent / monotone. Default 0.5. */
  stability?: number;
  /** 0–1. Higher = closer to the cloned timbre; lower = more model freedom. Default 0.75. */
  similarityBoost?: number;
  /** 0–1. Amplifies the style of the original speaker; 0 = flat. Default 0. Increases latency. */
  style?: number;
  /** 0.7–1.2 for v2. <1 slows speech, >1 speeds it up. Default 1.0 on the API. */
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

/** Cost guardrail: abort before synthesizing scripts longer than this. */
export const MAX_TTS_CHARS = 5000;
