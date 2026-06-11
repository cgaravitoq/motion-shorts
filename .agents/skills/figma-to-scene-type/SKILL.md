---
name: figma-to-scene-type
description: >
  Use when a Figma reference frame must become a new parametric scene-type under
  apps/hyperframe/templates/scenes/<type>/v1/ -- "replicate this frame as a scene-type",
  "add a scene like this design". Covers the 5-file contract, the bake-vs-HTML split, brand
  tokenisation, and pixel-measurement QA against the reference screenshot. Defer to this skill
  for any new scene-type sourced from a design reference. Skip when an existing scene-type can
  express the layout (fill slots instead) and for whole-episode composition (promo-from-brief).
---

# Figma reference frame to scene-type

> CWD for all commands: `apps/hyperframe/` (running from repo root fails to find episodes).

A scene-type is five files under `templates/scenes/<type>/v1/` (`manifest.json`, `fragment.html`, `styles.css`, `timeline.js`, `sample.json` -- full contract in `docs/templates.md`). The assembler **auto-discovers** the directory; there is no registry to edit. Only add a type when none of the existing types (see the table in `docs/templates.md`) can express the layout by filling slots. The shipped `promo-*` family (`promo-intro-card`, `promo-hero`, `promo-card-speaker`, `promo-blur-cta`, `promo-agenda`, `promo-quote`, `promo-details`) is the worked example of this skill -- read one before starting.

## When to invoke / when NOT

Invoke for: a Figma node URL (or exported frame) that must join the reusable library as a parametric building block.

Do NOT invoke for: layouts an existing scene-type already covers (fill its slots); one-off episode tweaks (`spec.palette`); composing a whole episode (`promo-from-brief`); extracting brand tokens only (`extract-brand-pack`).

## Workflow

### 1. Capture the reference (specs + ground truth)

From the Figma node URL (confirm the MCP session first with `whoami`; if no Figma MCP is connected, ask for exported frame PNGs and use them as the ground truth, skipping the context/metadata steps):

