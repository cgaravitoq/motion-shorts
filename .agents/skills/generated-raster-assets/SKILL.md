---
name: generated-raster-assets
description: >
  Use when a Hyperframes short scene should use AI-generated raster images instead of pure
  HTML/CSS/SVG: product or workspace screenshots, handoff bundle diagrams, dense visual explainers,
  connector-heavy layouts, or any scene where card collisions, clipped text, or weak product-style
  visuals are likely. Produces prompt patterns, save-path/provenance rules, render-safe HTML usage,
  and frame-inspection checks for assets under apps/hyperframe/src/episodes/<slug>/assets/generated/.
---

# Generated Raster Assets

Use this skill inside `canonical-short` when a scene needs a generated PNG/WebP source asset that will be animated inside monolithic Hyperframes HTML.

## Decision Gate

Prefer a generated raster asset when at least one condition is true:

- The scene is a product/workspace screenshot, fake app UI, handoff bundle, dashboard, moodboard, or artifact stack.
- The layout needs many connectors, arrows, labels, cards, or small grouped objects in 9:16.
- HTML/CSS would create fragile overlaps, clipped text, or double-framed UI objects.
- The visual needs product polish more than per-node animation.

Stay in HTML/CSS/SVG when the scene needs editable live counters, precise data bars, seek-safe per-node sequencing, or catalog snippets already cover the layout cleanly.

## Workflow

1. Run the normal catalog preflight first. Choose image-friendly components such as `screenshot-spotlight`, `image-ken-burns`, `asset-stack-parallax`, `device-screen-pan`, or `source-image-reveal` when they fit.
2. Read `references/prompt-patterns.md` and draft the asset prompt before editing `index.html`.
3. Generate the asset at 1080x1920 for full-scene images, or at the exact intended crop/aspect for framed objects.
4. Save approved source assets under:

```text
apps/hyperframe/src/episodes/<slug>/assets/generated/
```

5. Add a provenance note in `assets/source.json`, `assets/research/research.md`, or a compact `assets/generated/provenance.md` if no source package exists.
6. Reference the file with a relative path from `index.html`, for example `assets/generated/workspace-overview.png`.
7. Animate the image object directly. Do not wrap product screenshots, app windows, or handoff bundles inside another generic glass/card shell.
8. Validate with Hyperframes lint, catalog check, and rendered frame inspection.

## Render-Safe HTML Rules

- Use `<img src="assets/generated/<name>.png" alt="">`; keep filenames lowercase kebab-case.
- Give the asset a stable class and dimensions with `width`, `height`, `object-fit`, and `object-position`.
- Avoid in-image body copy. Keep generated text to short labels; put important copy in HTML so captions, accents, and layout stay controllable.
- If the generated asset includes Spanish text, verify accents and `ñ` in the rendered frame. Regenerate or overlay corrected HTML text if the model misses orthography.
- Treat the raster image as a source asset: commit it when it is needed to render the episode. Do not commit local mp4/mov/webm renders or ignored audio caches.

## Validation

Minimum checks for an episode using generated raster assets:

```bash
cd apps/hyperframe
bunx hyperframes lint src/episodes/<slug>
bun run catalog:check src/episodes/<slug>/index.html
bun run render:episode <slug> --format=mp4 --keep-local
```

Inspect frames near scene entry, mid-scene, and scene exit. Confirm:

- Generated assets are visible, sharp enough, and not cropped unintentionally.
- Connector-heavy visuals have no card/line collisions.
- No important labels are covered by captions, brand corner, or final outro.
- Spanish visible text preserves accents and `ñ`.
- Provenance is documented for generated assets and any external source references.

## References

- `references/prompt-patterns.md` -- prompt templates, anti-patterns, and QA rubric.
- `.agents/skills/canonical-short/SKILL.md` -- full short-production flow.
- `apps/hyperframe/src/episodes/<slug>/assets/generated/workspace.png` -- workspace screenshot pattern (example path).
- `apps/hyperframe/src/episodes/<slug>/assets/generated/handoff-bundle.png` -- handoff bundle diagram pattern (example path).
