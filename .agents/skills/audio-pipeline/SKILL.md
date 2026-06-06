---
name: audio-pipeline
description: >
  Use when the user needs to generate voiceover audio and word-level captions from a narration
  script -- the voice.mp3 + captions.json pair consumed by Hyperframes episodes. Handles
  ElevenLabs TTS + STT with cost guardrails and quality checks. Defer to this skill whenever the
  user mentions generating audio, TTS, voiceover, or captions for a video, even if they don't
  specify the pipeline or output format. Skip for transcribing pre-existing audio files (use npx
  hyperframes transcribe directly).
disable-model-invocation: true
---

# Audio pipeline (TTS + captions)

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `examples/<slug>.txt`, `public/voice/<slug>/`, `out/<slug>/` are app-relative.

Generate the `voice.mp3` + word-level `captions.json` pair that the per-episode Hyperframes project consumes -- voice as `<audio>` track, captions as karaoke overlay driven by `apps/hyperframe/src/lib/captions-karaoke.js`.

TTS defaults to ElevenLabs; set `TTS_PROVIDER=inworld` for the secondary provider. There is no offline TTS path. The "offline" knob is on the **STT** side: `STT_PROVIDER=hyperframes-transcribe` shells out to `npx hyperframes transcribe` (whisper.cpp, lower accuracy, free).

> For voice IDs, audio settings, and TTS pronunciation gotchas (acronyms, cognates, numbers) see `canonical-short` SKILL.md. This skill covers the pipeline execution only.

## Pre-flight

1. **Confirm the script file exists** and read it. Print char count.
2. **Cost gate -- TTS char cap is 5000.** If `wc -m "$0"` exceeds 5000, abort and ask the user to split the script.
3. **Voice/model resolution.** Confirm `--voice=<id>` flag OR env `ELEVENLABS_VOICE_ID_ES` / `ELEVENLABS_VOICE_ID_EN` (default) or `INWORLD_VOICE_ID_ES` / `INWORLD_VOICE_ID_EN` when `TTS_PROVIDER=inworld`. ElevenLabs model defaults to `ELEVENLABS_MODEL_ID=eleven_v3`; pass `--model=<id>` for A/B tests.
4. **STT provider choice.**
   - **ElevenLabs Scribe (default):** uses `ELEVENLABS_API_KEY`, billed by audio minutes, hard-capped at 5 minutes.
   - **`hyperframes-transcribe` (free/offline whisper.cpp):** requires whisper model download on first run (cached at `~/.cache/hyperframes/whisper/`). Pass `--stt=hyperframes-transcribe` or set env `STT_PROVIDER=hyperframes-transcribe`.
5. **Output dir.** Default: `out/audio/`. Canonical: `--out=public/voice/<slug>/` and copy to `apps/hyperframe/src/episodes/<slug>/assets/` before render.

## Run

```bash
bun run audio "$0" [flags]
```

Wait for completion -- it prints the audio file path, captions path, and duration stats.

## Voice tuning presets

`ElevenLabsTTSProvider` applies `stability=0.5 / similarityBoost=0.82 / speed=1.04` by default -- tuned for the primary peninsular Spanish narrator. Per-call flags override:

- **Narration (default)** -- no flags needed.
- **Hook (3-5s energetic)** -- `--stability=0.35 --similarity-boost=0.75 --speed=1.0`. Generate hooks to a separate `out/<ep>/hook/` dir and concat in editor.
- **Style amplification** -- `--style=0.25`. Increases API latency; use sparingly.
- **Model selection** -- default `eleven_v3`; fallback with `--model=eleven_multilingual_v2` when comparing older audio behavior.

## A/B validation

```sh
# ElevenLabs (default)
bun run audio examples/<sample>.txt --out=out/audio-elevenlabs
# Inworld
TTS_PROVIDER=inworld bun run audio examples/<sample>.txt --out=out/audio-inworld
```

`stability`, `similarityBoost`, `style` are ElevenLabs-only; `speed` maps to Inworld `speakingRate`.

## Pause injection

Scripts run through `injectPauses()` (`packages/audio/src/script-pacing.ts`) BEFORE hitting the API — **v2/v2.5 only**. On `eleven_v3` (the production default) injection NEVER runs and `--pause-*` flags are ignored with a warning: v3 pause tags produce unpredictable multi-second gaps.

| Punctuation | Generated pause control |
|---|---|
| `.!?` | `eleven_v3`: never; v2: `<break time="0.4s" />` |
| `:;--` | `eleven_v3`: never; v2: `<break time="0.25s" />` |

Override per call (v2/v2.5 only):
- `--pause-sentence=<ms>` (default 400, cap 3000)
- `--pause-clause=<ms>` (default 250, cap 3000)
- `--no-pause-injection` -- skip injection entirely

Density ceiling: ~1 pause/audio tag per 8-10 words. More destabilizes generation (hallucinations).
For v3, hand-author at most 1-2 expressive tags in the script (`[excited]`, `[thoughtful]`, `[short pause]`).

## STT quality check (mandatory)

Before consuming captions, read the transcript and check:

- Music tokens (`♪`, `�`) -- whisper detected music, not speech
- Garbled / nonsense words -- model misheard
- Long gaps with only `♪` -- instrumental section
- Repeated filler ("huh", "uh") -- hallucinating
- Words with `end - start < 0.05` -- unreliable alignment

**If >20% of entries are problematic:**

1. Re-run with `--stt=elevenlabs` (Scribe is more accurate on Spanish)
2. If Scribe is also bad, suggest providing lyrics manually as SRT/VTT

Always strip `♪`/`�` and short-duration filler before consuming captions downstream.

## Post-run -- migrate to episode

```bash
cp out/<slug>/voice.mp3     apps/hyperframe/src/episodes/<slug>/assets/voice.mp3
cp out/<slug>/captions.json apps/hyperframe/src/episodes/<slug>/assets/captions.json
```

For canonical archive:
```bash
mkdir -p public/voice/<slug>/
cp out/<slug>/voice.mp3     public/voice/<slug>/voice.mp3
cp out/<slug>/captions.json public/voice/<slug>/captions.json
```

Episode HTML references via `<audio src="assets/voice.mp3">`. Captions are inlined as `<script id="captions-data">` at render time by `render-episode.ts`. **Don't paste captions JSON by hand** -- source stays diff-clean.

## Gotchas (from prior incidents)

- **`@elevenlabs/elevenlabs-js@2.45.0` `Uploadable.FromPath` shape is broken** -- `{ path }` throws `Unsupported stream type: object`. The repo uses `{ data: fs.readFileSync(path), filename, contentType }`. Do NOT "simplify" it back to `{ path }`.
- **STT 5-min cap is enforced by `ffprobe`-measured duration.** If `ffprobe` is absent the cap doesn't trigger but the API will still bill. Keep ffmpeg/ffprobe installed.
- **Order is fixed: TTS -> STT.** STT reads the audio file we just wrote.
- **`hyperframes-transcribe` needs WAV 16kHz 16-bit mono.** The provider auto-converts mp3->wav with ffmpeg. ffmpeg missing -> clear error.

## When NOT to use

- The user only needs a transcript for an **already-existing audio file** (not generated by us). Run `npx hyperframes transcribe <audio>` directly.
- Tweak captions overlay styling (font, color). That's part of the canonical-short HTML build, not this skill.
