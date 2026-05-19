# Voice configuration

## Voice IDs

Set in `.env`:

```
ELEVENLABS_VOICE_ID_ES=t9LRTh3y1ioN00e9wsNh  # Aaron Abad — Native Castilian, primary ES voice
ELEVENLABS_VOICE_ID_ES_PERSONAL=3OHCfRbi6YGikMbbSXug  # Carlos personal clone, secondary ES voice
ELEVENLABS_VOICE_ID_EN=7VqWGAWwo2HMrylfKrcm  # Fatih Yildirim — tech narration
ELEVENLABS_MODEL_ID=eleven_v3  # Default TTS model; override with --model when testing v2/v2.5
```

The primary Spanish voice is peninsular / European Spanish and should be used for normal Spanish shorts. Carlos's personal clone is kept as a secondary voice for brand continuity tests, but do not make it the default.

Override per episode with `--voice=<id>` on the audio CLI.

| Role | Voice ID | Use |
|------|----------|-----|
| Primary ES | `t9LRTh3y1ioN00e9wsNh` | Production Spanish shorts, especially AI/tech explainers. |
| Secondary ES | `3OHCfRbi6YGikMbbSXug` | Carlos personal clone; explicit A/B only. |
| Hook ES candidate | `NhUo7cJi70nyU8yfCimA` | Peninsular social/hook voice; not default unless a short specifically needs more ad-style energy. |

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
- Personal clone: avoid style/stability experiments by default. A tested issue duplicated final words in captions/audio when the clone was generated with `--stability=0.4 --similarity-boost=0.82 --style=0.35 --speed=1.05`.

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

- **TTS char cap**: 5000 characters per call
- **STT minute cap**: 5 minutes of audio per call (Scribe only; whisper.cpp is free)
