# Rules reference

> Full reference. For the critical constraints that break renders if ignored, see `AGENTS.md`.

## 1. Authoring model: scene-spec.json -> assembler -> index.html

A short is a typed `scene-spec.json` at `apps/hyperframe/src/episodes/<slug>/scene-spec.json`. A deterministic assembler turns it into the monolithic `index.html` (1:1; identical spec produces identical bytes).

- `index.html` is **GENERATED**. Never hand-edit it — edit `scene-spec.json` and re-run `bun run assemble <slug>`.
- All authoring happens through the spec: pick scene-types, fill their slots, set order and timing.
- The scene-hub lives at `apps/hyperframe/templates/`:
  - `_shell/` (`shell.css` + `shell.html.tmpl`) — universal look: tokens, background layers, brand-corner watermark, the single paused GSAP timeline + crossfades, captions/audio, track allocation, and the timeline registry.
  - `scenes/<type>/v1/` (`manifest.json`, `fragment.html`, `styles.css`, `timeline.js`, `sample.json`) — one directory per scene-type.
- Engine: `apps/hyperframe/scripts/lib/{scene-instantiator,assemble-episode,scene-spec,scene-router}.ts`.

## 2. Scene-types — the only building blocks

There are 44 scene-types (29 general + 15 brand-pack-driven `promo-*` story-ad types).
The 29 general scene-types are `hook`, `title-cards`, `flow`, `fanout`, `metric`, `bars`, `big-stat`, `comparison`, `timeline`, `quote`, `code`, `social-card`, `progress-ring`, `line-chart`, `contrib-heatmap`, `decision-tree`, `media-split`, `annotated-asset`, `code-output`, `dashboard-composite`, `statement-lower-third`, `logo-grid`, `before-after`, `editorial-hook`, `editorial-lineup`, `editorial-profile`, `editorial-cheat-sheet`, `editorial-outro`, and `outro`.

Repeatable slots have ranges:

| Scene-type | Repeatable slot | Range |
|---|---|---|
| `title-cards` | cards | 2–6 |
| `flow` | steps | 2–6 |
| `metric` | stats | 1–4 |
| `comparison` | left / right points | 1–5 |
| `timeline` | events | 3–6 |
| `code` | lines | 1–12 |

`outro` is the pinned brand sign-off — always last, fixed on track 7.

## 3. Monolithic single file

Each episode `index.html` is one generated monolithic file: all CSS, HTML, GSAP, and captions JSON inline. Zero `data-composition-src`. The runtime force-applies `position: absolute; top:0; left:0; 100% x 100%` on tracked stage children, which collapses any sub-composition flex layout — so sub-comps are never used.

The stage is one `<div data-composition-id="<slug>" data-start data-duration data-width data-height>`. Timed elements inside use `class="clip" data-start data-duration data-track-index`.

`data-width`, `data-height`, and `data-duration` define the per-render contract. The render path renders exactly that canvas size and duration; there is no global aspect-ratio or duration fallback.

## 4. GSAP timeline: paused + registry

The single timeline must be `paused: true` and registered in `window.__timelines["<slug>"]`.
Without the registry, no animation. Without `paused: true`, frame seek breaks.

## 5. Times in seconds

Hyperframes' `data-duration` is in seconds. The GSAP timeline matches. Conversion: `frame/30 = sec`.

## 6. Determinism

No `Math.random`, `Date.now`, `repeat: -1`, or async timeline construction. Lint catches it. Determinism is contractual — identical spec must produce identical bytes.

## 7. Seek-safe GSAP

Hyperframes seeks the timeline frame-by-frame (it never "plays" it). `onStart` / `onComplete` / `onUpdate` / `onRepeat` / `onReverseComplete` / `tl.add(callback)` / `tl.call(...)` do NOT fire during seek.
Use `tl.set(target, props, t)` (zero-duration tween) for discrete transitions — it materialises at any seek position.
For animated counters, bar fills, and saturating progress use staggered `tl.set(target, props, t)` keyframes (the pattern used by `metric`/`big-stat`) — `onUpdate` does NOT fire during seek.

