---
name: canonical-short
description: >
  Use when the user wants to create a vertical short-form video -- a 30-50s motion-graphics
  explainer with voiceover and captions for YouTube Shorts, TikTok, Instagram Reels, or LinkedIn.
  Handles the full pipeline from script to finished mp4. Defer to this skill whenever the user
  describes a video concept ("make a short about X", "generate a reel", "produce a video"), even
  if they don't mention Hyperframes or a specific format. Skip for very short teasers (under 15s)
  or when rendering an already-built episode.
---

# Canonical Hyperframes short

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `examples/<slug>.txt`, `public/voice/<slug>/`, and `src/episodes/<slug>/` are app-relative.

A short is a typed **`scene-spec.json`** at `src/episodes/<slug>/scene-spec.json`. You fill PARAMETERS (slots); a deterministic assembler turns the spec into the monolithic `index.html` (1:1 — identical spec produces identical bytes). **`index.html` is GENERATED. Never hand-edit it, never hand-author HTML/CSS/GSAP scenes.** Edit the spec, then re-assemble.

The assembler owns everything universal: background layers, the brand-corner watermark, the single paused GSAP timeline + crossfades, track allocation (4,5,6,8,9.. for scenes; 7 = outro; 97 corner; 98 audio; 99 captions), the captions + audio tracks, and the `window.__timelines["<slug>"]` registry. Scene-types own only their content + entrance motion. You compose by choosing scene-types and filling slots.

## When to invoke

- User says "make a short about X", "generate a reel", "produce a video on Y"
- User invokes `/canonical-short` or pastes a source/idea with an existing script
- Topic fits a 30-50s vertical reel

## When NOT to invoke

- One-off LinkedIn square loop with no narration
- Render of an existing standalone composition
- <=15s teaser with 1-2 beats

## Scene-types (the building blocks)

Thirty-nine scene-types live under `templates/scenes/<type>/v1/`: 24 general types plus 15 brand-pack-driven `promo-*` story-ad/carousel types.

- **Visual-first general types (graphic — prefer these):** `fanout` (animated orchestration graph 1→N→1), `bars` (animated bar chart), `line-chart` (time series with axes, 1-3 series), `progress-ring` (1-3 animated rings/gauges), `contrib-heatmap` (GitHub-style activity grid), `decision-tree` (question + 2-3 tone-coloured branches), `metric` / `big-stat` (animated count-up numbers), `flow` (numbered pipeline + drawn connectors), `timeline` (rail + dots), `comparison` (A vs B), `code` (terminal/editor window), `social-card` (platform post card).
- **Asset-led general types:** `media-split`, `annotated-asset`, `code-output`, `dashboard-composite`, `statement-lower-third`, `logo-grid`, `before-after`. These bind image/screenshot paths under the episode's `assets/` where the manifest exposes image slots.
- **Text-led general types (use sparingly):** `hook` (opening statement), `title-cards` (labeled cards), `quote` (pull-quote).
- **Promo brand-pack types:** `promo-intro-card`, `promo-hero`, `promo-card-speaker`, `promo-blur-cta`, `promo-agenda`, `promo-quote`, `promo-details`, `promo-highlight-hook`, `promo-signal`, `promo-signal-cards`, `promo-signal-action`, `promo-signal-toolbar`, `promo-signal-messages`, `promo-signal-device`, `promo-product-outro`.
- **Brand sign-off:** `outro` (pinned to track 7, always last).

Repeatable slots have ranges (`title-cards.cards` 2-6, `flow.steps` 2-6, `fanout.workers` 2-6, `bars.bars` 2-6, `line-chart.series` 1-3, `progress-ring.rings` 1-3, `decision-tree.branches` 2-3, `metric.stats` 1-4, `comparison.left/rightPoints` 1-5, `timeline.events` 3-6, `code.lines` 1-12).

To learn the exact slots for a type, read `templates/scenes/<type>/v1/manifest.json`. To list/preview all types: `bun run scene:gallery`. Don't guess slot names — read the manifest.

### Visual-first by default

People retain what they see, and the narration + captions already deliver the words — so the screen should show the **picture**, not the script. When authoring the spec:

