# Scene-Hub Templates

A short is no longer hand-authored HTML. It is a typed **scene-spec.json** at `apps/hyperframe/src/episodes/<slug>/scene-spec.json`. A deterministic assembler turns that spec into the monolithic `index.html` (1:1 — identical spec produces identical bytes).

```text
scene-spec.json  ──(assembler)──>  index.html  ──(render)──>  mp4
   you edit this        generated, never hand-edit
```

`index.html` is **generated**. Never edit it by hand; edit the spec and re-run `bun run assemble <slug>`.

This doc is the **scene-type authoring reference**: the shell, the 24 scene-types and their slots, how to add a new scene-type, and how scene-types compose.

## Layout

The scene-hub lives at `apps/hyperframe/templates/`:

```text
templates/
  _shell/                       universal look, owned by the assembler
    shell.css                   design tokens, background layers, scene
                                container, shared typography roles, captions,
                                brand-corner watermark
    shell.desktop.css           16:9 token overrides, appended only by
                                `assemble --format=desktop`
    shell.html.tmpl             document skeleton: head, GSAP cdn, bg/audio/
                                captions tracks, the single paused timeline,
                                __SLOT__ tokens filled by the assembler
  scenes/<type>/v1/             one building block (versioned)
    manifest.json               typed slot schema + builder + metadata
    fragment.html               inner DOM with __SLOT__ tokens / repeat blocks
    styles.css                  class-scoped CSS for this type
    styles.desktop.css          optional 16:9 overrides, appended after
                                styles.css only in desktop builds
    timeline.js                 build_<x>(tl, t, s, p) entrance choreography
    sample.json                 example params (used by scene:gallery)
```

The **shell** owns everything universal: tokens, the four background layers (tracks 0-3), the brand-corner watermark (track 97), audio (98), captions (99), the single `paused: true` GSAP timeline registered at `window.__timelines["<slug>"]`, inter-scene crossfades, track allocation, and the grain drift. Editing `_shell/` changes the look of **all** shorts.

Each **scene-type** owns only three things: its DOM fragment, its scoped CSS, and a `build_<x>` entrance function. It never touches the shell, the timeline scaffold, or other scenes.

## Engine

The build engine is `apps/hyperframe/scripts/lib/`:

| File | Responsibility |
|------|----------------|
| `scene-instantiator.ts` | resolve a scene-type, fill `fragment.html` tokens from params, render repeat blocks, escape/sanitize text |
| `assemble-episode.ts` | compose all scenes into the shell: sequential windows, track allocation, crossfades, timeline, registry |
| `scene-spec.ts` | `validateSceneSpec` — fast pre-flight against manifests (no assembly) |
| `scene-router.ts` | intent → recommended scene-type skeleton + typed summaries |

## The 24 scene-types

These are the only building blocks. `hook` opens; `outro` is the pinned brand sign-off, always last, on fixed track 7. Repeatable slots have a count range — the layout and stagger adapt automatically to the count. The last seven (`media-split` through `before-after`) are the desktop-first component library — asset-led layouts born for 16:9 that also carry a portrait layout.

