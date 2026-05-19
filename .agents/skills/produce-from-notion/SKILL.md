---
name: produce-from-notion
description: >
  Use when the user wants to produce a short from a Notion content brief -- phrases like "produce
  the next short", "siguiente short", "/produce-from-notion", or when they share a Notion URL from
  the Shorts & Reels database. Handles the end-to-end flow: pulling the brief, drafting script
  alternatives with user approval, generating audio, building the HTML, rendering, and pushing
  completion status back to Notion. Skip if the script already exists in the repo (use
  canonical-short directly) or the topic has no Notion entry.
---

# produce-from-notion

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `examples/<slug>.txt`, `public/voice/<slug>/`, `renders/<slug>.mp4` are app-relative.

> Skill-only orchestrator. Zero local scripts. Uses Notion MCP tools directly and shells out to existing `bun run audio` / `bun run new:episode` / `bun run render:episode`. Combines with `canonical-short` (HTML build) and `audio-pipeline` (TTS + STT details).

## Preconditions / Catalog preflight

Before drafting visuals, inspect `packages/catalog/manifest.json` and `.agents/skills/canonical-short/references/inline-components-catalog.md`, then run `bun run catalog:list` from `apps/hyperframe/` to choose inline-safe component IDs for the selected Notion brief. Remote agents must use MCP `list_visual_components` for the same lookup.

If the Notion brief references an external source URL, run `bun run capture:source <url> --slug=<slug> [--scaffold]` before composing so `source.json` and supporting assets are available.

`index.html` must include `<!-- catalog: [...] -->` on the line immediately after `<!doctype html>` (no blank line, no other comments between), with required brand IDs plus the selected intent-specific catalog IDs.

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

## Pipeline (6 stages, 3 HITL gates)

```
1. Pull from Notion
   | (agent presents N entries with Status: Hook Drafted)
2. Draft 3 alternative scripts (script + outline + palette + hook-type)
   | HITL #1 -- user picks 1 of 3
3. Generate audio (bun run audio) + afplay
   | HITL #2 -- user OKs voice quality (loop until approved)
4. Build monolithic HTML following canonical-short
5. Render (uses meta.tail = 3 by default)
   | HITL #3 -- user OKs the rendered mp4
6. Push to Notion (Status, Asset Slug, full body)
```

**The HITL gates exist where user taste differentiates outcomes:**
- #1 (creative angle) -- biggest leverage point
- #2 (voice quality) -- cheapest fix cycle (script edit, not HTML rework)
- #3 (final approval) -- before irreversible Notion writeback

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

Generate **3 script drafts** with explicitly different angles. Don't write HTML, don't run audio, don't touch disk.

### Draft requirements per option

```
### Draft <A|B|C> -- <Hook Type label>

**Script** (~80-100 words ES, target ~35-45s at speed=1.0):
<verbatim text for ElevenLabs>

**5-scene outline:**
1. Hook       (0-Xs)    -- <one-line visual description>
2. Concept    (Xs-Ys)   -- <visual>
3. Detail     (Ys-Zs)   -- <visual>
4. Adoption   (Zs-Ws)   -- <visual>
5. Payoff     (Ws-end)  -- <visual>

**Palette proposal:** primary #hex + accent #hex + secondary #hex
   (must NOT match the previous short's primary)

**Hook Type used:** <one of 6>
**Why this angle:** <one sentence>
```

### Angle diversification rule

The 3 drafts MUST use different `Hook Type` values from: Bold Claim / Curiosity Gap / Question / Before/After / Pattern Interrupt / Demo Reveal. Do NOT generate 3 Bold Claims with different wording.

### TTS pre-flight

Apply pronunciation gotchas to ALL 3 scripts before showing them: acronyms with periods, Spanish cognates over English tech terms, numbers in words. This way Carlos doesn't pick a TTS landmine.

## HITL #1 -- User picks a draft

Ask: "Cual te convence: A, B o C? Refinar alguno antes de audio?"

Acceptable responses:
- `A` / `B` / `C` -> proceed to stage 3
- `A pero cambia X` / `B con el payoff de C` -> revise inline, re-show
- `Ninguno, replantea` -> generate 3 new
- `Pause, voy a refinar el Hook Text en Notion` -> wait, re-pull

Do NOT proceed without an explicit pick.

## Stage 3 -- Audio + HITL #2

### Pick the slug

Check `ls apps/hyperframe/src/episodes/` for `short-NN`. Default: increment highest existing index. Honor override for topic-based slugs.

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

### HITL #2 loop

Ask: "Suena bien? Algun termino mal pronunciado?"

