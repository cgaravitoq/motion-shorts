import type { Lang } from "./types";

/**
 * Caption shape consumed by Hyperframes compositions.
 *
 * `start` / `end` in seconds (the Hyperframes canonical unit per the official
 * skill `references/captions.md`). `confidence` is optional metadata kept for
 * richer overlays — Hyperframes ignores unknown fields.
 */
export interface HyperframesCaption {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscribeOptions {
  lang: Lang;
  /** Soft cap in minutes — provider aborts if the audio is longer. */
  maxMinutes?: number;
}

export interface STTProvider {
  readonly name: string;
  transcribe(audioPath: string, opts: TranscribeOptions): Promise<HyperframesCaption[]>;
}

export const DEFAULT_MAX_AUDIO_MINUTES = 5;
