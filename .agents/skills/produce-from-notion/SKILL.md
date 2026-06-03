---
name: produce-from-notion
description: >
  Use when the user wants to produce a short from a Notion content brief -- phrases like "produce
  the next short", "siguiente short", "/produce-from-notion", or when they share a Notion URL from
  the Shorts & Reels database. Handles the end-to-end flow: pulling the brief, drafting script
  alternatives with user approval, generating audio, writing the scene-spec, assembling and
  per-scene QA, rendering, and pushing completion status back to Notion. Skip if the script already
  exists in the repo (use canonical-short directly) or the topic has no Notion entry.
---

# produce-from-notion

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `examples/<slug>.txt`, `public/voice/<slug>/`, `src/episodes/<slug>/`, `renders/<slug>.mp4` are app-relative.

> Skill-only orchestrator. Uses Notion MCP tools directly and shells out to existing `bun run audio` / `bun run new:episode` / `bun run assemble` / `bun run scene:check` / `bun run scripts/scene-qa.mjs` / `bun run render:episode`. Defers visual construction to the intent short skills (which write `scene-spec.json`) and to `audio-pipeline` (TTS + STT details).

## The model (scene-hub)

A short is a typed `scene-spec.json` at `src/episodes/<slug>/scene-spec.json`. A deterministic assembler turns it into the monolithic `index.html` (1:1; identical spec => identical bytes). **`index.html` is generated — never hand-edit it.** Every spec edit is followed by `bun run assemble <slug>`.

Scenes are composed only from the 17 scene-types: `hook`, `title-cards`, `flow`, `fanout`, `metric`, `bars`, `big-stat`, `comparison`, `timeline`, `quote`, `code`, `social-card`, `progress-ring`, `line-chart`, `contrib-heatmap`, `decision-tree`, `outro`. `outro` is the pinned brand sign-off, always last. See `AGENTS.md` (repo map) and the intent short skills for the scene-type slots and ranges.

## When to invoke

- User says "produce el siguiente short", "/produce-from-notion"
- User pastes a Notion URL from the Shorts DB
- A Notion entry sits in `Status: Hook Drafted` and is ready to ship

## When NOT to invoke

- Script already exists in `examples/<slug>.txt` -> `canonical-short` directly
- Topic is freeform without a Notion entry -> `canonical-short` directly
- Repurpose / re-render of an existing episode -> `bun run render:episode <slug>` directly
- Just need TTS for an existing script -> `audio-pipeline`

## Prerequisites

| Check | How |
|---|---|
| Notion MCP authenticated (OAuth) | `mcp__notion__API-get-self` returns the bot user |
| Read access to the Shorts DB | Query data source `${NOTION_SHORTS_DATA_SOURCE_ID}` succeeds |
| `.env` has `ELEVENLABS_API_KEY` | `printenv ELEVENLABS_API_KEY | head -c 8` |
| `ELEVENLABS_VOICE_ID_ES` (or `_EN`) set | `printenv ELEVENLABS_VOICE_ID_ES` |
| `ffmpeg` + `ffprobe` installed | `ffprobe -version | head -1` |

If any check fails -> abort and report. Do NOT improvise.

## Pipeline (7 stages, 4 gates)

```
1. Pull from Notion
   | (agent presents N entries with Status: Hook Drafted)
2. Draft 3 alternative scripts (script + scene outline + palette + hook-type)
   | GATE 1 -- user picks 1 of 3 (script)
3. Generate audio (bun run audio) + playback
   | GATE 2 -- user OKs voice quality (loop until approved)
4. Write scene-spec.json + assemble (visual-director step)
   | bun run scene:check -> bun run assemble -> lint
5. Per-scene visual QA (bun run scripts/scene-qa.mjs)
   | GATE 3 -- approve/reject EACH scene; iterate only rejected scenes
6. Final render (bun run render:episode)
   | GATE 4 -- user OKs the rendered mp4
7. Push to Notion (Status, Asset Slug, full body)
```

**The gates exist where user taste or correctness differentiates outcomes:**
- Gate 1 (creative angle) -- biggest leverage point
- Gate 2 (voice quality) -- cheapest fix cycle (script edit, not visual rework)
- Gate 3 (per-scene visual) -- catch overflow/overlap/weak scenes before a full render burns time
- Gate 4 (final approval) -- before irreversible Notion writeback

## Stage 1 -- Pull from Notion

