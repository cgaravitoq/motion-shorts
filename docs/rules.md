# Rules reference

> Full reference. For the critical constraints that break renders if ignored, see `AGENTS.md`.

## 1. Composition structure

Each composition = a dir with `index.html` + `meta.json` + `hyperframes.json`.
The stage is one `<div data-composition-id="<id>" data-start data-duration data-width data-height>`.
Timed elements inside use `class="clip" data-start data-duration data-track-index`.

`data-width`, `data-height`, and `data-duration` define the per-render contract. The local CLI/MCP render path renders exactly that canvas size and duration; there is no global aspect ratio or duration fallback.

## Compositions

Reusable render entrypoints use the same contract as episode renders. The MCP tool is `render_composition`.

First-class MCP templates:

- `canonical-short` — 1080x1920, includes `<audio>` and `#captions`.
- `landscape-motion` — 1920x1080, no audio, no captions, fixed `data-duration`.
- `square-social` — 1080x1080, no audio, no captions, fixed `data-duration`.

Audio and captions are optional. A no-audio render can pass only HTML plus render settings, with no `assets` array, as long as the HTML does not reference local media files.

## 2. GSAP timeline: paused + registry

Must be `paused: true` and registered in `window.__timelines["<id>"]`.
Without the registry, no animation. Without `paused: true`, frame seek breaks.

## 3. Theme tokens via CSS vars

`var(--bg)`, `var(--text)`, `var(--accent)` — single source of truth in `apps/hyperframe/src/lib/theme.css`.
New accents go there.

## 4. Fonts by literal name

Use literal `font-family`, NOT `var(--font-sans)`. Hyperframes' deterministic font mapping does not resolve CSS vars.
Use `font-family: "Inter", system-ui, sans-serif;` or `"JetBrains Mono", Menlo, monospace;`.
Load via `<link>` to Google Fonts in each composition.

For source-driven, informative, workflow, and data-led shorts, do not invent local sizes or weights. Use `.agents/skills/canonical-short/references/typography-system.md` as the role contract for `hf-display`, `hf-headline`, `hf-source-pill`, card text, captions, and outro typography.

## 5. Times in seconds

Hyperframes' `data-duration` is in seconds. GSAP timeline matches. Conversion: `frame/30 = sec`.

## 6. Aspect explicit per composition

The stage declares `data-width` and `data-height`. No global default.

## 7. Transparent backgrounds

- **Overlays** (lower-thirds, chyrons): body `background: transparent`, stage WITHOUT `class="bg-fill"`.
- **Full-screen compositions** (chapter-card, end-card, kpi-card): body transparent, stage WITH `class="bg-fill"` (applies `var(--bg)`).

## 8. Determinism

No `Math.random`, `Date.now`, `repeat: -1`, or async timeline construction. Lint catches it. Determinism is contractual.

## 9. Stable IDs

Every timed element gets a stable `id`. Studio + lint require editable anchors.

## 10. Canonical render commands

Run from `apps/hyperframe/` cwd:

- YouTube h264 yuv420p: `bun run render:episode <slug> --format=mp4 --crf=18`
- Square 1080x1080 (LinkedIn): stage with `data-width=data-height=1080`, `bun run render:episode <slug> --format=mp4`
- Lower-third overlay (alpha): `bunx hyperframes render <dir> --format mov` -> ProRes 4444 with alpha. `--format webm` -> VP9 alpha

Via turborepo: `turbo run render:episode --filter=@cgaravitoq/hyperframe`

## 11. Gitignored outputs

Don't commit `out/`, `renders/`, `node_modules/`, `.turbo/`. `bun.lock` IS committed (pinned).
R2 + remote manifests are canonical for generated render/media artifacts. After verified upload, local render outputs are deleted by default; pass `--keep-local` only when a local mp4 is needed for inspection. Fresh clones of remote-only episodes should run `bun run hydrate:episode <slug>` from `apps/hyperframe/` before previewing or rendering.

## 12. bun, not npm