| Type | Purpose | Default dur (s) | Repeatable slot (range) | Other slots |
|------|---------|:---------------:|-------------------------|-------------|
| `hook` | Full-frame opening statement | 6 | — | `title*` (rich), `eyebrow?`, `subtitle?` |
| `title-cards` | Headline + grid of labeled cards | 7 | `cards` **2-6** (`title*`, `body?`) | `title*` (rich), `eyebrow?` |
| `flow` | Vertical pipeline of connected steps | 8 | `steps` **2-6** (`label*`, `detail?`) | `title?` (rich), `eyebrow?` |
| `fanout` | Fan-out → workers → synthesize graph | 8 | `workers` **2-6** (`label*`) | `sourceLabel*`, `synthLabel*`, `title?` (rich), `eyebrow?` |
| `metric` | KPI panel of stat cards | 7 | `stats` **1-4** (`value*`, `label*`, `delta?`) | `title?` (rich), `eyebrow?` |
| `bars` | Animated horizontal bar chart | 7.5 | `bars` **2-6** (`label*`, `value*`, `pct*`) | `title?` (rich), `eyebrow?` |
| `big-stat` | One enormous hero number | 6 | — | `value*`, `suffix?`, `label?`, `context?` |
| `comparison` | Two columns, A vs B | 8 | `leftPoints` **1-5** + `rightPoints` **1-5** (`text*`) | `leftTitle*`, `rightTitle*`, `title?` (rich), `eyebrow?` |
| `timeline` | Chronological events on a rail | 8 | `events` **3-6** (`marker*`, `text*`) | `title?` (rich), `eyebrow?` |
| `quote` | Pull quote + attribution | 6 | — | `quote*` (rich), `name*`, `role?` |
| `code` | Terminal/code window | 7 | `lines` **1-12** (`text*`, `kind?`) | `filename?`, `title?`, `eyebrow?` |
| `social-card` | Platform-native social post | 7 | — | `name*`, `body*` (rich), `handle?`, `avatarInitials?`, `replies?`, `reposts?`, `likes?`, `title?` (rich), `eyebrow?` |
| `progress-ring` | 1-3 circular progress rings (radial KPI gauges) | 8 | `rings` **1-3** (`pct*`, `label*`, `value?`) | `title?` (rich), `eyebrow?` |
| `line-chart` | Time-series line chart, 1-3 series | 8 | `series` **1-3** (`label*`, `values*`) | `title?` (rich), `eyebrow?`, `unit?`, `xLabels?` |
| `contrib-heatmap` | GitHub-style contribution heatmap | 8 | — | `data*`, `caption?`, `highlight?`, `title?` (rich), `eyebrow?` |
| `decision-tree` | Conditional decision tree (IF/THEN branching) | 8 | `branches` **2-3** (`label*`, `result*`, `tone?`) | `question*`, `title?` (rich), `eyebrow?` |
| `media-split` | Copy + screenshot/image split (the desktop workhorse) | 7.5 | `points` **2-4** (`text*`) | `title*` (rich), `eyebrow?`, `image*`, `mediaSide?` (left\|right) |
| `annotated-asset` | Screenshot/diagram with numbered callout pins | 8 | `callouts` **2-5** (`label*`, `x*`, `y*` — percent coords) | `title?` (rich), `eyebrow?`, `image*` |
| `code-output` | Code window + its rendered result, side by side | 8 | `lines` **2-10** (`code?`) + `outputLines` **1-6** (`text?`) | `filename*`, `outputLabel?`, `title?` (rich), `eyebrow?` |
| `dashboard-composite` | Multi-panel KPI dashboard with mini progress bars | 8 | `tiles` **3-4** (`label*`, `value*`, `pct*`, `delta?`) | `title*` (rich), `eyebrow?` |
| `statement-lower-third` | Large statement anchored to the lower third | 7 | — | `statement*` (rich), `attribution?`, `image?` (full-bleed bg) |
| `logo-grid` | Social-proof band of name chips/wordmarks | 7 | `items` **3-8** (`label*`) | `title?` (rich), `eyebrow?` |
| `before-after` | Two images with a vertical wipe reveal | 7 | — | `imageBefore*`, `imageAfter*`, `labelBefore?`, `labelAfter?`, `title?` (rich), `eyebrow?` |
| `outro` | Pinned brand sign-off (track 7, last) | 5.5 | — | `source?` |

`*` = required, `?` = optional. "(rich)" slots accept inline HTML (`<strong>`, `<em>`, `<br>`); everything else is escaped as plain text. The same `*`/`?`/`[min-max]` summary is what `recommend_scene_types` and `scene:check` print.

The full slot schema for any type is its `manifest.json`. Read it (or call the MCP `get_scene_type`) before authoring a spec.

## scene-spec.json shape

```json
{
  "slug": "my-short",
  "lang": "es",
  "width": 1080,
  "height": 1920,
  "palette": { "accent": "#5b6cff", "accent2": "#e9ff00" },
  "audioDuration": 38.4,
  "scenes": [
    { "id": "hook", "type": "hook", "duration": 6,
      "slots": { "eyebrow": "El problema", "title": "Cada short se <strong>reinventa</strong>" } },
    { "id": "steps", "type": "flow",
      "slots": { "title": "El flujo", "steps": [
        { "label": "Script", "detail": "guion + pacing" },
        { "label": "TTS", "detail": "voz + captions" }
      ] } },
    { "id": "signoff", "type": "outro", "slots": { "source": "github.com/me" } }
  ]
}
```

