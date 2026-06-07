# Brand packs (white-label)

> **Status: half-shipped.** The render-time contract below is real and working. The authoring side is **not implemented**: `new:episode` has no `--brand` flag and the `apps/hyperframe/brands/` directory does not exist yet. To use a brand pack today you must create `brands/<slug>/brand.json` and set `meta.brand` in the episode's `meta.json` by hand.

A brand pack stamps a per-episode color palette into the render. It applies only to episodes whose `meta.json` declares `"brand": "<slug>"`; existing demos (which keep a hardcoded `:root` block) are unaffected.

## The render-time contract

On render, `render-episode.ts` reads `meta.brand` and resolves `apps/hyperframe/brands/<slug>/brand.json`. If `meta.brand` is set but that file is missing, the render **fails** with an error. The brand JSON it parses (`BrandPack` interface, `render-episode.ts:211-216`) reads exactly four fields:

| Field | Description |
|-------|-------------|
| `slug` | Brand slug; echoed onto the stamped `<style data-brand="…">`. |
| `palette` | **Required.** CSS variable map. Each key `k` becomes `--brand-<k>` at render time. |
| `publishable` | Optional legal gate. `false` logs a publish warning at render. |
| `notes` | Optional freeform note, appended to the `publishable=false` warning. |

No other fields are read. The palette is turned into a `:root { --brand-<key>: <value>; … }` block and injected into the `<style id="brand-vars">` placeholder that the universal shell already emits (`templates/_shell/shell.html.tmpl:9`). The stamp lands only in the working copy under `apps/hyperframe/out/episodes/<slug>/index.html`; `src/` stays diff-clean.

When `publishable === false`, `render-episode.ts` (lines 469-472) emits a warning naming the brand and its `notes`. CI consumers should treat that as a publish gate.

## Workflow (manual today)

```bash
cd apps/hyperframe
# 1. Create brands/<your-brand>/brand.json with a "palette" map (and optional
#    publishable=false + notes for partner brands).
# 2. Add "brand": "<your-brand>" to src/episodes/<slug>/meta.json.
# 3. Reference var(--brand-<key>) wherever you want the palette to apply.
bun run render:episode <slug>   # reads meta.brand, stamps palette into out/…/index.html
```

## Not implemented

- `bun run new:episode --brand=<slug>` — no `--brand` flag exists; the scaffolder takes only `--intent`, `--width`, `--height`, `--slug`.
- `brands/` directory and a baseline `brands/default/brand.json` — neither exists on disk.
- `handle`, `wordmark`, `fonts`, `voice.*` fields — not read by any code.