Scripts via `bun run <name>`. Deps with `bun add`. Always `bun install` from repo root
(Bun 1.3.x has regressions installing from workspace subdirectories). Only acceptable `npx`: bootstrap one-off.

## 13. biome, not eslint/prettier

Applies to `.ts` and `.json`. HTML compositions use `bunx hyperframes lint <dir>` instead — Biome doesn't format HTML.

## 14. AGENTS.md canonical

One AGENTS.md at root, with `CLAUDE.md` as symlink.

## 15. Audio assets location

`apps/hyperframe/public/voice/<slug>/` (canonical). Copy `voice.mp3` and `captions.json` into
`apps/hyperframe/src/episodes/<slug>/assets/` before render.
`render-episode.mjs` auto-inlines `assets/captions.json` into `<script id="captions-data">` at render time.

## 16. TTS provider

`TTS_PROVIDER=elevenlabs|inworld`; default is ElevenLabs.
ElevenLabs voices use `ELEVENLABS_VOICE_ID_ES` / `ELEVENLABS_VOICE_ID_EN`.
ElevenLabs TTS defaults to `ELEVENLABS_MODEL_ID=eleven_v3`; override per run with `--model=<id>`.
Inworld requires `INWORLD_API_KEY` + `INWORLD_VOICE_ID_ES` / `INWORLD_VOICE_ID_EN`.
Inworld model defaults to `INWORLD_TTS_MODEL=inworld-tts-2`.
STT swap via `STT_PROVIDER=elevenlabs|hyperframes-transcribe`.

## 17. Voice tuning preset

`DEFAULT_VOICE_SETTINGS`: `stability=0.5`, `similarityBoost=0.82`, `speed=1.04` — tuned against the primary peninsular ES voice.
Override per-call with `--stability`, `--similarity-boost`, `--style`, `--speed`.
Hook 3-5s energetic: `--stability=0.35 --similarity-boost=0.75 --speed=1.0`.
Amplified style: `--style=0.25` (increases API latency).

See `docs/voice-config.md` for full voice configuration.

## 18. Script-side pause injection

`@cgaravitoq/audio` injects model-safe pause tags after `.!?` and `:;--`: Eleven v3 gets `[short pause]` / `[long pause]` only when pause flags are explicit; v2/v2.5 gets SSML `<break />`.
Skip via `--no-pause-injection`. Override `--pause-sentence=<ms>` and `--pause-clause=<ms>`.

## 19. Captions shape

`[{text, start, end, confidence?}]` in seconds. `text` keeps leading-space convention from `@remotion/captions`.
`captions-karaoke.js` consumes this directly. Scribe provider emits this shape natively.

## 20. Episode duration

`ffprobe(voice.mp3) + tail`. `render-episode.mjs` stamps `data-duration` and inlines captions in
`apps/hyperframe/out/episodes/<slug>/`. Source episodes are never mutated.
Tail resolution: `--tail` CLI flag > `meta.json` `tail` field > `0.3` fallback.
Canonical default for shorts with brand-card lockups: `tail: 3` in `meta.json`.

## 21. GSAP callbacks during seek

Hyperframes seeks the timeline (does not "play" it). `onStart`/`onComplete`/`tl.add(callback)`/`tl.call(...)` do NOT fire.
Use `tl.set(target, props, t)` (zero-duration tween) for discrete transitions — materialises at any seek position.
`onUpdate` IS seek-safe — works for animated counters, bar fills, ctx-bar saturating.

Run `bun run lint:seek-safe` from `apps/hyperframe/` to catch these antipatterns before render. The local linter
(`apps/hyperframe/scripts/lint-seek-safe.mjs`) scans inline `<script>` blocks in every episode's `index.html` and
enforces this rule plus rules 2 and 8:

| Pattern | Severity | Rewrite |
|---|---|---|
| `onStart` / `onComplete` / `onRepeat` / `onReverseComplete` in any tween config | error | `tl.set(target, props, t)` |
| `tl.call(...)` | error | `tl.set(target, props, t)` |
| `repeat: -1` | error | restructure the scene (rule 8) |
| `repeat: <n>` with `n > 0` | warning | rarely intended for a fixed-duration short |
| `setTimeout` / `setInterval` / `requestAnimationFrame` in timeline construction | error | restructure with explicit timeline positions |
| `gsap.timeline()` missing `paused: true` | error | add `paused: true` (rule 2) |
| Missing `window.__timelines["<id>"]` registration | error | register the timeline (rule 2) |

## 22. Track-index convention

Production shorts: `0..8` for BG layers + scenes, `97` for `#brand-corner`, `98` for audio, `99` for captions.
Scaffolder emits the same canonical indices.

## 23. Catalog enforcement

Every episode `index.html` must declare its visual catalog contract on the line immediately after `<!doctype html>`:

```html
<!-- catalog: [brand-logo-watermark, brand-logo-outro] -->
```

Required components can only be omitted with an inline opt-out that includes both `disabled: [...]` and `reason: "..."`. `catalog:check` runs in pre-commit and before render, validates IDs/statuses/tracks/entry validation rules, and fails before Hyperframes renders non-compliant episodes.

Catalog preflight starts from `packages/catalog/manifest.json`: run `bun run catalog:list` from `apps/hyperframe/` before choosing components, then copy snippets referenced by the manifest into the monolithic episode. Remote agents should call MCP `list_visual_components` instead of guessing component IDs.

For source-driven shorts, `assets/source.json` is the canonical input package for source metadata, publishability, attribution, and captured assets.

`brand-logo-outro` is the production closing contract. The final handoff must blur/scale crossfade from the penultimate scene into `#scene-brand-outro`; the logo pieces assemble first, then `#brand-name`, `#brand-tagline`, and source attribution when present reveal as one grouped blur scale-up (`autoAlpha: 0`, `scale: 0.88`, `filter: "blur(16px)"` to `autoAlpha: 1`, `scale: 1`, `filter: "blur(0px)"`). `catalog:check` enforces this rule through `requires outro text blur scale reveal`.

## 24. Visual framing and self-framed components

Avoid double-framing. A visual object that already represents a container should not be nested inside a generic glass/card wrapper.

Self-framed objects:

- Terminal windows
- Code editors
- Browser or app windows
- Social post cards
- Phone/device mockups
- Media player cards

Use these as the primary scene object and animate the object itself. Do not place them inside `.demo-card`, glass panels, or extra card shells unless the script explicitly needs a larger physical surface around the object.

Generic glass/card frames are appropriate for loose content that needs grouping: metrics, badges, short lists, unframed diagrams, and abstract blocks.

For diagrams, pick the frame by density. A compact chart or small decision diagram can sit inside a card. A workflow graph, pipeline, or multi-node flowchart should use an open canvas or full-scene frame so the nodes and connectors have breathing room in 9:16.

## 25. Generated raster source assets

Generated PNG/WebP assets are allowed when they improve visual-heavy scenes: product/workspace screenshots, handoff bundles, dense visual explainers, and connector-heavy diagrams. Store approved assets under `apps/hyperframe/src/episodes/<slug>/assets/generated/` and reference them from the monolithic `index.html` with relative paths.

Keep generated image text short. Important narration copy belongs in HTML. For Spanish labels, inspect rendered frames for accents and `ñ`; regenerate or overlay corrected HTML text if the image model gets orthography wrong.

Generated source assets needed for reproducible renders are committed. Heavy render outputs, local caches, and regenerable audio artifacts remain ignored. Document provenance in `assets/source.json`, `assets/research/research.md`, or `assets/generated/provenance.md`.

## 26. Hyperframes CLI CWD

`hyperframes.json` `paths.episodes: "src/episodes"` resolves relative to workspace cwd.
Run `bunx hyperframes <cmd>` and `bun run <script>` from `apps/hyperframe/` (or via `turbo run`).
Running from repo root fails to find episodes.
