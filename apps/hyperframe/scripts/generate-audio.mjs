#!/usr/bin/env bun
/**
 * End-to-end voice + captions generator.
 *
 *   bun run scripts/generate-audio.mjs <script.txt> [--lang=es|en] [--out=<dir>]
 *                                                   [--stt=elevenlabs|hyperframes-transcribe]
 *                                                   [--voice=<voice-id>]
 *                                                   [--model=<elevenlabs-model-id>]
 *
 * Default flow:
 *   1. Read script.txt and abort early if it exceeds the TTS soft cap.
 *   2. Synthesise voice.mp3 via the resolved TTSProvider (ElevenLabs default).
 *   3. Transcribe voice.mp3 with the resolved STTProvider (ElevenLabs Scribe
 *      default; pass `--stt=hyperframes-transcribe` to use the offline
 *      fallback that shells out to `npx hyperframes transcribe`).
 *   4. Write `voice.mp3` + `captions.json` into <out>/ and print a recap.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  averageCaptionConfidence,
  cacheEntryPaths,
  computeTtsCacheKey,
  DEFAULT_PACING,
  getAudioDurationSeconds,
  getCacheRoot,
  getSTTProvider,
  getTTSProvider,
  injectElevenV3Pauses,
  injectPauses,
  isElevenV3Model,
  MAX_BREAK_MS,
  MAX_TTS_CHARS,
  mergeSegmentArtifacts,
  parseCaptionFormats,
  parseScript,
  readCachedTts,
  resolveCacheMode,
  resolveElevenLabsModelId,
  resolveElevenLabsVoiceId,
  resolveRoster,
  summariseSpeakers,
  toSrt,
  toVtt,
  writeCachedTts,
} from "@cgaravitoq/audio";

const HELP = `Usage: bun run scripts/generate-audio.mjs <script.txt> [options]

Options:
  --lang=es|en           Voice language. Defaults to "es".
  --out=<dir>            Output directory. Defaults to "out/audio/".
  --stt=elevenlabs|hyperframes-transcribe
                         STT provider override. Falls back to STT_PROVIDER env
                         then "elevenlabs". hyperframes-transcribe shells out
                         to \`npx hyperframes transcribe\` (whisper.cpp under
                         the hood, free + offline, lower accuracy).
  --voice=<voice-id>     ElevenLabs voice id override. Defaults to the env
                         var matching the language (ELEVENLABS_VOICE_ID_ES /
                         ELEVENLABS_VOICE_ID_EN).
  --model=<model-id>     ElevenLabs model override. Defaults to ELEVENLABS_MODEL_ID
                         or eleven_v3.
  --stability=<0..1>     Voice tuning. Lower = more expressive; higher =
                         more consistent. Repo default 0.5 (narration preset).
  --similarity-boost=<0..1>
                         Voice tuning. Higher = closer to cloned timbre.
                         Repo default 0.82 (narration preset).
  --style=<0..1>         Voice tuning. Amplifies the original speaker's
                         style; 0 = flat. Default 0. Increases latency if >0.
  --speed=<0.5..1.5>     Voice tuning. <1 slower, >1 faster. Provider-specific
                         caps apply: ElevenLabs v2 [0.7, 1.2], Inworld
                         [0.5, 1.5]. Repo default 1.04 (narration preset).
  --pause-sentence=<ms>  Inject model-safe pauses after .!? Default 400 on v2.
                         On v3 this is opt-in; hand-authored tags are preferred.
                         0 disables. Capped at 3000.
  --pause-clause=<ms>    Inject model-safe pause after :;—. Default 250 on v2.
                         On v3 this is opt-in. 0 disables.
  --no-pause-injection   Skip pause injection entirely (use when the script
                         already contains hand-authored pause tags).
  --caption-format=<list>
                         Comma-separated list of additional sidecar caption
                         formats to emit alongside captions.json. Supported:
                         "srt", "vtt". Example: --caption-format=srt,vtt.
                         When omitted, behavior is unchanged (JSON only).
  --cache=use|refresh|off
                         TTS cache control. Default "use": look up
                         sha256(script+voice+model+tuning) in the local cache
                         and skip the ElevenLabs call on hit. "refresh"
                         bypasses the cache for reads but writes a fresh
                         entry. "off" disables the cache entirely.
                         Cache lives at ~/.cache/motion-shorts/tts/<hash>/.
                         For multi-speaker scripts (see below) every segment
                         is hashed and cached independently, so editing one
                         line only re-synthesises that segment.
  -h, --help             Show this help.

Multi-speaker scripts:
  Prefix any line with [speaker:<name>] to switch voice mid-script. Names
  resolve through the roster JSON in MOTION_SHORTS_VOICE_ROSTER (e.g.
  '{"alex":"voice-id-1","morgan":"voice-id-2"}'); names that don't match a
  roster entry are treated as raw ElevenLabs voice IDs. Scripts without any
  [speaker:...] tag are byte-identical to single-speaker runs.
`;

const main = async () => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      lang: { type: "string", default: "es" },
      out: { type: "string", default: "out/audio/" },
      stt: { type: "string" },
      voice: { type: "string" },
      model: { type: "string" },
      stability: { type: "string" },
      "similarity-boost": { type: "string" },
      style: { type: "string" },
      speed: { type: "string" },
      "pause-sentence": { type: "string" },
      "pause-clause": { type: "string" },
      "no-pause-injection": { type: "boolean", default: false },
      "caption-format": { type: "string" },
      cache: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const [scriptPath] = positionals;
  if (!fs.existsSync(scriptPath)) {
    console.error(`generate-audio: script file not found at ${scriptPath}`);
    process.exit(1);
  }

  const lang = values.lang;
  if (lang !== "es" && lang !== "en") {
    console.error(`generate-audio: unsupported lang "${lang}". Use "es" or "en".`);
    process.exit(1);
  }

  const text = fs.readFileSync(scriptPath, "utf8").trim();
  if (text.length === 0) {
    console.error(`generate-audio: ${scriptPath} is empty`);
    process.exit(1);
  }

  const outDir = path.resolve(values.out);
  fs.mkdirSync(outDir, { recursive: true });
  const voicePath = path.join(outDir, "voice.mp3");
  const captionsPath = path.join(outDir, "captions.json");

  // Validate sidecar formats before any TTS spend so bad input fails fast.
  let captionFormats;
  try {
    captionFormats = parseCaptionFormats(values["caption-format"]);
  } catch (err) {
    console.error(`generate-audio: ${err.message}`);
    process.exit(1);
  }

  // Flag parsing helpers — both clamp to a range and surface a clear error.
  const parseRange = (raw, label, min, max) => {
    if (raw == null) return undefined;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      console.error(`generate-audio: --${label} must be in [${min}, ${max}], got "${raw}"`);
      process.exit(1);
    }
    return n;
  };
  const stability = parseRange(values.stability, "stability", 0, 1);
  const similarityBoost = parseRange(values["similarity-boost"], "similarity-boost", 0, 1);
  const style = parseRange(values.style, "style", 0, 1);
  // CLI bound = union of provider ranges. The TTS provider further clamps:
  // ElevenLabs [0.7, 1.2], Inworld [0.5, 1.5].
  const speed = parseRange(values.speed, "speed", 0.5, 1.5);
  const pauseSentenceMs = parseRange(values["pause-sentence"], "pause-sentence", 0, MAX_BREAK_MS);
  const pauseClauseMs = parseRange(values["pause-clause"], "pause-clause", 0, MAX_BREAK_MS);
  const modelId = values.model
    ? resolveElevenLabsModelId(values.model)
    : resolveElevenLabsModelId();
  const isV3 = isElevenV3Model(modelId);
  const hasExplicitPauseControls =
    values["pause-sentence"] != null || values["pause-clause"] != null;
  const tuningRecap = [
    stability != null && `stability=${stability}`,
    similarityBoost != null && `similarityBoost=${similarityBoost}`,
    style != null && `style=${style}`,
    speed != null && `speed=${speed}`,
  ]
    .filter(Boolean)
    .join(" ");

  // Pause injection runs before the TTS call and must match the ElevenLabs
  // model syntax: v3 uses square-bracket tags; v2/v2.5 use SSML breaks.
  const shouldInjectPauses = !values["no-pause-injection"] && (!isV3 || hasExplicitPauseControls);
  const injectPausesForText = (raw) =>
    shouldInjectPauses
      ? (isV3 ? injectElevenV3Pauses : injectPauses)(raw, {
          sentenceMs: pauseSentenceMs ?? DEFAULT_PACING.sentenceMs,
          clauseMs: pauseClauseMs ?? DEFAULT_PACING.clauseMs,
        })
      : { text: raw, injected: 0, syntax: isV3 ? "eleven-v3-tags" : "ssml-break" };

  // Parse the script for `[speaker:<name>]` markup BEFORE pause injection. A
  // single-speaker script has no markup → one default segment whose text is
  // exactly the input; the downstream code path stays byte-identical to the
  // pre-multi-speaker behavior. Multi-speaker runs synthesise each segment
  // individually and merge the results.
  let parsedScript;
  try {
    parsedScript = parseScript(text, { roster: resolveRoster() });
  } catch (err) {
    console.error(`generate-audio: ${err.message}`);
    process.exit(1);
  }
  if (parsedScript.unresolved.length > 0) {
    console.warn(
      `[generate-audio] roster: unresolved speaker name(s) ${parsedScript.unresolved
        .map((n) => `"${n}"`)
        .join(", ")} — treated as raw voice ids. Set MOTION_SHORTS_VOICE_ROSTER or fix the markup.`,
    );
  }

  const isMultiSpeaker = parsedScript.hasMarkup && parsedScript.segments.length > 1;
  if (parsedScript.hasMarkup) {
    const summary = summariseSpeakers(parsedScript.segments)
      .map((e) => `${e.label} (${e.segments})`)
      .join(", ");
    console.log(`[generate-audio] speakers: ${summary}`);
  }

  // For the single-speaker path we keep the legacy variable names so the
  // downstream stats block reads naturally. `finalText` is the single
  // post-injection script we'll send to TTS — for multi-speaker runs this
  // variable represents the concatenated text of every segment, used only
  // for cost reporting.
  const pacingResult = injectPausesForText(text);
  const finalText = pacingResult.text;
  if (!isMultiSpeaker && pacingResult.injected > 0) {
    const sMs = pauseSentenceMs ?? DEFAULT_PACING.sentenceMs;
    const cMs = pauseClauseMs ?? DEFAULT_PACING.clauseMs;
    console.log(
      `[generate-audio] injected ${pacingResult.injected} ${pacingResult.syntax} pauses (sentence=${sMs}ms, clause=${cMs}ms)`,
    );
  }

  // Char-cap check on the post-injection text — that's what ElevenLabs
  // actually counts. Pause tags can push a borderline script past the cap.
  // The same cap applies per-segment in the multi-speaker path; we evaluate
  // it there once the per-segment text is finalised.
  if (!isMultiSpeaker && finalText.length > MAX_TTS_CHARS) {
    const fromBreaks = finalText.length - text.length;
    console.error(
      `generate-audio: post-injection text is ${finalText.length} chars (script ${text.length}` +
        `${fromBreaks > 0 ? ` + ${fromBreaks} from pause tags` : ""}), exceeds cap (${MAX_TTS_CHARS}). ` +
        "Refusing to burn TTS credits. Shorten the script or pass --no-pause-injection.",
    );
    process.exit(1);
  }

  const startedAt = Date.now();

  // ── Cache lookup ───────────────────────────────────────────────────────
  // Hash the post-pause-injection text — that's what we'd send to the API.
  // Resolve voiceId at the CLI layer so the cache key matches what the
  // provider will actually use (otherwise per-language env defaults would
  // sit outside the key).
  let cacheMode;
  try {
    cacheMode = resolveCacheMode({ flag: values.cache });
  } catch (err) {
    console.error(`generate-audio: ${err.message}`);
    process.exit(1);
  }

  const resolvedVoiceId = resolveElevenLabsVoiceId(lang, values.voice);
  const cacheHash =
    isMultiSpeaker || cacheMode === "off" || !resolvedVoiceId
      ? null
      : computeTtsCacheKey({
          text: finalText,
          voiceId: resolvedVoiceId,
          modelId,
          speed,
          stability,
          similarityBoost,
        });

  let audioBuffer = null;
  let captions = null;
  let cacheStatus = "disabled";
  let ttsProviderName = null;
  let sttProviderName = null;
  let ttsMs = 0;
  let sttMs = 0;
  let segmentCacheHits = 0;
  let segmentCacheMisses = 0;
  let segmentBoundaryWarnings = [];
  let multiSpeakerTotalChars = 0;

  // ── Multi-speaker pipeline ─────────────────────────────────────────────
  // Loop per segment: pause-inject → cache lookup → TTS+STT on miss → cache
  // write. Then concat audio and merge captions with adjusted offsets. The
  // legacy cache/TTS/STT block below is skipped because audioBuffer and
  // captions are already populated when we enter it.
  if (isMultiSpeaker) {
    const ttsProvider = getTTSProvider();
    ttsProviderName = ttsProvider.name;
    const sttProvider = getSTTProvider(values.stt);
    sttProviderName = sttProvider.name;
    console.log(
      `[generate-audio] multi-speaker: ${parsedScript.segments.length} segments, TTS="${ttsProvider.name}" STT="${sttProvider.name}" model=${modelId}`,
    );

    const segmentArtifacts = [];
    let segmentTmpDir = null;
    try {
      segmentTmpDir = fs.mkdtempSync(path.join(outDir, ".segments-"));
      for (const segment of parsedScript.segments) {
        const segPacing = injectPausesForText(segment.text);
        const segText = segPacing.text;
        if (segText.length > MAX_TTS_CHARS) {
          console.error(
            `generate-audio: segment ${segment.index} (speaker="${segment.speakerName ?? "(default)"}") is ${segText.length} chars, exceeds cap (${MAX_TTS_CHARS}).`,
          );
          process.exit(1);
        }
        multiSpeakerTotalChars += segText.length;
        // Resolve the segment's voice: explicit segment voice id wins; the
        // untagged opening segment falls back to the CLI/env-resolved id.
        const segVoiceId = segment.voiceId ?? resolvedVoiceId;
        const segCacheHash =
          cacheMode === "off" || !segVoiceId
            ? null
            : computeTtsCacheKey({
                text: segText,
                voiceId: segVoiceId,
                modelId,
                speed,
                stability,
                similarityBoost,
              });

        let segAudio = null;
        let segCaptions = null;
        let segCacheStatus = "disabled";
        if (cacheMode === "use" && segCacheHash) {
          const hit = readCachedTts(segCacheHash);
          if (hit) {
            segAudio = hit.audio;
            segCaptions = hit.captions;
            segCacheStatus = "hit";
            segmentCacheHits += 1;
            console.log(
              `[generate-audio] segment ${segment.index} (${segment.speakerName ?? "(default)"}) cache hit hash=${segCacheHash.slice(0, 12)}`,
            );
          } else {
            segCacheStatus = "miss";
            segmentCacheMisses += 1;
          }
        } else if (cacheMode === "refresh" && segCacheHash) {
          segCacheStatus = "refresh";
          segmentCacheMisses += 1;
        }

        if (!segAudio) {
          const ttsStartedAt = Date.now();
          segAudio = await ttsProvider.synthesize(segText, {
            lang,
            voiceId: segVoiceId,
            modelId,
            stability,
            similarityBoost,
            style,
            speed,
          });
          ttsMs += Date.now() - ttsStartedAt;
        }

        // Write the segment audio to a temp file so the STT provider (which
        // accepts a path, not a Buffer) can read it. Also lets us probe the
        // segment's exact duration via ffprobe for accurate caption offsets.
        const segAudioPath = path.join(segmentTmpDir, `seg-${segment.index}.mp3`);
        fs.writeFileSync(segAudioPath, segAudio);

        if (!segCaptions) {
          const sttStartedAt = Date.now();
          segCaptions = await sttProvider.transcribe(segAudioPath, { lang });
          sttMs += Date.now() - sttStartedAt;
        }

        if (segCacheHash && (segCacheStatus === "miss" || segCacheStatus === "refresh")) {
          writeCachedTts(segCacheHash, { audio: segAudio, captions: segCaptions });
        }

        const segDuration = await getAudioDurationSeconds(segAudioPath);
        // Fallback when ffprobe is unavailable: use the last caption's end
        // time so caption offsets remain reasonable, even if mid-segment
        // silence (no caption) gets clipped from the boundary.
        const fallbackDur =
          segCaptions.length > 0 ? (segCaptions[segCaptions.length - 1]?.end ?? 0) : 0;
        const durationSec = segDuration > 0 ? segDuration : fallbackDur;

        segmentArtifacts.push({
          audio: segAudio,
          captions: segCaptions,
          durationSec,
          averageConfidence: averageCaptionConfidence(segCaptions),
        });
      }
    } finally {
      if (segmentTmpDir) fs.rmSync(segmentTmpDir, { recursive: true, force: true });
    }

    const merged = mergeSegmentArtifacts(segmentArtifacts);
    audioBuffer = merged.audio;
    captions = merged.captions;
    segmentBoundaryWarnings = merged.boundaryWarnings;
    cacheStatus = "segment";
    for (const w of segmentBoundaryWarnings) {
      console.warn(
        `[generate-audio] caption confidence drop at speaker boundary after segment ${w.afterSegment} ` +
          `(prev avg=${w.previousAvg.toFixed(2)}, next avg=${w.nextAvg.toFixed(2)}, drop=${w.dropPct.toFixed(1)}%)`,
      );
    }
  }

  if (cacheMode === "use" && cacheHash) {
    const hit = readCachedTts(cacheHash);
    if (hit) {
      audioBuffer = hit.audio;
      captions = hit.captions;
      cacheStatus = "hit";
      const { dir } = cacheEntryPaths(cacheHash);
      console.log(`[generate-audio] cache hit hash=${cacheHash.slice(0, 12)} (${dir})`);
    } else {
      cacheStatus = "miss";
      console.log(`[generate-audio] cache miss hash=${cacheHash.slice(0, 12)}`);
    }
  } else if (cacheMode === "refresh" && cacheHash) {
    cacheStatus = "refresh";
    console.log(`[generate-audio] cache refresh hash=${cacheHash.slice(0, 12)} (bypassing read)`);
  }

  // ── TTS ────────────────────────────────────────────────────────────────
  if (!audioBuffer) {
    const ttsProvider = getTTSProvider();
    ttsProviderName = ttsProvider.name;
    console.log(
      `[generate-audio] TTS provider="${ttsProvider.name}" lang=${lang} model=${modelId} chars=${finalText.length}${tuningRecap ? ` ${tuningRecap}` : ""}`,
    );
    const ttsStartedAt = Date.now();
    audioBuffer = await ttsProvider.synthesize(finalText, {
      lang,
      voiceId: values.voice,
      modelId,
      stability,
      similarityBoost,
      style,
      speed,
    });
    ttsMs = Date.now() - ttsStartedAt;
  }
  fs.writeFileSync(voicePath, audioBuffer);
  const audioKiB = (audioBuffer.length / 1024).toFixed(1);
  if (ttsProviderName) {
    console.log(`[generate-audio] wrote ${voicePath} (${audioKiB} KiB, ${ttsMs}ms)`);
  } else {
    console.log(`[generate-audio] wrote ${voicePath} (${audioKiB} KiB, from cache)`);
  }

  // ── STT ────────────────────────────────────────────────────────────────
  if (!captions) {
    const sttProvider = getSTTProvider(values.stt);
    sttProviderName = sttProvider.name;
    console.log(`[generate-audio] STT provider="${sttProvider.name}"`);
    const sttStartedAt = Date.now();
    captions = await sttProvider.transcribe(voicePath, { lang });
    sttMs = Date.now() - sttStartedAt;
  }
  fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));
  if (sttProviderName) {
    console.log(
      `[generate-audio] wrote ${captionsPath} (${captions.length} caption tokens, ${sttMs}ms)`,
    );
  } else {
    console.log(
      `[generate-audio] wrote ${captionsPath} (${captions.length} caption tokens, from cache)`,
    );
  }

  // Persist the freshly synthesised pair so subsequent runs hit the cache.
  if (cacheHash && (cacheStatus === "miss" || cacheStatus === "refresh")) {
    const { dir } = writeCachedTts(cacheHash, { audio: audioBuffer, captions });
    console.log(`[generate-audio] cached hash=${cacheHash.slice(0, 12)} -> ${dir}`);
  }

  const sidecarPaths = [];
  for (const format of captionFormats) {
    const sidecarPath = path.join(outDir, `captions.${format}`);
    const body = format === "srt" ? toSrt(captions) : toVtt(captions);
    fs.writeFileSync(sidecarPath, body);
    sidecarPaths.push(sidecarPath);
    console.log(`[generate-audio] wrote ${sidecarPath}`);
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const durationSecs = await getAudioDurationSeconds(voicePath);
  if (durationSecs <= 0) {
    console.warn(
      "[generate-audio] could not measure audio duration via ffprobe; STT cost guard relies " +
        "on duration. Install ffmpeg to keep the 5-min cap effective.",
    );
  }

  const totalMs = Date.now() - startedAt;
  console.log("\n[generate-audio] done.");
  console.log(`  total elapsed:    ${(totalMs / 1000).toFixed(1)}s`);
  if (durationSecs > 0) {
    console.log(`  audio duration:   ${durationSecs.toFixed(1)}s`);
  }
  if (isMultiSpeaker) {
    const totalSegments = parsedScript.segments.length;
    console.log(
      `  cache:            ${segmentCacheHits}/${totalSegments} segments hit (${segmentCacheMisses} synthesised)`,
    );
    if (cacheMode !== "off") console.log(`  cache root:       ${getCacheRoot()}`);
    if (segmentBoundaryWarnings.length > 0) {
      console.log(
        `  caption warnings: ${segmentBoundaryWarnings.length} speaker boundary confidence drop(s)`,
      );
    }
  } else if (cacheHash) {
    const cacheLabel =
      cacheStatus === "hit"
        ? `hit (no API calls, hash=${cacheHash.slice(0, 12)})`
        : cacheStatus === "refresh"
          ? `refresh (forced re-synth, hash=${cacheHash.slice(0, 12)})`
          : `miss (synthesised + stored, hash=${cacheHash.slice(0, 12)})`;
    console.log(`  cache:            ${cacheLabel}`);
    console.log(`  cache root:       ${getCacheRoot()}`);
  } else {
    console.log(`  cache:            ${cacheStatus}`);
  }
  console.log(`  tts provider:     ${ttsProviderName ?? "cache"}`);
  // Report the text actually sent to ElevenLabs (post pause-injection) so
  // the credit estimate matches the dashboard. The original script length
  // is shown alongside for context.
  if (isMultiSpeaker) {
    console.log(
      `  tts char usage:   ${multiSpeakerTotalChars} across ${parsedScript.segments.length} segments`,
    );
  } else if (ttsProviderName) {
    if (finalText.length === text.length) {
      console.log(`  tts char usage:   ${text.length}`);
    } else {
      console.log(
        `  tts char usage:   ${finalText.length} (script ${text.length} + ${finalText.length - text.length} from pause tags)`,
      );
    }
  } else {
    console.log(`  tts char usage:   0 (cache hit)`);
  }
  console.log(`  stt provider:     ${sttProviderName ?? "cache"}`);
  if (sttProviderName === "elevenlabs" && durationSecs > 0) {
    console.log(`  stt minutes used: ${(durationSecs / 60).toFixed(2)}`);
  }
  console.log(`  outputs:          ${voicePath}`);
  console.log(`                    ${captionsPath}`);
  for (const sidecarPath of sidecarPaths) {
    console.log(`                    ${sidecarPath}`);
  }
};

main().catch((err) => {
  console.error("generate-audio failed:");
  console.error(err);
  process.exit(1);
});