- **Prefer graphic scene-types.** Make ≥ half the content scenes visual-first. Reach for a graphic before a text card: process → `fanout`/`flow`; conditional branch → `decision-tree`; number → `big-stat`/`metric` (count-up); percentage/gauge → `progress-ring`; quantities → `bars`; trend over time → `line-chart`; activity cadence → `contrib-heatmap`; A vs B → `comparison`; chronology → `timeline`; command/output → `code`.
- **Cap text scenes** at 1–2 (`title-cards`/`quote`) plus the `hook`; never two text-led scenes back to back.
- **Trim on-screen copy:** short titles, labels of 1–4 words, drop optional body lines when a label suffices, don't restate the narration.
- **Never invent data** — only use `bars`/`metric`/`big-stat` with real numbers; for qualitative topics lean on `fanout`/`flow`/`code`.

## Intent → scene skeleton

Classify the short into exactly one intent — its primary visual job — then start from that intent's skeleton. `bun run scene:gallery` lists every scene-type and browsing `templates/scenes/` shows which fit each intent; this table is the at-a-glance source.

| Intent | When | Starter skeleton |
|--------|------|------------------|
| `informative` | concept explainers, definitions, lessons, frameworks, educational narratives | `hook → flow → big-stat → title-cards → outro` |
| `data` | metrics, charts, comparisons, trends, benchmarks, dashboards, proof points | `hook → bars → line-chart → big-stat → outro` |
| `workflow` | process diagrams, agent flows, decision trees, pipelines, automations | `hook → fanout → flow → decision-tree → outro` |
| `social` | posts, comments, creator overlays, follow CTAs, media cards, platform-native UI | `hook → social-card → metric → quote → outro` |
| `brand` | brand-system showcases, logo-led pieces, identity reveals, visual-system demos | `hook → big-stat → bars → title-cards → outro` |
| `vfx` | experimental transitions, texture, motion studies, kinetic hooks, effects-forward | `hook → big-stat → fanout → title-cards → outro` |

`hook` is always first, `outro` always last; the skeleton is a starting spine — adapt counts/types to the script. If multiple intents fit, pick the primary visual job. If the direction needs product/workspace screenshots, generated app surfaces, handoff bundles, or connector-heavy diagrams, invoke `.agents/skills/generated-raster-assets/SKILL.md` before authoring.

## Pipeline (stages + gates)

```
1. Choose intent (informative | data | workflow | social | brand | vfx)
   |
2. Write script (examples/<slug>.txt)        -- Gate 1: user picks 1 of 3 script options
   |
3. Generate audio (bun run audio ...)         -- Gate 2: AUDIBLE CHECK, user approves voice.mp3
   |
4. Scaffold + author scene-spec.json          -- scene:gallery -> new:episode --intent
   |                                              -> fill slots (per manifest.json) -> assemble
   |
5. PER-SCENE visual QA (bun run scripts/scene-qa.ts)  -- Gate 3 (looped): user approves/rejects
   |                                              EACH scene; iterate only rejected scenes
   |
6. Final render (bun run render:episode)      -- Gate 4: user approves the mp4
```

**Stage 3 (audible check) is non-negotiable.** TTS issues caught at script-edit cost (cheap) instead of re-render cost (expensive).

**Gate 3 replaces the old "render the whole mp4 then eyeball" gate.** Reject loops re-QA only the changed scenes (`--scenes=<id>`), never the whole short.

**Every gate is reviewed inside the session — the user never opens repo folders.** Gate 1: paste the candidate scripts inline in the chat so pacing (punctuation + any hand-authored expressive tags) is visible. Gate 2: deliver `voice.mp3` into the chat (plus the STT transcript as a pronunciation proxy). Gate 3: send `renders/<slug>-qa/contact-sheet.jpg` into the chat (`bun run scripts/scene-qa.ts <slug>` writes it). Gate 4: deliver the mp4 into the chat.

## Voice + TTS gotchas

Voice IDs are set in `.env.example`:

```bash
ELEVENLABS_VOICE_ID_ES=<your-spanish-voice-id>  # Pick from https://elevenlabs.io/app/voice-library
ELEVENLABS_VOICE_ID_EN=<your-english-voice-id>
```

See `docs/voice-config.md` for selection criteria.

Audio settings (canonical):

```bash
bun run audio examples/<slug>.txt --lang=es \
  --speed=1.04 \
  --out=public/voice/<slug>
```

- `eleven_v3` is the only model -- non-v3 IDs (`eleven_multilingual_v2`, `eleven_turbo_v2`, any v2/v2.5) are permanently blocked; the CLI throws if you pass `--model` with one.
- `speed=1.04` -- natural but a little tighter; keep ES narration in the conservative 1.0-1.08 band.
- No pause injection. Pace with punctuation only (periods/commas, ellipses …); never inject `<break>` SSML or `[pause]` tags — hand-author at most 1-2 expressive tags where they matter.
- EN narration: v3 runs ~24% slower than the old v2@1.1, so write ~120-135 words and use `--speed=1.1` (range ~1.04-1.15) to land 50-60s.