### List ideas with Status: Hook Drafted

Query the data source `${NOTION_SHORTS_DATA_SOURCE_ID}` (set in `.env`; see [notion-db-schema](references/notion-db-schema.md) for required properties) with filter `Status = "Hook Drafted"`, page_size 100.

Present as numbered list:

| # | Title | Hook Text (truncated 80 chars) | Series | Hook Type |

### If the user pastes a Notion URL

Extract the page ID from the URL. Verify with retrieve. Skip the listing.

### Read the chosen entry

Retrieve the page. Extract: `Title`, `Hook Text` (MUST honor unless user says rewrite), `Hook Type`, `Series`, `Topic`, `Duration`, `Payoff` (if present).

If `Hook Text` is empty, the entry is mis-classified. Flag to user and abort unless they say "use Title as hook seed".

> For the full Notion property schema, read `references/notion-db-schema.md`.

## Stage 2 -- Draft 3 alternative scripts

Generate **3 script drafts** with explicitly different angles. Don't write the spec, don't run audio, don't touch disk.

### Draft requirements per option

```
### Draft <A|B|C> -- <Hook Type label>

**Script** (~80-100 words ES, target ~35-45s at speed=1.0):
<verbatim text for ElevenLabs>

**Scene outline (scene-types):**
1. hook        (0-Xs)    -- <one-line description>
2. <type>      (Xs-Ys)   -- <description>
3. <type>      (Ys-Zs)   -- <description>
4. <type>      (Zs-Ws)   -- <description>
5. outro       (Ws-end)  -- brand sign-off

**Palette proposal:** primary #hex + accent #hex + secondary #hex
   (must NOT match the previous short's primary)

**Hook Type used:** <one of 6>
**Why this angle:** <one sentence>
```

Pick scene-types per beat from the 17 available; map the brief's intent (informative / data / workflow / social / brand / vfx) to the appropriate scene-types. The `outro` is always the last scene.

### Angle diversification rule

The 3 drafts MUST use different `Hook Type` values from: Bold Claim / Curiosity Gap / Question / Before/After / Pattern Interrupt / Demo Reveal. Do NOT generate 3 Bold Claims with different wording.

### TTS pre-flight

Apply pronunciation gotchas to ALL 3 scripts before showing them: acronyms with periods, Spanish cognates over English tech terms, numbers in words. This way the operator doesn't pick a TTS landmine.

## Gate 1 -- User picks a draft

Ask: "Cual te convence: A, B o C? Refinar alguno antes de audio?"

Acceptable responses:
- `A` / `B` / `C` -> proceed to stage 3
- `A pero cambia X` / `B con el payoff de C` -> revise inline, re-show
- `Ninguno, replantea` -> generate 3 new
- `Pause, voy a refinar el Hook Text en Notion` -> wait, re-pull

Do NOT proceed without an explicit pick.

## Stage 3 -- Audio + Gate 2

### Pick the slug

Check `ls src/episodes/` for `short-NN`. Default: increment highest existing index. Honor override for topic-based slugs.

### Write and run TTS

```bash
cat > examples/<slug>.txt <<'EOF'
<the chosen script verbatim>
EOF

bun run audio examples/<slug>.txt --lang=es \
  --speed=1.0 --pause-sentence=300 --pause-clause=0 \
  --out=public/voice/<slug>

afplay public/voice/<slug>/voice.mp3
```

### Gate 2 loop

Ask: "Suena bien? Algun termino mal pronunciado?"

If `si`: proceed to stage 4.
If `no, cambiar X`: edit script, re-run audio, re-`afplay`. Loop until `si`.

## Stage 4 -- Scaffold + write scene-spec.json + assemble

This is the visual-director step: build the short by writing a typed `scene-spec.json`, never by hand-editing HTML.

```bash
BRAND_HANDLE=@your_handle bun run new:episode <slug> --intent=<informative|data|workflow|social|brand|vfx>

cp public/voice/<slug>/voice.mp3 src/episodes/<slug>/assets/voice.mp3
cp public/voice/<slug>/captions.json src/episodes/<slug>/assets/captions.json
```

Then edit `src/episodes/<slug>/scene-spec.json` so the scenes match the chosen outline. Follow the matching intent short skill (`short-informative`, `short-data-visual`, `short-workflow-explainer`, `short-social-overlay`, `short-brand-system`, or `short-vfx-experimental`) for scene-type selection, slot ranges, and copy, and use `audio-pipeline` for caption alignment notes.

