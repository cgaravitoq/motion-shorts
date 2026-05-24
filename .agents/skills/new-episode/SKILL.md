---
name: new-episode
description: >
  Use when the user wants to start a new video episode -- scaffolding the project directory, HTML
  template, and metadata under apps/hyperframe/src/episodes/. Defer to this skill whenever the
  user says "create a new episode", "scaffold a short", or "start a new video", even without
  mentioning the scaffolder tool directly. Skip for rendering or editing existing episodes.
---

# New episode

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `examples/<slug>.txt`, `public/voice/<slug>/` are app-relative.

Scaffold a new Hyperframes episode project at `apps/hyperframe/src/episodes/<slug>/`.

> **Producing a vertical 9:16 short?** This skill only scaffolds the empty project. After scaffolding, follow `.agents/skills/canonical-short/SKILL.md` for the e2e playbook (voice config, 5-scene template, hierarchical spacing, brand-corner crossfade, render). The production shorts in `apps/hyperframe/src/episodes/short-{01..08}/` are reference implementations.

## Pre-flight

1. **Slug uniqueness.** `ls apps/hyperframe/src/episodes/` -- abort if the slug already exists with content.
2. **Slug format.** Lowercase kebab-case, regex `^[a-z0-9][a-z0-9-]*$`. Convention: `short-NN` for vertical reels, `ep-NN` for horizontal, topic-slug for one-offs.
3. **Pick aspect.** Default vertical 9:16 (`--width=1080 --height=1920`). For horizontal `--width=1920 --height=1080`. For LinkedIn square `--width=1080 --height=1080`.
4. **Catalog preflight.** Inspect `packages/catalog/manifest.json` and `.agents/skills/canonical-short/references/inline-components-catalog.md`, then run `bun run catalog:list` from `apps/hyperframe/`; remote agents use MCP `list_visual_components`.

## Run

```bash
bun run new:episode <slug> [--width=1080] [--height=1920] [--with-desktop] [--with-square]
```

Pass `--with-desktop` to additionally stamp a 16:9 `index.desktop.html` (1920x1080, 30 fps) seeded from `apps/hyperframe/templates/desktop-1080p.html`. The vertical `index.html` is always written; the desktop variant is purely additive. See `docs/formats.md` for the desktop profile, title-safe / action-safe insets, and YouTube UI dead-zone callouts.

Pass `--with-square` to additionally stamp a 1:1 `index.square.html` (1080x1080, 30 fps) seeded from `apps/hyperframe/templates/square-1080.html`. The square variant is additive and shares the same assets as the vertical short.

## What the scaffolder writes

```
apps/hyperframe/src/episodes/<slug>/
  index.html          # root composition: stage + <audio id="voiceover"> + #captions overlay
  index.desktop.html  # optional, only with --with-desktop (16:9 1920x1080)
  index.square.html   # optional, only with --with-square (1:1 1080x1080)
  meta.json           # { "id": "<slug>", "name": "<slug>", "description": "", "tail": 3 }
  hyperframes.json    # registry + paths config
  assets/.gitkeep     # placeholder; voice.mp3 + captions.json drop in later
  lib -> ../../lib    # symlink so relative lib/... imports resolve
```

The desktop variant shares `assets/voice.mp3` and `assets/captions.json` with the short — same narration, two layouts. Render with `bun run render:episode <slug> --variant=desktop-1080p`. Render the square variant with `bun run render:episode <slug> --variant=square-1080`.

The line immediately after `<!doctype html>` in `index.html` is `<!-- catalog: [brand-logo-watermark, brand-logo-outro] -->`. The template includes the matching track-97 `#brand-corner` watermark and the production track-7 `#scene-brand-outro` from `packages/catalog/snippets/brand-logo-outro.html`: full 578x320 logo SVG split into animated pieces, grouped blur scale-up reveal for `cgaravitoq` / `AI Engineering` / source attribution, and logo pulse. Extend this declaration with IDs selected from the catalog before authoring scenes.

The scaffold does NOT create per-episode JSON props. Episodes are **monolithic single-file** -- write content directly into `index.html`.

The scaffold also does NOT create `out/<slug>/` or `public/voice/<slug>/` -- those are produced by `bun run audio`.

## After scaffolding

1. **Write the narration** in `examples/<slug>.txt`.
2. **Generate voice + captions:**
   ```bash
   bun run audio examples/<slug>.txt --lang=es --out=public/voice/<slug>/
   ```
3. **Stage the assets:**
   ```bash
   cp public/voice/<slug>/voice.mp3     apps/hyperframe/src/episodes/<slug>/assets/voice.mp3
   cp public/voice/<slug>/captions.json apps/hyperframe/src/episodes/<slug>/assets/captions.json
   ```
4. **Extend the catalog declaration** -- keep the scaffolded brand IDs and add intent-specific component IDs from `packages/catalog/manifest.json`.
5. **Build the HTML** -- author inline markup inside the stage `<div>`. Keep `class="clip" data-start data-duration data-track-index` on every timed element. Follow `canonical-short` for the full pattern.
6. **Render:**
   ```bash
   bun run render:episode <slug> --format=mp4
   ```

## Gotchas

- **Track-index convention is consistent now.** The scaffolder writes `data-track-index="98"` for audio and `"99"` for captions, matching production shorts. Brand corner uses `97`; production logo outro should be the final scene, normally `8`, unless the episode intentionally uses fewer scene tracks.
- **`#scene-brand-outro` is required.** Do not replace it with a text-only `@handle`, `#scene-logo-outro`, or a generic CTA. If a non-production demo disables it, the catalog comment must include `disabled: [brand-logo-outro] reason: "..."`.
- **Outro text motion is required.** `#brand-name`, `#brand-tagline`, and source attribution when present must use the standard blur scale-up reveal from `packages/catalog/snippets/brand-logo-outro.html`.
- **`render-episode.mjs` does NOT auto-copy assets.** Copy `voice.mp3` and `captions.json` manually from `public/voice/<slug>/` to `apps/hyperframe/src/episodes/<slug>/assets/`.

## When NOT to use

- For a **one-off square loop** (LinkedIn 1080x1080) without voiceover -- author directly, skip audio + captions.
- For a **render of an existing episode** -- just run `bun run render:episode <slug>`.