### TTS pronunciation gotchas (peninsular ES)

The model applies Castilian phonetics to English tech terms in Spanish. Rules:

1. **Short acronyms** (ACE, MCP, RAG, LLM, UI, API, CLI) -- write with periods: `A.C.E.`, `M.C.P.`, `R.A.G.` Forces letter-by-letter spelling.
   - **Exception**: long pronounceable acronyms (HTTPS, NASA) read as words.
2. **English tech terms with Spanish cognates** -- USE the Spanish form:
   - `main agent` -> `agente principal`
   - `subagent` -> `subagente`
   - Keep universal: `playbook`, `frontmatter`, `context window`, `hooks`, `skills`, `cache_control`
3. **English compounds with no cognate** (`fine-tuning`, `embeddings`) -- leave as-is.
4. **Numbers** -- write in Spanish words: `diez coma seis por ciento` (NOT `10.6%`).

After `bun run audio`, run `ffplay -nodisp -autoexit public/voice/<slug>/voice.mp3` (`afplay` on macOS). If a tech term is mispronounced, edit `examples/<slug>.txt` and regenerate. Iterate until clean BEFORE authoring the spec.

## Authoring the scene-spec

1. **Choose intent.** Map the topic to one of `informative | data | workflow | social | brand | vfx`. Use `bun run scene:gallery` to see which scene-types fit and the suggested ordering.

2. **Scaffold the episode:**

   ```bash
   bun run new:episode <slug> --intent=informative
   ```

   This writes a starter `scene-spec.json` (seeded from the intent skeleton) + `meta.json` + `assets/` + `lib` symlink, and assembles a first `index.html`.

3. **Fill the slots.** Edit `src/episodes/<slug>/scene-spec.json`. Top-level fields: `slug`, `lang`, `width`/`height` (1080/1920), `palette` (`accent`, `accent2`), and the `scenes` array. Each scene has:
   - `id` — kebab-case, unique
   - `type` — one of the scene-types
   - `duration` — seconds (optional; omit to use the type default)
   - `status` — `"draft"` | `"approved"` (drives the HITL loop)
   - `slots` — the typed params (read `templates/scenes/<type>/v1/manifest.json` for the exact shape and ranges)

   ```json
   {
     "slug": "agent-handoff",
     "lang": "es",
     "width": 1080, "height": 1920,
     "palette": { "accent": "#5b6cff", "accent2": "#e9ff00" },
     "scenes": [
       { "id": "hook", "type": "hook", "duration": 6, "status": "draft",
         "slots": { "eyebrow": "...", "title": "...", "subtitle": "..." } },
       { "id": "pieces", "type": "title-cards", "duration": 7,
         "slots": { "title": "...", "cards": [ {"title":"...","body":"..."} ] } },
       { "id": "brand-outro", "type": "outro", "slots": { "source": "" } }
     ]
   }
   ```

   The last scene is always `type: "outro"`. Keep total runtime in the 30-50s band.

4. **Validate, then assemble:**

   ```bash
   bun run scene:check src/episodes/<slug>/scene-spec.json   # fast pre-flight, no assembly
   bun run assemble <slug>                                   # regenerate index.html
   ```

   Run `assemble` after **every** spec edit.

## Visual framing

The repo's framing rule (don't double-frame self-framed objects) is now encoded in the scene-types: `code` and `social-card` are already self-framed (a code window / a post card), so pick those types instead of wrapping content in a generic card. Choose `title-cards`/`metric`/`comparison` for loose content that genuinely needs grouping (labels, metric lists, badge groups). For dense flows/pipelines use `flow` or `timeline`, which give the graph room in 9:16.

## Generated raster assets

Generated PNG/WebP assets still work for visual-heavy beats (product/workspace screenshots, handoff diagrams, connector-heavy explainers). Save them under `src/episodes/<slug>/assets/generated/` and reference them from a scene slot that takes an image. Currently that means `code`/`social-card`/`title` media slots; if no scene-type yet exposes an image slot for what you need, flag it for a future scene-type rather than hand-authoring HTML around the asset. Prompt + provenance rules live in `.agents/skills/generated-raster-assets/SKILL.md`.

