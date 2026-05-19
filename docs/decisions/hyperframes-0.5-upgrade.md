# Hyperframes 0.5.x compatibility audit

- **Date**: 2026-05-09
- **Investigated by**: agent
- **Current pin**: 0.4.45
- **Latest 0.5.x**: 0.5.5
- **Verdict**: hold on 0.4.45

## Findings

Raw release findings:

- npm: both `hyperframes` and `@hyperframes/producer` publish stable 0.5.0 through 0.5.5, plus 0.6.0 alpha builds. Latest stable 0.5.x is 0.5.5.
- v0.5.0: adds catalog VFX and captions block categories; changes lint warnings for too-large compositions; fixes runtime hard-seek audio desync on scrub; fixes runtime bundling. No explicit migration guide or breaking-change note found.
- v0.5.1: adds HyperFrames branding, HTML-in-Canvas guide, and removes captions catalog item. No explicit migration guide or breaking-change note found.
- v0.5.2: fixes stale cache on tag-based registry lookup. No direct render contract note found.
- v0.5.3: fixes player replay after video end. No direct render contract note found.
- v0.5.4: adds render-specific `--composition`, `--resolution`, and `png-sequence`; changes browser GPU mode fallback; scopes `getElementById` inside compositions; adds single-clock runtime transport to eliminate pause/play audio drift; adds player src-URL timeline handling. These touch runtime/player/core behavior that this repo relies on.
- v0.5.5: fixes runtime scheduling for future WebAudio clips. This touches audio scheduling.
- Current official docs still require `window.__timelines["<data-composition-id>"]` and paused GSAP timelines, and keep seek-by-frame semantics.
- Current official docs state `data-duration` is not used on composition elements and composition duration comes from `tl.duration()`. `short-08` includes `data-duration` on the root composition; this may be ignored, but it is a change-risk area for this repo's duration convention.
- Current official docs add caption discoverability attributes (`data-timeline-role="captions"`, `data-caption-root="true"`) for caption compositions. This repo uses inline karaoke captions in a timed `div` on track 99, not a caption composition.
- Current official docs recommend external `data-composition-src` for reusable compositions while still documenting inline compositions. This repo intentionally remains monolithic.
- Current official docs keep `data-start`, `data-duration`, and `data-track-index` in seconds/track attributes, and document relative timing additions.
- Current official docs document deterministic, producer-canonical seek rendering and no async/fetch during GSAP timeline setup.

Per constraint:

### 1. Monolithic single-file HTML
- Status: at-risk
- Evidence: 0.5.x docs still support inline compositions without `data-composition-src`, but the output checklist says each reusable composition should be in its own HTML file and external compositions use `data-composition-src`. The release notes include catalog/captions block work in v0.5.0 and v0.5.1, so the monolithic path is not proven by changelog evidence.

### 2. GSAP `paused: true` + `window.__timelines["<id>"]` registry
- Status: safe
- Evidence: current HTML schema docs say every composition must register a GSAP timeline at the key matching `data-composition-id`, and all timelines must start paused.

### 3. `data-duration` in seconds
- Status: at-risk
- Evidence: current data attribute docs say `data-duration` is seconds for clips but is not used on compositions; schema docs say composition duration comes from `tl.duration()`. `short-08` has root `data-duration="56.93"`, so root duration semantics require manual verification before upgrading.

### 4. Deterministic only
- Status: safe
- Evidence: current docs keep producer-canonical seek semantics, readiness gates, and frame adapter requirements for idempotent arbitrary seeks. Prompting docs still disallow async/fetch during GSAP timeline setup.

### 5. CWD for CLI is `apps/hyperframe/`
- Status: safe
- Evidence: release notes add CLI flags (`--composition`, `--resolution`, `png-sequence`) but do not mention CWD behavior changes. No docs evidence found that changes the local project resolution contract.

### 6. Track-index convention
- Status: safe
- Evidence: current data attribute and HTML schema docs keep `data-track-index` as the z-order and row grouping field. No 0.5.x release note mentions a track-index contract change.

### 7. `tl.set(target, props, t)` for discrete transitions; no `onStart`/`onComplete`/`tl.call()` for seek state
- Status: safe
- Evidence: current docs keep seek-by-frame semantics and GSAP `timeline.totalTime()` / `timeline.seek()` adapter behavior. No release note mentions callback-based seek materialization support, so this repo's stricter rule should remain.

## Recommendation

Hold the repo on Hyperframes 0.4.45 until a human runs a source-level audit or asks Hyperframes maintainers to confirm three contracts for 0.5.5: root composition `data-duration` behavior, inline monolithic composition support as a first-class path, and inline caption `div`/track 99 behavior under the v0.5 single-clock/WebAudio runtime changes. Manual catalog source-only adoption is fine, but dependency pins should not move on this evidence alone.

## References

- npm: `hyperframes` 0.5.x — https://www.npmjs.com/package/hyperframes/v/0.5.5
- npm: `@hyperframes/producer` 0.5.x — https://www.npmjs.com/package/@hyperframes/producer/v/0.5.5
- GitHub releases — https://github.com/heygen-com/hyperframes/releases
- v0.5.0 release — https://github.com/heygen-com/hyperframes/releases/tag/v0.5.0
- v0.5.4 release — https://github.com/heygen-com/hyperframes/releases/tag/v0.5.4
- Data attributes docs — https://hyperframes.mintlify.app/concepts/data-attributes
- HTML schema docs — https://hyperframes.mintlify.app/reference/html-schema
- Compositions docs — https://hyperframes.mintlify.app/concepts/compositions
- Determinism docs — https://hyperframes.mintlify.app/concepts/determinism
