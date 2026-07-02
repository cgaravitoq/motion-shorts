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
  type MixBgmOptions,
  type MixBgmResult,
  mixBgm,
} from "./bgm-mixer";
export {
  BgmTrackNotFoundError,
  getBgmCacheRoot,
  resolveBgmPath,
} from "./bgm-resolver";
export {
  type CachedTts,
  type CachedTtsLookup,
  type CacheMode,
  cacheEntryPaths,
  computeTtsCacheKey,
  getCacheRoot,
  isTtsCacheR2Enabled,
  readCachedTts,
  readCachedTtsWithSource,
  resolveCacheMode,
  type TtsCacheKeyInputs,
  type TtsCacheSource,
  writeCachedTts,
  writeCachedTtsToR2,
} from "./cache";
export {
  type CaptionExportOptions,
  type CaptionSidecarFormat,
  parseCaptionFormats,
  toSrt,
  toVtt,
} from "./captions-export";
export {
  DEFAULT_ELEVENLABS_MODEL_ID,
  resolveElevenLabsModelId,
  resolveElevenLabsVoiceId,
} from "./elevenlabs";
export { getTTSProvider, getTTSProviderName, resolveTTSProviderDefaults } from "./factory";
export { getAudioDurationSeconds } from "./ffprobe";
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
export { isElevenV3Model } from "./script-pacing";
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
