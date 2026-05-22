// Caption sidecar exporters (SRT / WebVTT) for accessibility + multilingual rollouts.
export {
  type CaptionExportOptions,
  type CaptionSidecarFormat,
  parseCaptionFormats,
  toSrt,
  toVtt,
} from "./captions-export";
// TTS cache (sha256(script+voice+tuning) -> ~/.cache/motion-shorts/tts/<hash>/).
export {
  type CachedTts,
  type CacheMode,
  cacheEntryPaths,
  computeTtsCacheKey,
  getCacheRoot,
  readCachedTts,
  resolveCacheMode,
  type TtsCacheKeyInputs,
  writeCachedTts,
} from "./cache";
export {
  DEFAULT_ELEVENLABS_MODEL_ID,
  resolveElevenLabsModelId,
  resolveElevenLabsVoiceId,
} from "./elevenlabs";
export { getTTSProvider } from "./factory";
// ffprobe helper — duration probing shared by render-episode + generate-audio + Scribe.
export { getAudioDurationSeconds } from "./ffprobe";
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
// STT (Hyperframes-shape captions: { text, start, end, confidence? })
export { getSTTProvider, type STTProviderName } from "./stt-factory";
export {
  DEFAULT_MAX_AUDIO_MINUTES,
  type HyperframesCaption,
  type STTProvider,
  type TranscribeOptions,
} from "./stt-types";
export {
  type Lang,
  MAX_TTS_CHARS,
  type SynthesizeOptions,
  type TTSProvider,
} from "./types";
