# Voice configuration

## Voice IDs

Set in `.env`:

```
ELEVENLABS_VOICE_ID_ES=<your-spanish-voice-id>  # Primary ES narration voice
ELEVENLABS_VOICE_ID_EN=<your-english-voice-id>  # Primary EN narration voice
ELEVENLABS_MODEL_ID=eleven_v3                   # Default TTS model; override with --model when testing v2/v2.5
```

Pick voices from the [ElevenLabs Voice Library](https://elevenlabs.io/app/voice-library) — copy each voice's ID into the env vars above. Recommended criteria for a narration short:

- **ES**: native Castilian / peninsular Spanish, tech-narration register, neutral pace.
- **EN**: tech-narration register, neutral pace, no heavy regional accent unless intentional.

Override per call with `--voice=<id>` on the audio CLI when A/B-ing voices.

| Role | Source | Use |
|------|--------|-----|
| Primary ES | `ELEVENLABS_VOICE_ID_ES` | Production Spanish shorts, especially AI/tech explainers. |
| Primary EN | `ELEVENLABS_VOICE_ID_EN` | Production English shorts. |
| Per-episode override | `--voice=<voice-id>` CLI flag | One-off A/B or specific narrator. |

## Audio settings (canonical)

```bash
bun run audio examples/<slug>.txt --lang=es \
  --model=eleven_v3 \
  --speed=1.04 \
  --out=public/voice/<slug>
```

- `model=eleven_v3` — expressive default for production shorts; use `--model=eleven_multilingual_v2` only for fallback/regression tests.
- `speed=1.04` — natural but a little tighter for 30-45s technical shorts.
- Do not auto-inject pauses on v3 by default. Hand-author one or two expressive tags where they matter.
- For v2 fallback only: add `--pause-sentence=300 --pause-clause=0`.

## Voice tuning preset

`DEFAULT_VOICE_SETTINGS`: `stability=0.5`, `similarityBoost=0.82`, `speed=1.04` — tuned for the primary peninsular ES narrator.

Override per-call:
- Hook (3-5s, energetic): `--stability=0.35 --similarity-boost=0.75 --speed=1.0`
- Amplified style: `--style=0.25` (increases API latency)
- Cloned voices: avoid style/stability experiments by default — high-style settings on a clone have been observed to duplicate final words in audio/captions.

ElevenLabs rejects extreme `speed` values; keep production Spanish narration in the conservative `1.0-1.08` band unless a specific A/B wins.

## Script-side pause injection

`@cgaravitoq/audio` injects model-safe pauses before calling the API:

| Model | Trigger | Generated tag |
|-------|---------|---------------|
| `eleven_v3` | `.!?` | `[short pause]` or `[long pause]` only when `--pause-*` is explicit |
| `eleven_v3` | `:;--` | same, usually disabled via `--pause-clause=0` |
| v2 / v2.5 | `.!?` | `<break time="0.4s" />` |
| v2 / v2.5 | `:;--` | `<break time="0.25s" />` |

Flags:
- Select model: `--model=eleven_v3` or `--model=eleven_multilingual_v2`
- Skip: `--no-pause-injection`
- Override sentence pause: `--pause-sentence=<ms>`
- Override clause pause: `--pause-clause=<ms>` (SSML break caps at 3000ms for non-v3 models)
- Ceiling: ~1 pause tag per 8-10 words

If the script already contains `<break>` tags or v3 pause tags, skip injection.

## Eleven v3 expressive tags

Use bracketed audio tags only when generating with `eleven_v3`. Keep them sparse and voice-compatible:

- Pauses: `[pause]`, `[short pause]`, `[long pause]`.
- Delivery: `[whispers]`, `[excited]`, `[curious]`, `[sarcastic]`, `[thoughtful]`.
- Human reactions: `[sighs]`, `[exhales]`, `[laughs]`, `[clears throat]`.

For technical shorts, prefer delivery tags over theatrical sounds. A good pattern is one tag in the hook and one tag at the twist/reveal. A live smoke on 2026-05-09 showed that even a short v3 pause tag can produce a multi-second gap, so listen before building HTML.

```txt
[curious] Lo raro de Claude Code no es que ejecute comandos. [short pause] Es que puedes reescribir lo que ve antes de que lo lea.
```

Avoid:
- SSML `<break>` with `eleven_v3`; v3 does not support it.
- Phoneme tags for Spanish; ElevenLabs phoneme SSML is English-model-only.
- Non-auditory stage directions like `[mirando la pantalla]`.
- Stacking many tags in a 30-45s explainer. It can make v3 less predictable.

## TTS pronunciation gotchas (peninsular ES)

The model applies Castilian phonetics to English tech terms mixed inline in Spanish.

1. **Short acronyms** (ACE, MCP, RAG, LLM, UI, API, CLI) — write with periods: `A.C.E.`, `M.C.P.`, `R.A.G.`. Forces letter-by-letter spelling.
   - **Exception**: long pronounceable acronyms (HTTPS, NASA) read as words.
2. **English tech terms with Spanish cognates** — USE the Spanish form:
   - `main agent` -> `agente principal`
   - `subagent` -> `subagente`
   - Keep universal: `playbook`, `frontmatter`, `context window`, `hooks`, `skills`, `cache_control`
3. **English compounds with no cognate** (`fine-tuning`, `embeddings`) — leave as-is, but listen for pronunciation before building HTML.
4. **Numbers** — write in Spanish words: `diez coma seis por ciento` (NOT `10.6%`). Only digits in code/UI mockups.

**Always `afplay public/voice/<slug>/voice.mp3` BEFORE building HTML.** Script-edit cost << re-render cost.

## Captions shape

`[{text, start, end, confidence?}]` in SECONDS. `text` keeps the leading-space convention from `@remotion/captions`.
`captions-karaoke.js` consumes this directly. Scribe provider emits this shape natively.

## Scribe configuration

Default model: `scribe_v2` (set via `ELEVENLABS_SCRIBE_MODEL` in `.env`).
Same word-shape contract as v1, better punctuation detection, identical pricing tier.

## STT provider swap

```
STT_PROVIDER=elevenlabs              # Default: ElevenLabs Scribe (API, billed by audio minutes)
STT_PROVIDER=hyperframes-transcribe  # Offline: whisper.cpp via npx hyperframes transcribe (free, lower accuracy)
```

## Cost guardrails

- **TTS char cap**: 5000 characters per call (applied per segment in multi-speaker runs)
- **STT minute cap**: 5 minutes of audio per call (Scribe only; whisper.cpp is free)

## Multi-speaker scripts

A script with no `[speaker:...]` markup behaves exactly as before — same TTS call, same cache key, same captions output (byte-identical guarantee).

To switch voices mid-script, prefix any line with a speaker tag:

```txt
[speaker:alex] Lo raro de Claude Code no es que ejecute comandos.
[speaker:morgan] Es que puedes reescribir lo que ve antes de que lo lea.
[speaker:alex] Eso cambia el rol del desarrollador, no la herramienta.
```

The tag must be the **first non-whitespace token on the line**. Text that continues on the next line (without a new tag) belongs to the previous speaker. Untagged text before the first tag is synthesised with the default CLI/env voice.

### Resolving names

Set the roster as a JSON env var:

```
MOTION_SHORTS_VOICE_ROSTER={"alex":"<voice-id-1>","morgan":"<voice-id-2>"}
```

- Names are matched case-insensitively.
- An unmatched name is treated as a raw ElevenLabs voice id (so `[speaker:JBFqnCBsd6RMkjVDRZzb]` works without setting up a roster).
- Unmatched names with a roster present are flagged in the run log so typos surface immediately.

### Run log

The CLI prints a roster summary before synthesis:

```
[generate-audio] speakers: alex (2), morgan (1)
[generate-audio] multi-speaker: 3 segments, TTS="elevenlabs" STT="elevenlabs" model=eleven_v3
[generate-audio] segment 0 (alex) cache hit hash=ab12cd34ef56
```

### Segment-level caching

Each segment is hashed independently on `(text, voice_id, model, speed, stability, similarityBoost)` — the same key the single-speaker path uses. Editing one segment only re-synthesises that segment; the others stay in the cache. The cache layout is unchanged: `~/.cache/motion-shorts/tts/<hash>/{voice.mp3,captions.json}`.

### Caption confidence at boundaries

After each segment is transcribed, the CLI compares average word confidence across the boundary. When confidence drops by more than 15% the run log warns:

```
[generate-audio] caption confidence drop at speaker boundary after segment 1 (prev avg=0.92, next avg=0.71, drop=22.8%)
```

These warnings are advisory — listen to the boundary and consider re-recording or adjusting the second speaker's tuning.

### Follow-up

Per-episode `meta.json` rosters are deferred. Today the env-level `MOTION_SHORTS_VOICE_ROSTER` is the only roster source; the parser API (`parseScript(text, { roster })`) accepts an explicit roster object so per-episode wiring is a small change when an episode demands it.

## Background music (BGM) with ducking

Shorts feel flat without a music bed. `bun run audio` can mix a BGM track under the narration with caption-driven ducking, head/tail fades, and a `-14 LUFS` loudness pass — all in a single ffmpeg call.

```bash
bun run audio examples/<slug>.txt --lang=es \
  --out=public/voice/<slug> \
  --bgm=r2://motion-shorts/bgm/lofi-tech-loop.mp3 \
  --bgm-gain=0.3 \
  --ducking=0.6 \
  --bgm-fade=1.5
```

### Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--bgm=<path>` | — | Enables mixing. Without it, output is byte-identical to the no-BGM path (the mixer is never invoked). |
| `--bgm-gain=<0..1>` | `0.3` | Base BGM gain when narration is silent. |
| `--ducking=<0..1>` | `0.6` | Multiplier applied on top of `--bgm-gain` during narration windows. Effective duck gain = `bgm-gain * ducking` (e.g. `0.3 * 0.6 = 0.18`). |
| `--bgm-fade=<sec>` | `1.5` | Head + tail fade in seconds. Clamped to `narration/2` so a 2s narration still gets symmetric fades. |
| `--bgm-output=replace\|sidecar` | `sidecar` | `sidecar` writes `voice-mixed.mp3` alongside an untouched `voice.mp3`. `replace` renames `voice.mp3` → `voice.unmixed.mp3` then overwrites `voice.mp3` with the mixed track so render + caption pipelines pick it up automatically. |

### Why `sidecar` is the default

Every episode + the render path consume `voice.mp3` by name. Changing what that file contains is a global blast radius — a one-line CLI typo could silently push BGM-mixed audio into a render meant to be voice-only. The safer default writes the mixed file to `voice-mixed.mp3` so authors opt in to the swap explicitly via `--bgm-output=replace` (or by pointing their episode at the new path).

### How ducking works

Ducking windows are derived directly from the word-level `captions.json` already produced for every episode. Adjacent words are merged when the gap is shorter than ~0.35s (so the BGM doesn't pump between syllables); each window is widened by ~0.12s on each side so the duck attacks slightly before the word and releases slightly after. The mixer stacks `volume=<ducking>:enable='between(t,a,b)'` filters on top of a base `volume=<bgmGain>` — multiplying gains during narration windows and leaving the BGM at full base gain in between.

The final filter graph passes through `loudnorm=I=-14:TP=-1.5:LRA=11` (YouTube/streaming standard). For a no-window run (rare: captions empty) the BGM still gets the base gain + fades + loudnorm.

### Cache interaction

BGM parameters are NOT part of the TTS cache key (`cache.ts` hashes `text + voiceId + modelId + tuning` only). Tweaking `--bgm-gain` or swapping BGM tracks never re-spends TTS credits — the mix runs on the cached `voice.mp3`.

### BGM tracks (R2 library)

Royalty-free tracks live in R2 alongside other heavy artifacts (see `AGENTS.md` artifact persistence note). The starter library:

| Path (R2) | Mood | Duration | Notes |
|-----------|------|----------|-------|
| `bgm/lofi-tech-loop.mp3` | Calm lo-fi, soft kick | ~2:00 (loops cleanly) | Default for explainers / informative shorts. |
| `bgm/cinematic-pulse.mp3` | Tense, modern, sub-heavy | ~1:30 | For data / proof-point shorts. |
| `bgm/upbeat-electro.mp3` | Energetic, kinetic | ~1:45 | For hook-led / VFX-experimental shorts. |

Hydrate locally with `bun run hydrate:episode` (extends to the BGM prefix). Pass any local mp3/wav to `--bgm=` for one-off experiments.

To add a track to the shared library: upload to R2 under `bgm/<slug>.mp3`, then append a row to the table above. No need to commit the audio file to the repo — keep the library out of git per the artifact persistence rule.