If `si`: copy outputs to episode assets, proceed to stage 4.
If `no, cambiar X`: edit script, re-run audio, re-`afplay`. Loop until `si`.

## Stage 4 -- Scaffold + build HTML

```bash
BRAND_HANDLE=@your_handle bun run new:episode <slug>   # or set BRAND_HANDLE in .env

cp public/voice/<slug>/voice.mp3 apps/hyperframe/src/episodes/<slug>/assets/voice.mp3
cp public/voice/<slug>/captions.json apps/hyperframe/src/episodes/<slug>/assets/captions.json
```

Then build `apps/hyperframe/src/episodes/<slug>/index.html` following **`canonical-short` verbatim** and the regenerated catalog reference:

- Monolithic single-file (~600-1200 LOC)
- 5-scene template aligned to the chosen outline
- `#brand-corner` uses the logo SVG watermark in the upper-right corner
- FADE = 0.75s scene cross-fades
- Hierarchical spacing (margins, not uniform `gap`)
- `<script id="captions-data">[]</script>` empty in source (render-episode auto-inlines)
- `#captions` CSS block with `.--active { color: var(--primary-2) }`
- Karaoke uses `{ maxChars, maxTokens }` only
- Counter symbols split into own `<span>` if any
- Palette from stage 2, NOT reusing previous short's primary
- Theme tokens: `--ink/--paper/--muted/--dim/--accent`. Font literal, never `var()`.
- Component choices come from `.agents/skills/canonical-short/references/inline-components-catalog.md` and `packages/catalog/manifest.json`.

GSAP timing: read word-level timestamps from `captions.json` so events fire on exact words. Pattern:
```js
tl.to("#prim-tools", { scale: 1.04, duration: 0.3, yoyo: true, repeat: 1 },
      T.arch.in + 6.1);
```

## Stage 5 -- Render

```bash
bun run render:episode <slug> --format=mp4
```

With R2 configured, verified artifacts upload to R2 and local render outputs are
deleted by default. Use `--keep-local` only when HITL approval needs a local mp4;
otherwise share/review the R2 URL printed after upload.

Validation loop:
1. Render completes
2. `ffprobe` confirms duration ~= audio + `meta.tail` (default 3)
3. Sample frames at scene boundaries via `ffmpeg -ss N -frames:v 1` -- look correct
4. `git status` shows `apps/hyperframe/src/episodes/<slug>/` clean (only authored files)
5. `bun run typecheck && bun run lint` pass
6. If any check fails, fix and re-render

## HITL #3 -- User approves the mp4

```bash
bun run render:episode <slug> --format=mp4 --keep-local
# then review renders/<slug>.mp4, or use the R2 URL from the default render
```

Ask: "Apruebas el render? (si / no, cambiar X)"

If `no`: iterate on HTML (timing, copy, palette, spacing), re-render, loop.
If `si`: proceed to stage 6.

## Stage 6 -- Push to Notion

Only after HITL #3 = approved. Two operations on `page_id = <chosen_page_id>`:

### 6a. Update properties

```
Status: { select: { name: "Asset Ready" } }
Asset Slug: { rich_text: [{ text: { content: "<slug>" } }] }
Title: { title: [{ text: { content: "✅ <new title>" } }] }  # if rewritten
```

### 6b. Append the page body

> **Read `references/notion-body-blocks.md`** for the exact 20-item block structure. Reference: the existing Notion entries (e.g. `short-03`) are the canonical template.

> **Read `references/publishing-copies.md`** for tone rules, character counts, hashtag guidelines, and code-block conventions for YouTube/Instagram/LinkedIn ES+EN copies.

## Slug numbering

```bash
ls apps/hyperframe/src/episodes/ | grep -E '^short-[0-9]+$' | sort -V | tail -1
```

Default: `short-<N+1>` zero-padded to 2 digits. Honor override for topic-based slugs.

## TODO before closing session

- [ ] `examples/<slug>.txt` committed
- [ ] `apps/hyperframe/src/episodes/<slug>/` committed (all assets + source)
- [ ] Conventional commit `feat(<slug>): <topic>`
- [ ] Notion page Status = Asset Ready, Asset Slug = `<slug>`, body complete
- [ ] `renders/<slug>.mp4` exists (gitignored, no commit)

## See also

- `canonical-short` -- HTML build pattern this skill defers to in stage 4
- `audio-pipeline` -- TTS + Scribe details
- `new-episode` -- scaffolder
- `AGENTS.md` -- critical constraints
- Existing Notion entries `short-03..short-08` (Notion-only — no longer in the repo) as body structure reference