Run `bun run lint:seek-safe` from `apps/hyperframe/` to catch antipatterns before render. The linter (`apps/hyperframe/scripts/lint-seek-safe.ts`) scans inline `<script>` blocks in every episode's generated `index.html` and enforces this rule plus rules 4 and 6:

| Pattern | Severity | Rewrite |
|---|---|---|
| `onStart` / `onComplete` / `onRepeat` / `onReverseComplete` in any tween config | error | `tl.set(target, props, t)` |
| `tl.call(...)` | error | `tl.set(target, props, t)` |
| `repeat: -1` | error | restructure the scene (rule 6) |
| `repeat: <n>` with `n > 0` | warning | rarely intended for a fixed-duration short |
| `setTimeout` / `setInterval` / `requestAnimationFrame` in timeline construction | error | restructure with explicit timeline positions |
| `gsap.timeline()` missing `paused: true` | error | add `paused: true` (rule 4) |
| Missing `window.__timelines["<slug>"]` registration | error | register the timeline (rule 4) |

## 8. Track-index convention

| Track | Use |
|---|---|
| `0..3` | background layers |
| `4, 5, 6, 8, 9..` | scenes |
| `7` | `outro` (pinned) |
| `97` | `#brand-corner` watermark |
| `98` | audio |
| `99` | captions |

The shell and assembler emit these canonical indices; never override them by hand.

## 9. Theme tokens via CSS vars

`var(--bg)`, `var(--text)`, `var(--accent)` — single source of truth in `_shell/shell.css` / `apps/hyperframe/src/lib/theme.css`. New accents go there.

## 10. Fonts by literal name

Use literal `font-family`, NOT `var(--font-sans)`. Hyperframes' deterministic font mapping does not resolve CSS vars.
Use `font-family: "Inter", system-ui, sans-serif;` or `"JetBrains Mono", Menlo, monospace;`.
The shell loads fonts via `<link>` to Google Fonts.

For source-driven, informative, workflow, and data-led shorts, do not invent local sizes or weights. Use `.agents/skills/canonical-short/references/typography-system.md` as the role contract for `hf-display`, `hf-headline`, `hf-source-pill`, card text, captions, and outro typography.

## 11. Aspect explicit per composition

The stage declares `data-width` and `data-height`. No global default. Default short is 1080x1920.

## 12. Stable IDs

Every scene gets a `#scene-<id>` section, and all of its timeline selectors are scoped to that section. The assembler guarantees stable ids; lint requires them as editable anchors.

## 13. Visual framing and self-framed components

Avoid double-framing. A visual object that already represents a container should not be nested inside a generic glass/card wrapper.

Self-framed objects:

- Terminal windows
- Code editors
- Browser or app windows
- Social post cards
- Phone/device mockups
- Media player cards

Use these as the primary scene object and animate the object itself. Do not place them inside `.demo-card`, glass panels, or extra card shells. This rule is encoded directly in the `code` and `social-card` scene-types.

Generic glass/card frames are appropriate for loose content that needs grouping: metrics, badges, short lists, unframed diagrams, and abstract blocks.

For diagrams, pick the frame by density. A compact chart or small decision diagram can sit inside a card. A workflow graph, pipeline, or multi-node flowchart should use an open canvas or full-scene frame so the nodes and connectors have breathing room in 9:16.

## 14. Commands

Run from `apps/hyperframe/` cwd:

