---
name: extract-brand-pack
description: >
  Use when the user wants to capture a company's visual identity into a reusable brand pack --
  "extract the brand from this Figma", "create a brand pack for <company>", "haz que los promos
  usen la marca X". Produces apps/hyperframe/brands/<slug>/brand.json plus composed logo SVGs
  and the brand font file so the promo-* scene-type library renders that brand. Defer to this
  skill whenever a new brand must flow through scene-spec "brand". Skip for one-off color tweaks
  on a single episode (use spec.palette) and for building new scene-types from a design
  reference.
---

# Extract a brand pack

> **CWD**: all bash commands below assume `cd apps/hyperframe` first. Paths like `brands/<slug>/`, `src/episodes/<slug>/assets/` are app-relative.

A brand pack is `brands/<slug>/brand.json`: a flat `palette` map where each key `K` is emitted as the CSS custom property `--brand-K` into the generated episode's `<style id="brand-vars" data-brand="<slug>">` block at assemble time. The promo-* scene-types consume these variables as `var(--brand-K, <vidext-literal>)`, so **every key is optional** -- a missing key silently falls back to the Vidext value baked into the scene CSS. The pack also carries the brand's logo lockups (SVG) and font file (woff2) so episodes can bind them.

## The 11-token contract

| Key | Role | Vidext reference value |
|-----|------|------------------------|
| `paper` | Frame/background surface, light badge backgrounds, CTA surface over photos | `#fff` |
| `ink` | Primary text on light surfaces; solid dark fills (badge dots, solid pills, CTA bg over white frames) | `#000` |
| `ink-inverse` | Text/labels on dark or photographic surfaces; labels inside ink-filled pills/CTAs | `#fff` |
| `surface` | Soft secondary surface: speaker badge bg, agenda items, detail chips | `#f4f4f4` |
| `line` | Hairline `1px solid` border on badges, agenda items, chips | `#e5e5e5` |
| `muted` | Muted tertiary text (agenda item numbers) | `#b3b3b3` |
| `font` | Brand sans stack for every promo-* text selector | `"Inter", system-ui, sans-serif` |
| `radius-pill` | Full-pill radius: CTA buttons, solid badge pills | `128px` |
| `radius-chip` | Chip/badge radius: light badges, agenda items, detail chips | `40px` |
| `radius-card` | Photo/media card radius | `65px` |
| `shadow-badge` | Whole badge box-shadow (the full shadow value, not just a color) | `0 4px 2px rgba(157, 155, 155, 0.05)` |

Resolve each key by **role**, not by value. A brand may use the same hex for `paper` and `ink-inverse` (Vidext does); a dark-mode brand will not -- assign by where the color sits (background vs text-over-photo), and the scene CSS composes the rest.

## When to invoke / when NOT

- Invoke for: a new company/client brand that promo episodes will reference via `"brand": "<slug>"` in `scene-spec.json`.
- Skip for: tweaking one episode's accent colors (`spec.palette`), or turning a Figma frame into a new scene-type (different job: the 5-file scene-type contract).

## Workflow

### 1. Source intake

Figma is the preferred source. Confirm access first:

- `whoami` -- verify the Figma MCP session.
- `get_design_context <node-url>` -- structure, text styles, generated code for the brand frames.
- `get_variable_defs <node-url>` -- design tokens if the file defines variables.
- `get_screenshot <node-url>` -- pixel ground truth for every frame you extract from.

If the source is uploaded images or a style-guide PDF instead, the screenshots/images themselves are the ground truth; skip the variable steps and go straight to pixel sampling.

### 2. Resolve color tokens by measuring, not reading

Figma's generated code and variable defs **lie about text color and size** (a text node declared black has rendered white in practice). Never trust them alone. First save the ground-truth render to disk -- `get_screenshot` returns a short-lived hosted URL; download it:

```bash
curl -sL -o /tmp/brand-frame.png "<image_url from get_screenshot>"
python3 -c "import PIL, numpy" || pip3 install --user pillow numpy   # sampling deps preflight
```

Then, for each color token, sample the actual pixels:

```bash
python3 - <<'EOF'
from PIL import Image
img = Image.open("/tmp/brand-frame.png").convert("RGB")
# Sample where the role lives: a badge bg pixel for paper/surface,
# a border edge for line, a glyph interior for ink/ink-inverse/muted.
for label, xy in [("badge-bg", (120, 80)), ("border", (60, 140)), ("text", (200, 95))]:
    print(label, '#%02x%02x%02x' % img.getpixel(xy))
EOF
```

Cross-check each sampled value against the variable defs; when they disagree, the screenshot wins. Sample at least two instances of each role on different frames before committing a hex.

### 3. Measure radii and shadows -- never guess

- **Radii**: measure from `get_metadata` node geometry or by counting pixels along a corner in the screenshot crop. Map to the three radius roles (pill = fully rounded buttons, chip = badges/list items, card = photo/media containers). Record the literal px value.
- **Shadows**: read the effect from the design context if present; otherwise difference two crops (element vs background) to estimate offset/blur/alpha. Record the **whole** CSS shadow string as the `shadow-badge` value.
- **Font**: identify family + weights actually used in the frames. The `font` value is a full CSS stack, e.g. `"Sora", system-ui, sans-serif`.

### 4. Download assets immediately (7-day expiry)

Figma MCP asset URLs expire in 7 days. `curl -o` every logo/image **in the same session**, before doing anything else with them:

