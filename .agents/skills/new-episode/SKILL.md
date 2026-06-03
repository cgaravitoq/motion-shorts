---
name: new-episode
description: >
  Use when the user wants to start a new video episode -- scaffolding the project directory,
  starter scene-spec.json, and metadata under apps/hyperframe/src/episodes/. Defer to this skill
  whenever the user says "create a new episode", "scaffold a short", or "start a new video", even
  without mentioning the scaffolder tool directly. Skip for rendering or editing existing episodes.
---

# New episode

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `examples/<slug>.txt`, `public/voice/<slug>/` are app-relative.

Scaffold a new Hyperframes episode at `apps/hyperframe/src/episodes/<slug>/`. An episode is a typed **`scene-spec.json`**; a deterministic assembler turns that spec into the monolithic `index.html`. You author by editing the spec and re-assembling — **never hand-edit `index.html`** (it is generated, and identical specs produce identical bytes).

> **Producing a vertical 9:16 short?** This skill only scaffolds the starter project. After scaffolding, follow `.agents/skills/canonical-short/SKILL.md` for the e2e playbook (voice config, scene-type selection, per-scene QA gate, render).

## Pre-flight

1. **Slug uniqueness.** `ls apps/hyperframe/src/episodes/` -- abort if the slug already exists with content (the scaffolder also refuses a non-empty dir).
2. **Slug format.** Lowercase kebab-case, regex `^[a-z0-9][a-z0-9-]*$`. Convention: `short-NN` for vertical reels, topic-slug for one-offs.
3. **Pick aspect.** Default vertical 9:16 (`--width=1080 --height=1920`). For horizontal `--width=1920 --height=1080`. For LinkedIn square `--width=1080 --height=1080`.
4. **Pick an intent (optional).** `--intent=` seeds the spec from an intent skeleton (a sensible hook-first / outro-last scene order). One of: `informative`, `data`, `workflow`, `social`, `brand`, `vfx`. Omit for a generic `hook -> title-cards -> outro` starter.

## Run

```bash
bun run new:episode <slug> [--intent=informative|data|workflow|social|brand|vfx] [--width=1080] [--height=1920]
```

The scaffolder seeds the starter `scene-spec.json` from the intent skeleton (each scene pre-filled with its scene-type's `sample.json` params), then assembles `index.html` so the episode is immediately previewable.

## What the scaffolder writes

```
apps/hyperframe/src/episodes/<slug>/
  scene-spec.json     # the source of truth: slug, lang, width/height, palette, scenes[]
  index.html          # GENERATED from the spec by the assembler — never hand-edit
  meta.json           # { "id": "<slug>", "name": "<slug>", "description": "", "tail": 3 }
  hyperframes.json    # { paths: { assets: "assets" } } registry/paths config
  assets/.gitkeep     # placeholder; voice.mp3 + captions.json drop in later
  lib -> ../../lib    # symlink so relative lib/... imports resolve
```

The starter `scene-spec.json` looks like this (intent skeleton + sample slots):

```json
{
  "slug": "<slug>",
  "lang": "es",
  "width": 1080,
  "height": 1920,
  "palette": { "accent": "#5b6cff", "accent2": "#e9ff00" },
  "scenes": [
    { "id": "hook", "type": "hook", "slots": { "eyebrow": "...", "title": "...", "subtitle": "..." } },
    { "id": "title-cards", "type": "title-cards", "slots": { "title": "...", "cards": [ /* ... */ ] } },
    { "id": "outro", "type": "outro", "slots": { "source": "" } }
  ]
}
```

The assembler owns everything universal — background layers, the track-97 `#brand-corner` watermark, the single paused GSAP timeline + crossfades, track allocation (scenes on 4,5,6,8,9..; outro fixed on 7; 97 corner; 98 audio; 99 captions), captions/audio tracks, and the `window.__timelines["<slug>"]` registry. Scene-types own only their content + entrance motion. There are **no per-episode JSON props files** beyond the spec.

The scaffold does NOT create `out/<slug>/` or `public/voice/<slug>/` — those come from `bun run audio`.

## After scaffolding (author the spec)

1. **Pick scene-types & fill slots.** Edit `scene-spec.json`: per scene set `id` (unique kebab), `type` (one of the 17 scene-types), optional `duration` (else the type default), optional `status` (`draft`/`approved` for the HITL loop), and `slots`. To see a type's exact slots and repeat ranges, run `bun run scene:gallery` or read `templates/scenes/<type>/v1/manifest.json` (remote agents: `list_scene_types` / `get_scene_type`). Keep `outro` as the final scene (it's pinned to track 7). Self-framed types (`code`, `social-card`) already encode the no-double-frame rule.
2. **Validate fast (no assembly):**
   ```bash
   bun run scene:check src/episodes/<slug>/scene-spec.json
   ```
3. **Re-assemble after every spec edit:**
   ```bash
   bun run assemble <slug>
   ```
4. **Per-scene visual QA:**
   ```bash
   bun run scripts/scene-qa.mjs <slug> [--scenes=id1,id2]
   ```
   Re-assembles, captures entry/mid/late key frames per scene, and runs `hyperframes inspect` for overflow/overlap (no full mp4). Iterate only the scenes you changed via `--scenes=<id>`.
5. **Generate voice + captions:**
   ```bash
   bun run audio examples/<slug>.txt --lang=es --out=public/voice/<slug>/
   ```
6. **Stage the assets** (the renderer does not auto-copy):
   ```bash
   cp public/voice/<slug>/voice.mp3     src/episodes/<slug>/assets/voice.mp3
   cp public/voice/<slug>/captions.json src/episodes/<slug>/assets/captions.json
   ```
7. **Final render** (only after per-scene approval):
   ```bash
   bun run render:episode <slug> --format=mp4
   ```

## Gotchas

- **Never hand-edit `index.html`.** It is fully generated from `scene-spec.json`. Any manual change is lost on the next `assemble`. Edit the spec, then `bun run assemble <slug>`.
- **`outro` is always last.** It's the pinned brand sign-off on fixed track 7; the brand corner fades out as it enters. Do not replace it with a plain text `@handle` card — the brand presence is the `outro` scene-type plus the shell's `#brand-corner`.
- **`render-episode.mjs` does NOT auto-copy assets.** Copy `voice.mp3` and `captions.json` manually from `public/voice/<slug>/` into the episode's `assets/`. Render is silent if `assets/voice.mp3` is absent.
- **Re-assemble after editing the spec, before QA or render.** `scene-qa` re-assembles for you, but `render:episode` reads whatever `index.html` is on disk.

## When NOT to use

- For a **render of an existing episode** — just run `bun run render:episode <slug>`.
- For **editing an existing short** — edit its `scene-spec.json` and `bun run assemble <slug>`; no scaffold needed.