- `bun run new:episode <slug> [--intent=informative|data|workflow|social|brand|vfx]` — scaffold a starter `scene-spec.json` + assemble `index.html`.
- `bun run assemble <slug>` — regenerate `index.html` from `scene-spec.json` (run after every spec edit).
- `bun run scene:check [<spec>...]` — validate scene-spec(s) against scene-type manifests (no assembly).
- `bun run scene:gallery` — generate the gallery episode exercising every scene-type.
- `bun run scripts/scene-qa.ts <slug> [--scenes=id1,id2] [--frames=1|3]` — per-scene visual QA: snapshots key frames per scene + `hyperframes inspect` for overflow/overlap. Writes `renders/<slug>-qa/<scene-id>/*.png` + `report.json`. No full mp4. `--scenes` re-checks only changed scenes; `--frames=3` adds entry/mid/late frames for motion debugging (default `1`).
- `bun run render:episode <slug> --format=mp4 [--keep-local]` — final full render (after per-scene approval).
- `bun run audio <script.txt> --lang=es --speed=1.04 [--out=<dir>]` — TTS + captions (`generate-audio.ts`). Takes any script path as a positional; `--out` defaults to `out/audio/`. Point it at the canonical voice dir per rule 21, e.g. `--out=public/voice/<slug>`.

Render variants:

- YouTube h264 yuv420p: `bun run render:episode <slug> --format=mp4 --crf=18`
- Square 1080x1080 (LinkedIn): stage with `data-width=data-height=1080`, `bun run render:episode <slug> --format=mp4`
- Lower-third overlay (alpha): `bunx hyperframes render <dir> --format mov` -> ProRes 4444 with alpha. `--format webm` -> VP9 alpha
- Via turborepo: `turbo run render:episode --filter=@cgaravitoq/hyperframe`

## 15. Pipeline and gates

producer -> strategist (3 scripts) -> [researcher] -> visual-director (writes `scene-spec.json`) -> audio-producer -> composer (`scene:check` + `assemble` + lint) -> qa (per-scene `scene-qa` loop, then final render). Publishing is manual copy-paste downstream — distribution copy is produced by the generate-distribution-copy skill (`distribution.json` + `copy:check` / `copy:gate`).

Gates:

1. script
2. audio
3. **per-scene visual** — approve/reject each scene; iterate only the rejected ones via `assemble` + `scene-qa --scenes`
4. final render

## 16. Gitignored outputs

Don't commit `out/`, `renders/`, `node_modules/`, `.turbo/`. `bun.lock` IS committed (pinned).
R2 + remote manifests are canonical for final accepted render/media artifacts. Review renders stay local by default; pass `--upload=r2` only when the output should be persisted remotely. After verified upload, local render outputs are deleted by default unless `--keep-local` is passed. Fresh clones of remote-only episodes should run `bun run hydrate:episode <slug>` from `apps/hyperframe/` before previewing or rendering.

## 18. bun, not npm

Scripts via `bun run <name>`. Deps with `bun add`. Always `bun install` from repo root (Bun 1.3.x has regressions installing from workspace subdirectories). Only acceptable `npx`: bootstrap one-off.

## 19. biome, not eslint/prettier

Applies to `.ts` and `.json`. Generated HTML compositions are validated by `bunx hyperframes lint <dir>` plus `bun run lint:seek-safe` — Biome doesn't format HTML.

## 20. AGENTS.md canonical

One `AGENTS.md` at root, with `CLAUDE.md` as a symlink.

## 21. Audio assets location

`apps/hyperframe/public/voice/<slug>/` (canonical). Copy `voice.mp3` and `captions.json` into `apps/hyperframe/src/episodes/<slug>/assets/` before render.
`render-episode.ts` auto-inlines `assets/captions.json` into `<script id="captions-data">` at render time.

## 22. TTS provider

