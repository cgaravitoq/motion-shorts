import type { Lang } from "./types";

export interface HyperframesCaption {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscribeOptions {
  lang: Lang;
  maxMinutes?: number;
}

export interface STTProvider {
  readonly name: string;
  transcribe(audioPath: string, opts: TranscribeOptions): Promise<HyperframesCaption[]>;
}

export const DEFAULT_MAX_AUDIO_MINUTES = 5;