Per scene: `id` (kebab-case, unique), `type`, optional `version` (default 1), optional `duration` (defaults to the type's `defaultDuration`), optional `status` (`draft`/`approved`), and `slots`. Scene order in the array is the timeline order; the assembler lays scenes out in sequential windows and crossfades between them. `outro` must be last (it carries `fixedTrack: 7`).

## How scenes compose (assembler)

`assemble-episode.ts`:

1. Validates `slug` and scene `id`s, instantiates each scene-type with its params (errors out on out-of-range repeat counts or missing required slots).
2. Lays out scenes in **sequential second windows** (`windowStart` accumulates `duration`); total duration is the sum.
3. Allocates tracks: backgrounds 0-3, scenes get `4, 5, 6, 8, 9, …` (7 reserved for the outro), brand-corner 97, audio 98, captions 99.
4. Emits each scene's DOM as a `<section id="scene-<id>" class="scene clip">`, dedupes each scene-type's CSS and builder function (emitted once per type even if reused).
5. Builds one flat `paused: true` timeline: hides all scenes at t=0, then per scene does a crossfade (`tl.to`/`tl.set` on autoAlpha/scale/blur) at the window boundary and calls the scene's `build_<x>(tl, windowStart, sel, params)`.
6. Wires karaoke captions and registers the timeline at `window.__timelines["<slug>"]`.

Composition is a **flat timeline of absolute-second offsets** — no nested timelines. This is the proven, seek-safe pattern.

## The builder contract: `build_<x>(tl, t, s, p)`

Each scene-type's `timeline.js` exports one function. The assembler calls it once, scoped to that scene instance:

| Arg | Meaning |
|-----|---------|
| `tl` | the global paused timeline (shared by all scenes) |
| `t`  | this scene's global start in **seconds** — every position you add is `t + localOffset` |
| `s`  | selector helper **scoped to this instance**: `s(".tc-card")` → `"#scene-<id> .tc-card"`, `s()` → `"#scene-<id>"` |
| `p`  | the resolved params object for this scene (the `slots`) |

Rules:

- **Always scope selectors through `s()`.** Never write a bare selector that could match another scene. (Exception: the outro deliberately targets the global `#brand-corner` to fade the watermark.)
- **Times in seconds**, positioned at `t + offset`. Frame/30 = sec.
- **Seek-safe constructs only**: `tl.from / tl.to / tl.fromTo / tl.set`. Hyperframes seeks frame-by-frame and never plays, so `onStart` / `onComplete` / `onUpdate` / `tl.call()` do **not** fire. For animated counters and bar fills use staggered `tl.set(target, props, t)` keyframes (the pattern used by `metric`/`big-stat`).
- **No `repeat: -1`, `Math.random`, `Date.now`, or async.** Determinism is enforced by lint.
- If an element animates **to** visible or needs a hidden initial state (drawing connectors, blurred-in text), **hide it at literal time `0` first** with `tl.set(s(...), {...}, 0)` so it materialises correctly at any seek position. See `flow/v1/timeline.js` (connectors) and `outro/v1/timeline.js` (text + watermark fade) for the pattern.
- The assembler already reveals/hides the `<section>` via the generic crossfade. Your builder only animates the scene's **own content**.
- **Format branching**: when the 16:9 desktop layout needs a different draw axis or geometry (e.g. a connector drawing `scaleX` instead of `scaleY`), branch on the stage attribute as the first statement of the builder: `const isDesktop = document.getElementById("ep-stage")?.dataset.format === "desktop-1080p";`. The portrait branch must keep today's exact values; CSS-only differences belong in `styles.desktop.css`, not the builder.

## Token rules (fragment.html → params)

The instantiator converts camelCase slot names to upper-snake tokens deterministically:

| Slot | Token in `fragment.html` |
|------|--------------------------|
| text/richText slot `metricSuffix` | `__METRIC_SUFFIX__` |
| repeat slot `cards` count | `__CARDS_COUNT__` |
| repeat-item field `title` (inside the block) | `__ITEM_TITLE__` |

A repeat block is delimited by HTML comments and rendered once per item:

```html
<!-- repeat:cards -->
<article class="tc-card">
  <h3 class="tc-card__title">__ITEM_TITLE__</h3>
  <p class="tc-card__body">__ITEM_BODY__</p>
</article>
<!-- /repeat:cards -->
```

`richText` slots are sanitized (no `<script>`/`<style>`/`<iframe>`/… tags, no `on*=` handlers) but otherwise pass through; all other slots are HTML-escaped. `image` slots bind a path **relative to the episode dir** (typically `assets/generated/<name>.png`, see the generated-raster-assets skill) — absolute paths, `..` and URLs are rejected at instantiation.

## Adding a new scene-type

Create `templates/scenes/<type>/v1/` with these five files:

1. **`manifest.json`** — `id` (`<type>@1`), `type`, `version`, `label`, `description`, `builder` (the exact `build_<x>` function name), `classPrefix`, `defaultDuration`, `intentTags` (subset of `informative`, `data`, `workflow`, `social`, `brand`, `vfx`), and `slots`. Each slot is `text`, `richText`, or `repeat` (with `min`, `max`, and an `item` field schema). Add `fixedTrack` / `role` only for structural types like `outro`.
2. **`fragment.html`** — the inner DOM. Use `__SLOT__` tokens and `<!-- repeat:NAME --> … <!-- /repeat:NAME -->` blocks. Wrap content in `.scene-pad` + your `classPrefix`. Reuse shared roles (`.eyebrow`, `.headline`, `.subcopy`) where they fit. Respect the visual-framing rule: don't double-frame self-framed objects (terminal/code windows, social cards, device mockups are already containers — make them the primary scene object).
3. **`styles.css`** — class-scoped CSS using your `classPrefix`. No `__SLOT__` tokens here, no `position: absolute` on the section root (the runtime force-applies that). The assembler emits this block once.
4. **`timeline.js`** — the `build_<x>(tl, t, s, p)` function matching `manifest.builder`. Follow the builder contract above. `title-cards/v1/timeline.js` is the canonical reference (it documents the contract inline).
5. **`sample.json`** — example params with every slot filled (repeat slots near their max), so `scene:gallery` can exercise the type.

Optionally add **`styles.desktop.css`** with the type's 16:9 overrides — the assembler appends it after `styles.css` only when assembling with `--format=desktop` (no `[data-format]` gating needed; reuse the base selectors at equal-or-higher specificity to override them). All 17 shipped types carry one.

The assembler auto-discovers the type (no registration needed). After adding it, add it to a `scene-spec.json` and run `scene:check` + `assemble` + `scene:gallery` to verify it renders and stays within frame — and `scene-qa --format=desktop` if you shipped a desktop layout.

## Commands (CWD = `apps/hyperframe`)

```bash
bun run new:episode <slug> [--intent=informative|data|workflow|social|brand|vfx]
# scaffold a starter scene-spec.json (seeded from the intent skeleton) + assemble index.html

bun run assemble <slug> [--format=desktop]
# regenerate index.html (9:16) from scene-spec.json — run after EVERY spec edit
# --format=desktop writes index.desktop.html (16:9) instead; each invocation
# generates ONE format and never touches the other file

bun run scene:check [<spec>...]
# validate scene-spec(s) against scene-type manifests (no assembly)

bun run scene:gallery
# generate the gallery episode exercising every scene-type

bun run scripts/scene-qa.ts <slug> [--scenes=id1,id2]
# per-scene visual QA: snapshot key frames + hyperframes inspect (overflow/overlap).
# Writes renders/<slug>-qa/<scene-id>/*.png + report.json. No full mp4.
# --scenes re-checks only the listed (changed) scenes.

bun run render:episode <slug> --format=mp4 [--keep-local]
# FINAL full render — only after per-scene QA approval
```

The intent skeletons (`scene-router.ts`) seed `new:episode`: e.g. `workflow` → `hook, flow, code, timeline, outro`; `data` → `hook, big-stat, metric, comparison, outro`. `hook` and `outro` are structural and always present.

## MCP equivalents (`apps/mcp`)

`list_scene_types`, `get_scene_type`, `recommend_scene_types(intent)`, `validate_scene_spec(spec)`, `assemble_episode(spec)`, `scene_qa(slug, [scenes])`, plus `lint_html`, `generate_audio`, `render_composition`.

## Hard constraints (renders break if violated)

These are non-negotiable and most are enforced by lint:

1. **Monolithic single file** — generated; zero `data-composition-src`.
2. **Paused GSAP timeline** registered at `window.__timelines["<slug>"]`.
3. **Times in seconds**; frame/30 = sec.
4. **Deterministic + seek-safe only** — no `Math.random`, `Date.now`, `repeat: -1`, async, or play-only callbacks.
5. **Track convention** — 0-3 backgrounds, scenes 4/5/6/8/9…, 7 outro, 97 brand-corner, 98 audio, 99 captions.
6. **Visual-framing rule** — don't double-frame self-framed objects (encoded into `code` and `social-card`).
7. **Artifact persistence** — R2 + remote manifests are canonical; don't commit heavy episode binaries.