`TTS_PROVIDER=elevenlabs|inworld`; default is ElevenLabs.
ElevenLabs voices use `ELEVENLABS_VOICE_ID_ES` / `ELEVENLABS_VOICE_ID_EN`.
ElevenLabs TTS uses `ELEVENLABS_MODEL_ID=eleven_v3` — v3-only; non-v3 model IDs (`eleven_multilingual_v2`, `eleven_turbo_v2`, any v2/v2.5) are permanently blocked and the CLI throws if one is passed.
Inworld requires `INWORLD_API_KEY` + `INWORLD_VOICE_ID_ES` / `INWORLD_VOICE_ID_EN`.
Inworld model defaults to `INWORLD_TTS_MODEL=inworld-tts-2`.
STT swap via `STT_PROVIDER=elevenlabs|hyperframes-transcribe`.

## 23. Voice tuning preset

`DEFAULT_VOICE_SETTINGS`: `stability=0.5`, `similarityBoost=0.82`, `speed=1.04` — tuned against the primary peninsular ES voice.
Override per-call with `--stability`, `--similarity-boost`, `--style`, `--speed`.
Hook 3–5s energetic: `--stability=0.35 --similarity-boost=0.75 --speed=1.0`.
Amplified style: `--style=0.25` (increases API latency).

See `docs/voice-config.md` for full voice configuration.

## 24. Native pacing (no injection)

There is no pause injection. The old `--pause-sentence` / `--pause-clause` / `--no-pause-injection` flags are removed, and `eleven_v3` is the only model. Pacing is native: write tight scripts and control rhythm with punctuation only (periods/commas for beats, ellipses `…` for a longer hold). Never inject `<break>` SSML or `[pause]` / `[short pause]` / `[long pause]` tags programmatically; hand-author at most 1-2 expressive tags in the script instead (`[excited]`, `[thoughtful]`).

## 25. Captions shape

`[{text, start, end, confidence?}]` in seconds. `text` keeps the leading-space convention from `@remotion/captions`.
`captions-karaoke.js` consumes this directly. The Scribe provider emits this shape natively.

## 26. Episode duration

`ffprobe(voice.mp3) + tail`. `render-episode.ts` stamps `data-duration` and inlines captions in `apps/hyperframe/out/episodes/<slug>/`. Source episodes are never mutated.
Tail resolution: `--tail` CLI flag > `meta.json` `tail` field > `0.3` fallback.
Canonical default for shorts with brand-card lockups: `tail: 3` in `meta.json`.

## 27. Outro handoff

`outro` is the production closing contract: always last, pinned on track 7. The final handoff blur/scale crossfades from the penultimate scene into the outro scene; the logo pieces assemble first, then `#brand-name`, `#brand-tagline`, and source attribution (when present) reveal as one grouped blur scale-up (`autoAlpha: 0`, `scale: 0.88`, `filter: "blur(16px)"` to `autoAlpha: 1`, `scale: 1`, `filter: "blur(0px)"`). This reveal is encoded in the `outro` scene-type's `timeline.js`.

## 28. Generated raster source assets

Generated PNG/WebP assets are allowed when they improve visual-heavy scenes: product/workspace screenshots, handoff bundles, dense visual explainers, and connector-heavy diagrams. Store approved assets under `apps/hyperframe/src/episodes/<slug>/assets/generated/` and reference them from the scene-spec (and thus the generated `index.html`) with relative paths.

Keep generated image text short. Important narration copy belongs in HTML. For Spanish labels, inspect rendered frames for accents and `ñ`; regenerate or overlay corrected HTML text if the image model gets orthography wrong.

Generated source assets needed for reproducible renders are committed. Heavy render outputs, local caches, and regenerable audio artifacts remain ignored. Document provenance in `assets/source.json`, `assets/research/research.md`, or `assets/generated/provenance.md`. For source-driven shorts, `assets/source.json` is the canonical input package for source metadata, publishability, attribution, and captured assets.

## 29. Hyperframes CLI CWD

`hyperframes.json` `paths.episodes: "src/episodes"` resolves relative to workspace cwd.
Run `bunx hyperframes <cmd>` and `bun run <script>` from `apps/hyperframe/` (or via `turbo run`).
Running from repo root fails to find episodes.