```bash
mkdir -p brands/<slug>
curl -o brands/<slug>/logo-icon.svg "<figma-asset-url>"
```

### 5. Compose logo lockups as single SVGs

Episodes bind one file per lockup, not separate icon + wordmark pieces. Compose them the way `src/episodes/vidext-webinar-ita/assets/figma/logo-vidext-white.svg` was built: open the icon SVG and the wordmark SVG, place both inside one `<svg>` with a shared `viewBox` sized to the measured Figma lockup geometry (icon at its offset, wordmark at its offset, correct gap), and recolor fills per variant. Produce one file per color variant:

```text
brands/<slug>/
  logo-<slug>-black.svg    # ink-on-light lockup
  logo-<slug>-white.svg    # inverse lockup for photos/dark surfaces
  logo-icon-black.svg      # standalone icon variants, if the brand uses them
  logo-icon-white.svg
```

Verify each composed SVG renders correctly (open it, or screenshot it) -- a wrong `viewBox` silently clips the wordmark.

### 6. Acquire the brand font

The universal shell's `@font-face` registers **only Inter and Berkeley Mono**. For a non-Inter brand, setting `--brand-font` alone is NOT enough -- two steps make the font real:

1. **Declare it in the pack** with the optional `fonts` array; the assembler emits a matching `@font-face` into the `brand-vars` style block (src resolves to `assets/<file>` relative to the episode's index.html):

```json
"fonts": [{ "family": "Sora", "file": "SoraVariable.woff2", "weight": "100 900" }]
```

2. **Ship the file**: download the brand's variable woff2 (Google Fonts, brand site, or Figma file), keep the canonical copy in `brands/<slug>/`, and copy it into every consuming episode's `assets/`. The `@font-face` is emitted unconditionally; without the file next to the episode the render silently falls back to `system-ui` and line wraps drift.

Confirm the loaded font in a scene-qa frame before signing off. Inter-based brands need neither step (the shell already registers it).

### 7. Write brand.json

```json
{
  "slug": "<slug>",
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
  "publishable": true,
  "notes": "<Company> (<domain>) design system, extracted from Figma file <name>, node <id>."
}
```

Contract per `docs/brand-packs.md`: `slug` + required `palette` object; optional `fonts` (array of `{ family, file, weight? }` emitted as `@font-face`, see step 6), `publishable` (legal gate) and `notes` (provenance -- record the source file/nodes here). No other fields are read. Omit any palette key you could not measure confidently -- fallback beats a guessed value. Set `publishable: false` **now** for client/internal brands: the warning only fires at render time, so it must be set at extraction time, not later. Format with `bunx biome check --write brands/<slug>/brand.json`.

### 8. Verify against a real episode

Bind the pack to any promo-* episode (an existing one works as a probe):

1. Add `"brand": "<slug>"` at the top level of `src/episodes/<probe>/scene-spec.json` (after `"slug"`). Leave `meta.json` alone -- `meta.brand` is a render-time override only.
2. `bun run assemble <probe>` -- a missing/invalid `brands/<slug>/brand.json` hard-errors here, by design.
3. Confirm the stamp landed: `grep -o 'data-brand="[^"]*"' src/episodes/<probe>/index.html` must print your slug. The spec schema is non-strict -- a typo'd field name (`"brnad"`) is silently ignored and the episode assembles unbranded, so this grep is the real gate.
4. `bun run scripts/scene-qa.ts <probe>` and **eyeball every frame** in `renders/<probe>-qa/`: token roles landed where expected (paper vs surface vs ink-inverse), the brand font rendered (not system-ui), radii/shadows look like the reference frames.

```bash
bun run assemble <probe>
grep -o 'data-brand="[^"]*"' src/episodes/<probe>/index.html
bun run scripts/scene-qa.ts <probe>
```

5. **Revert the probe** when done: restore the episode's previous `brand` binding (or remove the field) in its `scene-spec.json` and re-run `bun run assemble <probe>` -- otherwise the repo is left with a silently rebranded episode.

## Gotchas

- **Figma's generated code lies about text color/size.** The node screenshot is ground truth -- verify every extracted color against pixel crops, never the code panel or variable names alone.
- **Asset URLs expire in 7 days.** Download every logo/image into the repo immediately, same session.
- **Figma node screenshots bake opaque white corners** (alpha 255) on rounded shapes exported as PNG. Prefer SVG for logos; for raster assets, clip with CSS `border-radius` at the usage site instead of trusting PNG transparency.
- **`--brand-font` is one third of the job** -- non-Inter brands also need the `fonts` entry in brand.json (emits the `@font-face`) AND the woff2 in each consuming episode's `assets/` (step 6).
- **Editing brand.json requires re-`assemble`** of every episode that binds it; brand values are baked into the generated html, same staleness rule as spec edits. No watcher exists.
- **Faithful inconsistencies surface with non-Vidext packs.** The Figma source uses `surface` for the speaker badge but `paper` for agenda/detail badges on identical white frames. A pack where `paper !== surface` renders that divergence visibly -- it is faithful to the source design system; flag it to the user instead of "fixing" it silently.
- **`publishable: false` only warns at render** -- assemble and scene-qa stay silent, so an internal brand flows through authoring unannounced until `render:episode`.

## See also

- `docs/brand-packs.md` -- the BrandPack contract and render-time stamping details.
- `.agents/skills/promo-from-brief/SKILL.md` -- compose a branded promo episode once the pack exists.
