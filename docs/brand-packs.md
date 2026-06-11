# Brand packs (white-label)

A brand pack stamps a per-episode token set (`--brand-*` CSS variables) into the generated HTML so the same scene-type library renders any company's branding. Episodes opt in by declaring a brand slug; episodes without one are unaffected — every tokenised selector carries a literal fallback that matches the Vidext baseline byte-for-byte.

## Declaring a brand

Two entry points, with different timing:

| Where | Field | When it stamps | Use for |
|-------|-------|----------------|---------|
| `src/episodes/<slug>/scene-spec.json` | top-level `"brand": "<slug>"` | **Assemble time** — baked into the generated `src/.../index.html`, so scene-qa and render see it for free. | The normal authoring path. |
| `src/episodes/<slug>/meta.json` | `"brand": "<slug>"` | **Render time** — `render-episode.ts` re-stamps the working copy under `out/`. | Render-time **override** only. Leave unset otherwise. |

`bun run assemble <slug>` resolves `spec.brand` against `apps/hyperframe/brands/<slug>/brand.json` and injects a `<style id="brand-vars" data-brand="<slug>">` block with one `--brand-<key>` variable per palette key. A declared brand whose `brand.json` is missing or invalid is a hard error at assemble time. On render, `render-episode.ts` resolves `meta.brand ?? data-brand` (sniffed from the assembled HTML), so the assemble-time stamp survives into `out/` and the publish gate always evaluates. Re-stamping with the same `brand.json` is byte-idempotent — both emitters share one block builder (`scripts/lib/brand-pack.ts`).

`brand.json` is an assemble input that lives outside `scene-spec.json`: editing it requires re-running `assemble`, same rule as spec edits.

## The brand.json contract

`BrandPack` reads exactly four fields:

| Field | Description |
|-------|-------------|
| `slug` | Brand slug; echoed onto the stamped `<style data-brand="…">`. |
| `palette` | **Required.** Generic key/value map. Each key `k` becomes `--brand-<k>`. Radii, font stack, and shadows live here too — one map, one stamp loop. |
| `publishable` | Optional legal gate. `false` logs a publish warning — **at render only**; assemble and scene-qa won't warn. |
| `notes` | Optional freeform note, appended to the `publishable=false` warning. |

No other fields are read.

## The 11-token contract

The `promo-*` scene-type family (`promo-intro-card`, `promo-hero`, `promo-card-speaker`, `promo-blur-cta`, `promo-agenda`, `promo-quote`, `promo-details`) consumes these tokens via `var(--brand-<key>, <fallback>)`. Every key is optional in a brand pack — a missing key resolves to the Vidext fallback baked into the scene CSS.

| Palette key | Role | Vidext value (= fallback) |
|-------------|------|---------------------------|
| `paper` | Frame/background surface: per-scene bg fields, scene-pad backgrounds, light badge backgrounds, CTA surface over photos. | `#fff` |
| `ink` | Primary text on light surfaces + solid dark fills (badge dots, solid badge pills, CTA bg over white frames). | `#000` |
| `ink-inverse` | Text/labels on dark or photographic surfaces (copy over photos, labels inside ink-filled pills/CTAs). | `#fff` |
| `surface` | Soft secondary surface: speaker-card badge bg, agenda items, detail chips. | `#f4f4f4` |
| `line` | Hairline border on badges, agenda items, chips (always `1px solid`). | `#e5e5e5` |
| `muted` | Muted tertiary text (agenda item numbers). | `#b3b3b3` |
| `font` | Brand sans stack, every text selector in the family. | `"Inter", system-ui, sans-serif` |
| `radius-pill` | Full-pill radius: CTA buttons + solid badge pills. | `128px` |
| `radius-chip` | Chip/badge radius: light badges, agenda items, detail chips. | `40px` |
| `radius-card` | Photo/media card radius. | `65px` |
| `shadow-badge` | Whole badge box-shadow (full shadow value, not just a color). | `0 4px 2px rgba(157, 155, 155, 0.05)` |

The `#fff` split is by role, not value: backgrounds map to `paper`, text on photos/dark maps to `ink-inverse` — a dark-paper brand works without touching CSS. Structural geometry (positions, sizes, gaps, font sizes, `border-radius: 50%` circles) stays literal and is not tokenised.

### Extended token: `accent`

The carousel `promo-*` types (`promo-highlight-hook`, `promo-signal*`) additionally consume `--brand-accent` — the marker-highlight / chip-badge color (fallback `#c2f902`, measured from the Vidext "Carrusel señales" reference). Packs that don't set `accent` render those types with the lime fallback; the original 11-token family ignores it entirely. Any extra palette key is emitted as `--brand-<key>`, so packs can carry it today without schema changes.

Reference pack: `apps/hyperframe/brands/vidext/brand.json` — its values mirror the fallbacks exactly, so a Vidext-branded episode is pixel-identical to an unbranded one.

```json
{
  "slug": "vidext",
  "palette": {
    "paper": "#fff",
    "ink": "#000",
    "ink-inverse": "#fff",
    "surface": "#f4f4f4",
    "line": "#e5e5e5",
    "muted": "#b3b3b3",
    "font": "\"Inter\", system-ui, sans-serif",
    "radius-pill": "128px",
    "radius-chip": "40px",
    "radius-card": "65px",
    "shadow-badge": "0 4px 2px rgba(157, 155, 155, 0.05)"
  },
  "publishable": true
}
```

## Workflow

```bash
cd apps/hyperframe
# 1. Create brands/<your-brand>/brand.json with a "palette" map (and
#    publishable=false + notes for partner/internal brands).
# 2. Add "brand": "<your-brand>" at the top level of
#    src/episodes/<slug>/scene-spec.json.
bun run assemble <slug>                  # stamps --brand-* vars into src/…/index.html
bun run scripts/scene-qa.ts <slug>       # per-scene QA sees the brand vars
bun run render:episode <slug> --format=mp4
```

Verify the stamp landed: the assembled `index.html` must contain `data-brand="<your-brand>"`. The spec schema is non-strict, so a typo'd field name (e.g. `"brnad"`) is silently ignored and the episode renders unbranded.

A non-Inter `font` needs two pieces: the universal shell registers `@font-face` for Inter and Berkeley Mono only, so declare the brand font in the pack's optional `fonts` array and ship the woff2 in each consuming episode's `assets/`:

```json
"fonts": [{ "family": "Sora", "file": "SoraVariable.woff2", "weight": "100 900" }]
```

Each entry is emitted as an `@font-face` inside the stamped `brand-vars` style block, with `src: url("assets/<file>")` resolving relative to the episode's `index.html` (`weight` defaults to `100 900`). The rule is emitted unconditionally — if the file is missing from the episode `assets/`, the render silently falls back to `system-ui` and line wraps drift.

## Not implemented

- `bun run new:episode --brand=<slug>` — no `--brand` flag exists; the scaffolder takes only `--intent`, `--width`, `--height`, `--slug`.
- A baseline `brands/default/brand.json` — does not exist on disk; `brands/vidext/` is the only pack.
- `handle`, `wordmark`, `voice.*` fields — not read by any code.
- Copying the brand woff2 into episode `assets/` is still manual; nothing validates the file exists at assemble time.
