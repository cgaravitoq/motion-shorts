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

Use this skill when a scene needs a generated PNG/WebP source asset that will be animated inside the monolithic Hyperframes HTML. The episode is a typed `scene-spec.json` assembled deterministically into `index.html` — you never hand-edit `index.html`. A generated raster is wired in through a scene-type slot that accepts an image (see Integration Point below).

## Decision Gate

Prefer a generated raster asset when at least one condition is true:

- The scene is a product/workspace screenshot, fake app UI, handoff bundle, dashboard, moodboard, or artifact stack.
- The layout needs many connectors, arrows, labels, cards, or small grouped objects in 9:16.
- HTML/CSS would create fragile overlaps, clipped text, or double-framed UI objects.
- The visual needs product polish more than per-node animation.

Stay in pure scene-type HTML/CSS/SVG when the scene needs editable live counters, precise data bars, seek-safe per-node sequencing, or an existing text-driven scene-type (`hook`, `metric`, `flow`, `comparison`, etc.) already covers the layout cleanly.

## Integration Point

A generated image must be referenced from a scene-type slot that takes an image. The current 39-type hub includes image-capable scene-types. Common general-purpose choices are `media-split`, `annotated-asset`, `statement-lower-third`, and `before-after`; promo scene-types also expose image slots for brand-pack story ads and carousel frames.

So before generating, confirm where the asset will land:

- Inspect the candidate scene-type by reading `templates/scenes/<type>/v1/manifest.json` and look for an image-capable slot (kind `image`, or a slot whose value is an asset path).
- **If the chosen scene-type does not expose an image slot, switch types or flag it.** Do not assemble an episode that references a slot the manifest does not define.

## Workflow

1. Pick the scene-type and confirm it exposes an image slot (Integration Point above). If none does, stop and flag.
2. Read `references/prompt-patterns.md` and draft the asset prompt before touching `scene-spec.json`.
3. Generate the asset at 1080x1920 for full-scene images, or at the exact intended crop/aspect for framed objects.
4. Save approved source assets under:

```text
apps/hyperframe/src/episodes/<slug>/assets/generated/
```

5. Add a provenance note in `assets/source.json`, `assets/research/research.md`, or a compact `assets/generated/provenance.md` if no source package exists.
6. Set the scene-type's image slot in `scene-spec.json` to a relative path, for example `assets/generated/workspace-overview.png`.
7. Regenerate the HTML: `bun run assemble <slug>`. The asset is animated by the scene-type's own timeline — do not wrap product screenshots, app windows, or handoff bundles inside another generic glass/card shell (the self-framed-object rule is already encoded in `code` and `social-card`).
8. Validate with per-scene QA and Hyperframes lint (see Validation).

## Render-Safe Asset Rules

- Keep filenames lowercase kebab-case under `assets/generated/`.
- Generate at a fixed pixel size and the intended aspect so the scene-type's `object-fit` / `object-position` crop is predictable.
- Avoid in-image body copy. Keep generated text to short labels; put important copy in scene-type text slots so captions, accents, and layout stay controllable.
- If the generated asset includes Spanish text, verify accents and `ñ` in the rendered frame. Regenerate, or move the text into a scene-type text slot if the model misses orthography.
- Treat the raster image as a source asset: commit it when it is needed to render the episode. Do not commit local mp4/mov/webm renders or ignored audio caches.

## Validation

Minimum checks for an episode using generated raster assets (CWD = `apps/hyperframe`):

```bash
bun run scene:check src/episodes/<slug>/scene-spec.json
bun run assemble <slug>
bunx hyperframes lint src/episodes/<slug>
bun run scripts/scene-qa.ts <slug>
```

`scene-qa.ts` snapshots key frames per scene and runs `hyperframes inspect` for overflow/overlap, writing `renders/<slug>-qa/<scene-id>/*.png` + `report.json` (no full mp4). Use `--scenes=<id1>,<id2>` to re-check only the scenes whose assets changed. Inspect the per-scene frames near scene entry, mid-scene, and scene exit. Confirm:

- Generated assets are visible, sharp enough, and not cropped unintentionally.
- Connector-heavy visuals have no card/line collisions.
- No important labels are covered by captions, brand corner, or the final outro.
- Spanish visible text preserves accents and `ñ`.
- Provenance is documented for generated assets and any external source references.

Only after per-scene visual approval, run the final full render: `bun run render:episode <slug> --format=mp4 [--keep-local]`.

## References

- `references/prompt-patterns.md` -- prompt templates, anti-patterns, and QA rubric.
- `.agents/skills/canonical-short/SKILL.md` -- full short-production flow.
- `apps/hyperframe/src/episodes/<slug>/assets/generated/workspace.png` -- workspace screenshot pattern (example path).
- `apps/hyperframe/src/episodes/<slug>/assets/generated/handoff-bundle.png` -- handoff bundle diagram pattern (example path).