For **Spanish labels baked into a generated asset**, verify accents and `ñ` in the rendered frames during scene-QA. If the model dropped or mangled them, regenerate, or move the text to a scene-type slot (HTML caption) instead of leaving it in the image.

## Per-scene QA (Gate 3)

```bash
bun run scripts/scene-qa.ts <slug>                 # all scenes
bun run scripts/scene-qa.ts <slug> --scenes=hook,pieces   # only changed scenes
```

This re-assembles, captures one settled "final" frame per scene (use `--frames=3` only to debug motion with entry/mid/late), runs `hyperframes inspect` for overflow/overlap, and writes `renders/<slug>-qa/<scene-id>/*.png` + `report.json` + a single **`contact-sheet.jpg`** grid of every sampled scene. **No full mp4 render.**

**Review happens in the chat, never in folders.** Send `contact-sheet.jpg` into the conversation (deliver the file `bun run scripts/scene-qa.ts <slug>` wrote) together with the inspect verdict. The user approves or rejects EACH scene from that one image. For rejected scenes: edit that scene's slots in `scene-spec.json` -> `bun run assemble <slug>` -> `bun run scripts/scene-qa.ts <slug> --scenes=<id>` (other scenes' frames and report entries are preserved and merged). Loop until all scenes are approved (mark `status: "approved"` as you go).

## Final render (Gate 4)

Only after every scene is approved:

```bash
bun run render:episode <slug> --format=mp4            # canonical
bun run render:episode <slug> --format=mp4 --keep-local   # also keep a local mp4 to inspect
```

Reads `assets/voice.mp3` for duration (silent if absent). `meta.json` carries `tail: 3` (3s static end-card hold past audio for reading). Present the mp4 for approval. Publishing (R2 + Notion) happens only on explicit approval, via the publisher.

## References (informational)

The assembler now owns the timeline, palette, captions, and typography, so these are background reading, not authoring instructions:

- `references/typography-system.md` — the role tokens the scene-types render with.
- `references/gsap-timeline-reference.md` — the canonical timeline pattern the assembler emits.

## Final checklist

- [ ] `examples/<slug>.txt` written, ES, target ~35s; user picked one of 3 script options (Gate 1)
- [ ] `bun run audio` ran; playback listened (`ffplay`/`afplay`), no mispronunciations; user approved voice.mp3 (Gate 2)
- [ ] `voice.mp3` + `captions.json` present under `src/episodes/<slug>/assets/`
- [ ] Intent chosen; scene-types selected via `bun run scene:gallery`
- [ ] `scene-spec.json` authored; slots match `templates/scenes/<type>/v1/manifest.json` (names + ranges)
- [ ] Last scene is `type: "outro"`; palette set; total runtime 30-50s
- [ ] `bun run scene:check` passes (spec valid)
- [ ] `bun run assemble <slug>` ran after the last spec edit (index.html regenerated, not hand-edited)
- [ ] `bun run scripts/scene-qa.ts <slug>` per-scene snapshots clean; `inspect` reports 0 issues
- [ ] Every scene approved by the user (Gate 3); rejected scenes iterated via `--scenes=<id>`
- [ ] Generated source assets, if used, are under `src/episodes/<slug>/assets/generated/` and referenced from a scene image slot
- [ ] Generated asset provenance noted (`assets/generated/provenance.md` or `assets/research/research.md`)
- [ ] Spanish text in generated assets preserves accents and `ñ`, or moved to a scene-type slot
- [ ] `meta.json` has `tail: 3`
- [ ] `bun run render:episode <slug> --format=mp4` only after per-scene approval; user approved the mp4 (Gate 4)
- [ ] `ffprobe` confirms duration ~= audio + meta.tail
- [ ] `bun run typecheck && bun run lint` pass
- [ ] `git add src/episodes/<slug>/ examples/<slug>.txt` (only); never `git add -A`
- [ ] Conventional commit `feat(<slug>): <topic>` (only when explicitly asked)

## See also

- `AGENTS.md` -- critical constraints that break renders if ignored
- `docs/rules.md` -- full rules reference
- `docs/voice-config.md` -- voice IDs, tuning presets, native pacing
- `.agents/skills/new-episode/SKILL.md` -- scaffolder
- `.agents/skills/audio-pipeline/SKILL.md` -- TTS + Scribe details
- `.agents/skills/generated-raster-assets/SKILL.md` -- generated image assets for visual-heavy scenes
