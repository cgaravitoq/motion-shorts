# VFX Liquid Glass Spike

## Context

the spike evaluates whether the Hyperframes `vfx-liquid-glass` catalog block can be adapted into this repo's inline 9:16 monolithic episode pattern without `data-composition-src`. The spike also pairs it with one simple transition block to test how a catalog-style effect composes with seek-safe GSAP scene changes.

## Candidates

- `vfx-liquid-glass`: catalog VFX block tagged `html-in-canvas` and `webgl`, 1920×1080, 20s, intended to be installed as `compositions/vfx-liquid-glass.html` and embedded with `data-composition-src`.
- `transitions-dissolve`: catalog CSS transition showcase, 1920×1080, 24s, intended as a separate host composition.
- `grid-pixelate-wipe`: catalog component/snippet for a deterministic grid wipe between scenes; already close to this repo's inline pattern.

## Chosen blocks

- `vfx-liquid-glass`: chosen because it is the target effect for the spike. The catalog entry is coupled to an external composition and HTML-in-Canvas/WebGL, so the demo will inline a stripped-down CSS/SVG approximation if the install-oriented reference cannot be imported cleanly into a single episode.
- `grid-pixelate-wipe`: chosen as the transition because it is the simplest viable wipe-style snippet for this repo: no nested composition, no `data-composition-src`, deterministic cell count, and it can be driven from the parent paused GSAP timeline with seek-safe `tl.set` state changes.

## Open Questions

- Can the full WebGL `vfx-liquid-glass` implementation be productized inline without relying on `data-composition-src` or asynchronous texture capture?
- Does the CLI render path require additional Chrome/WebGL flags beyond Hyperframes' documented HTML-in-Canvas support?
- Is the CSS/SVG approximation visually close enough for production shorts, or should follow-up work isolate the real shader implementation?
- The spike uses a silent `voice.mp3` at track 98 only because the canonical render script requires an audio asset to stamp duration. It omits captions because this is a visual-only integration test and no track 99 element is needed unless follow-up work turns it into a narrated short.

## Render Metrics

Command: `bun run render:episode spike-vfx-liquid-glass --format=mp4 --crf=18` from `apps/hyperframe/`.

| Run | Wall time | Output bytes | SHA-256 |
| --- | ---: | ---: | --- |
| 1 | 9.634s | 2,420,089 | `66f0f29e5e9932a470ed083cff5a916e792b664027659c50e6b7468177831154` |
| 2 | 8.922s | 2,420,089 | `66f0f29e5e9932a470ed083cff5a916e792b664027659c50e6b7468177831154` |

Result: deterministic. Both renders produced identical bytes and SHA-256 hashes.

Observed caveats:

- `bunx hyperframes lint src/episodes/spike-vfx-liquid-glass` passes with 0 errors and 1 warning: `composition_file_too_large`. The repo forbids splitting this spike into nested compositions because `data-composition-src` is banned for episodes.
- The catalog `vfx-liquid-glass` reference is install/embed oriented (`data-composition-src`) and documents HTML-in-Canvas/WebGL. This spike therefore uses an inline CSS/SVG approximation rather than the full WebGL block.
- No Chrome/WebGL runtime errors were observed. The CSS/SVG approximation did not trigger the HTML-in-Canvas Chrome flag path.

## Recommendation

experiment

The inline approximation renders deterministically and fits the monolithic 9:16 episode constraints, but it does not prove that the full catalog `vfx-liquid-glass` WebGL/HTML-in-Canvas block can be productized without `data-composition-src`. Continue with a focused follow-up that ports the real shader path inline before promoting the effect to production templates.