- Compose scenes only from the 17 scene-types; respect each type's slot ranges.
- `outro` is the final scene (brand sign-off).
- Palette from stage 2, NOT reusing previous short's primary.
- Time scene durations to the word-level timestamps in `captions.json` so beats land on the right words.

Validate, then assemble, then lint:

```bash
bun run scene:check src/episodes/<slug>/scene-spec.json   # validate against scene-type manifests
bun run assemble <slug>                                    # regenerate index.html (1:1 from spec)
bunx hyperframes lint src/episodes/<slug>                  # HTML composition lint
```

Re-run `bun run assemble <slug>` after every spec edit. Do not touch the generated `index.html` directly.

## Stage 5 -- Per-scene visual QA + Gate 3

Run per-scene QA: it snapshots key frames per scene and runs `hyperframes inspect` for overflow/overlap. No full mp4 is produced here.

```bash
bun run scripts/scene-qa.mjs <slug>
# writes renders/<slug>-qa/<scene-id>/*.png + report.json
```

### Gate 3 -- approve/reject each scene

Present the per-scene stills and `report.json` flags. For each scene, the user approves or rejects.

- Reject -> edit only that scene's entry in `scene-spec.json`, re-assemble, re-run QA scoped to the changed scenes:

```bash
bun run assemble <slug>
bun run scripts/scene-qa.mjs <slug> --scenes=<id1,id2>
```

Loop until every scene is approved. Do NOT proceed to the final render with any scene rejected.

## Stage 6 -- Final render + Gate 4

Only after all scenes pass Gate 3.

```bash
bun run render:episode <slug> --format=mp4
```

Review renders stay local by default, even when R2 is configured. Use `--keep-local` if the final accepted render should also leave a local mp4.

Validation loop:
1. Render completes
2. `ffprobe` confirms duration ~= audio + `meta.tail` (default 3)
3. `git status` shows `src/episodes/<slug>/` clean (only authored files: `scene-spec.json` + assets; `index.html` is generated)
4. `bun run typecheck && bun run lint` pass
5. If any check fails, fix the spec, re-assemble, re-QA the changed scenes, re-render

### Gate 4 -- User approves the mp4

Ask: "Apruebas el render? (si / no, cambiar X)"

If `no`: edit `scene-spec.json`, `bun run assemble <slug>`, re-run `scene-qa` on the touched scenes, re-render. Loop.
If `si`: proceed to stage 7.

## Stage 7 -- Push to Notion

Only after Gate 4 = approved. Two operations on `page_id = <chosen_page_id>`:

### 7a. Update properties

```
Status: { select: { name: "Asset Ready" } }
Asset Slug: { rich_text: [{ text: { content: "<slug>" } }] }
Title: { title: [{ text: { content: "✅ <new title>" } }] }  # if rewritten
```

### 7b. Append the page body

> **Read `references/notion-body-blocks.md`** for the exact block structure. Reference: the existing Notion entries (e.g. `short-03`) are the canonical template.

> **Read `references/publishing-copies.md`** for tone rules, character counts, hashtag guidelines, and code-block conventions for YouTube/Instagram/LinkedIn ES+EN copies.

## Slug numbering

```bash
ls src/episodes/ | grep -E '^short-[0-9]+$' | sort -V | tail -1
```

Default: `short-<N+1>` zero-padded to 2 digits. Honor override for topic-based slugs.

## TODO before closing session

- [ ] `examples/<slug>.txt` committed
- [ ] `src/episodes/<slug>/` committed (`scene-spec.json` + assets + generated `index.html`)
- [ ] Conventional commit `feat(<slug>): <topic>`
- [ ] Notion page Status = Asset Ready, Asset Slug = `<slug>`, body complete
- [ ] `renders/<slug>.mp4` exists (gitignored, no commit)

## See also

- `short-router` -- classify intent, route to the matching intent short skill that writes `scene-spec.json`
- `canonical-short` -- full scene-spec build pipeline this skill defers to in stage 4
- `audio-pipeline` -- TTS + Scribe details
- `new-episode` -- scaffolder (starter scene-spec.json + assemble)
- `AGENTS.md` -- scene-hub model + critical constraints
- Existing Notion entries `short-03..short-08` (Notion-only — no longer in the repo) as body structure reference
