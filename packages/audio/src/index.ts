// BGM mixer: caption-driven ducking, head/tail fade, -14 LUFS loudnorm.
export {
  BgmTrackNotFoundError,
  getBgmCacheRoot,
  resolveBgmPath,
} from "./bgm-resolver";
export {
  BGM_DEFAULTS,
  type BuildArgsOptions,
  type BuildEnvelopeOptions,
  buildBgmFilterGraph,
  buildDuckWindows,
  buildFfmpegArgs,
  type DuckWindow,
  type FfmpegRunner,
  type FilterGraphOptions,
  mixBgm,
  type MixBgmOptions,
  type MixBgmResult,
} from "./bgm-mixer";
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
  type CachedTtsLookup,
  cacheEntryPaths,
  computeTtsCacheKey,
  getCacheRoot,
  isTtsCacheR2Enabled,
  readCachedTts,
  readCachedTtsWithSource,
  resolveCacheMode,
  type TtsCacheSource,
  type TtsCacheKeyInputs,
  writeCachedTts,
  writeCachedTtsToR2,
} from "./cache";
export {
  DEFAULT_ELEVENLABS_MODEL_ID,
  resolveElevenLabsModelId,
  resolveElevenLabsVoiceId,
} from "./elevenlabs";
export { getTTSProvider } from "./factory";
// ffprobe helper — duration probing shared by render-episode + generate-audio + Scribe.
export { getAudioDurationSeconds } from "./ffprobe";
// Multi-speaker scripts: inline `[speaker:<name>]` markup → per-segment TTS + merged captions.
export {
  averageCaptionConfidence,
  CAPTION_CONFIDENCE_DROP_WARN,
  type MergeArtifactsResult,
  type MergedSegmentArtifact,
  mergeSegmentArtifacts,
  offsetCaptions,
  type ParseScriptOptions,
  type ParseScriptResult,
  parseRosterJson,
  parseScript,
  resolveRoster,
  type ScriptSegment,
  type SpeakerRoster,
  type SpeakerSummaryEntry,
  summariseSpeakers,
} from "./multi-speaker";
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
