export { getTTSProvider } from "./factory";
export {
  DEFAULT_PACING,
  injectElevenV3Pauses,
  injectPauses,
  isElevenV3Model,
  MAX_BREAK_MS,
  type PacingOptions,
  type PacingResult,
  type PacingSyntax,
} from "./script-pacing";
export { DEFAULT_ELEVENLABS_MODEL_ID, resolveElevenLabsModelId } from "./elevenlabs";
export {
  MAX_TTS_CHARS,
  type Lang,
  type SynthesizeOptions,
  type TTSProvider,
} from "./types";

// STT (Hyperframes-shape captions: { text, start, end, confidence? })
export { getSTTProvider, type STTProviderName } from "./stt-factory";
export {
  DEFAULT_MAX_AUDIO_MINUTES,
  type HyperframesCaption,
  type STTProvider,
  type TranscribeOptions,
} from "./stt-types";

// ffprobe helper — duration probing shared by render-episode + generate-audio + Scribe.
export { getAudioDurationSeconds } from "./ffprobe";