- `get_design_context` -- structure, layer names, declared colors/typography, plus downloadable asset URLs for raster layers. **Treat the generated code as hints, never as truth** (see Gotchas: the generated code lies).
- `get_metadata` -- node geometry: absolute x/y/width/height per layer. This is your layout source.
- `get_screenshot` on the full frame at native resolution (`maxDimension` = the node's longer edge) -- it returns a short-lived hosted URL; the PNG is the **ground truth** for every color, position, and size. Save it as the QA reference:

```bash
mkdir -p src/episodes/<probe-slug>/assets/reference
curl -sL -o src/episodes/<probe-slug>/assets/reference/<type>-full.png "<image_url from get_screenshot>"
```

Download every asset URL **immediately, in the same session** -- Figma MCP asset URLs expire in 7 days.

### 2. Bake-vs-HTML decision

Split every layer into one of two buckets:

- **Bake** (export as PNG via `get_screenshot` at native node resolution): photo + mask + gradient composites, textured backgrounds, anything raster-fused that animates only as a whole. These become `image` slots.
- **HTML** (rebuild as DOM): all text, badges, pills, CTAs, dots, logos (prefer SVG), dividers -- anything that must animate independently or carry parametric copy. GSAP can only drive what exists as an element.

When in doubt: if the copy could change per episode, it is HTML.

### 3. Export baked composites

Export each baked composite at the node's native pixel size into the probe episode's `assets/` (image slots bind paths relative to the episode dir; absolute paths, `..`, and URLs are rejected at instantiation). Keep filenames lowercase kebab-case. Also export per-element crops you will need for pixel QA (step 8).

### 4. Slot design

Define `manifest.json` slots with **generic, brand-agnostic names** -- the type must serve any brand, not the reference company:

- `text` for short escaped strings (badge labels, CTA labels, dates).
- `richText` for copy that needs `<strong>`/`<em>`/`<br>` (titles, bodies).
- `image` for baked composites, photos, logos (`badge`, `title`, `body`, `cta`, `bgImage`, `photoImage`, `logoImage` -- not `vidextLogo`).
- `repeat` (with `min`/`max` + an `item` schema) for lists: agenda items, chips, speaker rows.

Set `id` (`<type>@1`), `builder` (`build_<camelType>`), a short unique `classPrefix`, `defaultDuration`, `intentTags`. Fill `sample.json` with every slot populated (repeat slots near max) so `scene:gallery` exercises the type.

### 5. fragment.html

Inner DOM with `__SLOT__` tokens and `<!-- repeat:NAME -->` blocks, wrapped in `.scene-pad` + your `classPrefix` (see `promo-hero/v1/fragment.html`). Respect the visual-framing rule: self-framed objects (windows, cards, device mocks) are the primary scene object, never wrapped in another glass/card.

### 6. styles.css -- brand tokens vs structural literals

Two non-negotiable rules:

- **Every brand-semantic value** (colors, font stack, pill/chip/card radii, badge shadow) MUST be written as `var(--brand-X, <measured literal>)` from day one. The fallback is the exact value measured from the reference, so the type renders pixel-identically with no brand pack. Reuse the existing 11 tokens before inventing new ones:

| Token | Role | Vidext fallback |
|---|---|---|
| `--brand-paper` | frame/background surface, light badge bg, over-photo CTA bg | `#fff` |
| `--brand-ink` | text on light surfaces, solid dark fills, over-frame CTA bg | `#000` |
| `--brand-ink-inverse` | text on photos/dark, labels inside ink fills | `#fff` |
| `--brand-surface` | soft secondary surface (chips, list items) | `#f4f4f4` |
| `--brand-line` | hairline borders (`1px solid`) | `#e5e5e5` |
| `--brand-muted` | tertiary text | `#b3b3b3` |
| `--brand-font` | brand sans stack | `"Inter", system-ui, sans-serif` |
| `--brand-radius-pill` | full-pill radius (CTAs, solid pills) | `128px` |
| `--brand-radius-chip` | chip/badge radius | `40px` |
| `--brand-radius-card` | photo/media card radius | `65px` |
| `--brand-shadow-badge` | whole badge box-shadow | `0 4px 2px rgba(157, 155, 155, 0.05)` |

```css
.xx-badge { background: var(--brand-paper, #fff); border: 1px solid var(--brand-line, #e5e5e5); border-radius: var(--brand-radius-chip, 40px); box-shadow: var(--brand-shadow-badge, 0 4px 2px rgba(157, 155, 155, 0.05)); }
```

- **Structural geometry stays literal**: positions, sizes, gaps, font-sizes, line-heights, letter-spacing, font weights, and `border-radius: 50%` circles are measured values, not tokens.

No `__SLOT__` tokens in CSS; no `position: absolute` on the section root (the runtime force-applies it).

### 7. Shell-override block (full-frame ad scenes only)

If the type owns its full frame (its own background, light surface), disable the dark shell layers and watermark whenever the type is present -- put this at the top of `styles.css`, keyed on your prefix:

```css
#ep-stage:has(.xx) #bg-field { background: var(--brand-paper, #fff); }
#ep-stage:has(.xx) #bg-grid,
#ep-stage:has(.xx) #bg-grain,
#ep-stage:has(.xx) #bg-vignette,
#ep-stage:has(.xx) #brand-corner { display: none; }
```

Skip this block for types that sit on the standard shell background.

### 8. timeline.js -- seek-safe contract

One function `build_<x>(tl, t, s, p)` (`t` = scene start in seconds, `s` = instance-scoped selector). Hyperframes seeks frame-by-frame and never plays, so:

- **Hide initial state at literal time `0`** with `tl.set(s(...), {...}, 0)`, then animate in with `tl.to(..., t + offset)`. Never rely on CSS-only initial hiding.
- Allowed: `tl.from / tl.to / tl.fromTo / tl.set`. Forbidden: `onStart` / `onComplete` / `onUpdate` / `tl.call()` (do not fire on seek), `repeat: -1`, `Math.random`, `Date.now`, async construction.
- Discrete transitions and counters: staggered `tl.set(target, props, t + k)` keyframes (the `metric`/`big-stat` pattern).
- **Elements that carry a CSS transform (e.g. `transform: translateX(-50%)` centering) get `autoAlpha` only** -- a GSAP `x`/`y`/`scale` tween overwrites the CSS transform and the element jumps. Animate the element's children instead (see `promo-intro-card`: `.pin-col` carries the translate, the timeline only touches what is inside).
- All selectors through `s()`; the assembler handles the section-level crossfade -- animate only the scene's own content.

`promo-hero/v1/timeline.js` is the canonical entrance-cascade reference.

### 9. Pixel-measurement QA loop

Wire the type into a probe episode spec, then iterate:

```bash
bun run scene:check src/episodes/<probe-slug>/scene-spec.json
bun run assemble <probe-slug>
bun run scripts/scene-qa.ts <probe-slug> --scenes=<scene-id>
```

Compare `renders/<probe-slug>-qa/<scene-id>/*.png` against the reference screenshot **by measuring pixels**, never by trusting that CSS numbers match the Figma inspector:

```bash
python3 -c "import PIL, numpy" || pip3 install --user pillow numpy   # deps preflight
python3 - <<'EOF'
from PIL import Image
import numpy as np
ref = np.array(Image.open("src/episodes/<probe-slug>/assets/reference/<type>-full.png").convert("RGB"))
out = np.array(Image.open("renders/<probe-slug>-qa/<scene-id>/<frame>.png").convert("RGB"))
# crop the same region from both, print mean color + non-background bounding box
def bbox(img, bg):
    mask = np.any(np.abs(img.astype(int) - bg) > 16, axis=-1)
    ys, xs = np.where(mask)
    return xs.min(), ys.min(), xs.max(), ys.max()
crop = lambda a, x, y, w, h: a[y:y+h, x:x+w]
c = crop(out, 41, 62, 300, 80)
print("mean color:", c.reshape(-1, 3).mean(axis=0), "bbox:", bbox(c, np.array([255, 255, 255])))
EOF
```

Measure per element: text color (mean of a glyph crop), block position/size (bounding box vs `get_metadata` geometry), radii (corner crops). Iterate styles until crops match the reference, then run `bunx hyperframes lint src/episodes/<probe-slug>`.

Nothing else to register -- once the five files exist and QA passes, the type is library-wide.

## Gotchas

- **Figma's generated code lies about text color and size.** A text declared black has rendered white in practice; tracking and trim were missing. The node screenshot is ground truth -- verify every color/position/size with pixel crops before coding.
- **Node screenshots bake opaque white corners (alpha 255).** Rounded shapes exported as PNG arrive with square white corners. Clip at the usage site with CSS `border-radius` on the `<img>`/container (e.g. `border-radius: var(--brand-radius-card, 65px)` card, `50%` avatar) -- never trust the export's transparency.
- **text-box-trim nodes render shorter boxes than CSS `line-height: normal`.** Replicate with explicit `height` + `line-height: 1` and measure letter-spacing against the screenshot (a ~0.95px tracking delta was needed once); default CSS line boxes are taller and shift everything below.
- **Asset URLs expire in 7 days** -- `curl -o` every export into the repo immediately.
- **The shell `@font-face` registers only Inter and Berkeley Mono** (expects `assets/InterVariable.woff2` in the episode dir). A non-Inter `--brand-font` needs both the woff2 in the consuming episode's `assets/` AND a `fonts` entry in `brands/<slug>/brand.json` (the assembler emits the `@font-face` from it); missing either silently falls back to system-ui and line wraps drift.
- **`tl.set` at `0`, not at `t`.** Hidden state placed at the scene's own start materialises wrongly when seeking before the scene; literal `0` is what makes any seek position correct.
- Editing the five files does not refresh episodes by itself -- re-run `assemble <slug>` for every episode that uses the type.

## Final checklist

- [ ] All five files exist under `templates/scenes/<type>/v1/`; `manifest.builder` matches the function name in `timeline.js`.
- [ ] Slot names are generic/brand-agnostic; `sample.json` fills every slot (repeats near max).
- [ ] Every brand-semantic CSS value is `var(--brand-*, <measured literal>)`; structural geometry is literal; `border-radius: 50%` stays literal.
- [ ] Full-frame types carry the `#ep-stage:has(.<prefix>)` shell-override block.
- [ ] Timeline: hidden state at literal `0`, entrances at `t + offset`, no callbacks/randomness, `autoAlpha`-only on transform-carrying elements, all selectors via `s()`.
- [ ] Baked composites exported at native resolution into episode `assets/`; reference full-frame PNG saved for QA.
- [ ] Pixel QA passed: crops + bounding boxes vs the reference, `scene-qa` report clean, `hyperframes lint` clean.
- [ ] Nothing registered anywhere -- auto-discovery confirmed by `scene:check` accepting the new `type`.

## See also

- `docs/templates.md` -- 5-file contract, builder contract, token rules.
- `docs/brand-packs.md` -- brand pack format and the 11-token contract.
- `.agents/skills/extract-brand-pack/SKILL.md` -- capture a brand into `brands/<slug>/brand.json`.
- `.agents/skills/promo-from-brief/SKILL.md` -- compose an episode from the promo library.
- `apps/hyperframe/templates/scenes/promo-hero/v1/` -- worked example (shell override, baked bg, cascade timeline).
- `apps/hyperframe/templates/scenes/promo-intro-card/v1/` -- transform-carrying wrapper pattern.
