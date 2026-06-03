---
name: short-talking-head
description: >
  Use when you need to prepare a presenter "talking head" cutout asset -- a transparent
  VP9-alpha video of a person speaking, plus its inverse-alpha plate -- for use in a short.
  Covers presenter sourcing (HeyGen or any MP4) and background removal via
  `hyperframes remove-background` -> `speaker.webm` + `plate.webm`. Defer to this skill when
  the user says "add a talking head", "presenter cutout", "avatar in the short", "HeyGen
  avatar", or asks to composite a person over motion-graphics. NOTE: the 13-type scene-hub
  has no avatar/cutout scene-type yet, so this skill currently produces the *asset* only --
  scene integration is a documented follow-up (see "Integration status"). Skip for static
  portraits, static PFP overlays (use the `social-card` scene-type), or full-frame webcam
  footage with no alpha.
---

# Short: talking-head cutout (presenter asset prep)

> **CWD**: all bash commands below assume `cd apps/hyperframe` first.

Prepares a transparent VP9-alpha presenter cutout (and its inverse-alpha plate) for a
short. The technique *hole-cuts* the presenter into a composition: an inverse-alpha plate
behind, HTML copy in the middle, and the subject cutout in front. This skill owns the asset
generation step (`hyperframes remove-background`) and the compositing knowledge needed to
wire it later.

**Integration status (read first):** the current short pipeline assembles a monolithic
`index.html` from a typed `scene-spec.json` using the 13-type scene-hub (hook, title-cards,
flow, fanout, metric, bars, big-stat, comparison, timeline, quote, code, social-card,
outro). None of
those scene-types wraps an alpha-video presenter. So this skill **stops at the asset** --
`speaker.webm` + `plate.webm`. Dropping the cutout into a short requires a future
avatar-capable scene-type (see "Integration status" at the bottom). The rest of this file is
asset-prep guidance plus the layering/seek-safety knowledge that scene-type will need.

## Pre-flight

1. **Presenter source.** Decide where the presenter video comes from:
   - **HeyGen avatar** (first-party): run the HeyGen skills (`heygen-avatar`,
     `heygen-video`). See "HeyGen path" below.
   - **Any other presenter MP4**: webcam recording, D-ID, Synthesia, Google Veo, Loom,
     QuickTime export. The only hard requirement is a clean, well-lit subject against a
     solid (ideally green or pure white) background. `hyperframes remove-background` accepts
     any MP4.
2. **Env.** `HEYGEN_API_KEY` is only required for the HeyGen path. See `.env.example`.
   Read via `import { env } from "@cgaravitoq/audio/env"` then `env.HEYGEN_API_KEY` -- do not
   read `process.env.HEYGEN_API_KEY` directly (enforced by `bun run lint:env`).

## Pipeline (asset prep)

```
photo (HeyGen only)
    |
heygen-avatar  -> AVATAR-<NAME>.md   (avatar manifest)
    |
heygen-video   -> speaker.mp4       (or webcam / D-ID / Synthesia / Veo / Loom export)
    |
hyperframes remove-background  -> speaker.webm  (VP9-alpha subject)
                               -> plate.webm    (inverse-alpha background cutout)
    |
push to R2 + assets.remote.json  (see "R2 hydration")
    |
[follow-up] wire into a short via a future avatar scene-type (see "Integration status")
```

## HeyGen path (first-party, requires HEYGEN_API_KEY)

The Hyperframes CLI ships first-party skills for the HeyGen avatar API. They are NOT
installed by default and require a HeyGen account.

```bash
# One-time install (interactive; uses the user's local HeyGen account)
bunx hyperframes skills install heygen-avatar heygen-video
```

Once installed, the agent-facing flow is:

1. `heygen-avatar` -- upload a clear front-facing photo. Writes `AVATAR-<NAME>.md` to the
   working dir with the avatar id, voice id, training status, and a sample MP4 URL.
2. `heygen-video` -- pass the avatar id + a script (or audio file). Writes the final
   presenter MP4 (typically `speaker.mp4`).

Both skills are HeyGen-specific and live in the Hyperframes upstream skills registry. They
are documented in the Hyperframes docs; this repo does not redistribute them.

## Provider-agnostic fallback

If HeyGen is not available, any presenter MP4 works. `hyperframes remove-background` is
provider-neutral:

```bash
bunx hyperframes remove-background path/to/presenter.mp4 \
  --subject path/to/speaker.webm \
  --plate path/to/plate.webm
```

Recommended fallbacks, in rough order of fidelity:

- Webcam / QuickTime recording against a solid-color wall.
- Loom / OBS export at 1080p or higher.
- D-ID, Synthesia, or HeyGen alternatives (any service that ships an MP4).
- Google Veo, Sora, or other generative video tools that produce a clean presenter shot.

For best alpha extraction, ensure the subject is well-lit and the background contrasts
clearly. The tool produces two artifacts:

- `speaker.webm` -- VP9 with alpha channel. The presenter on transparency.
- `plate.webm` -- the inverse-alpha background cutout. Sits on a low track so HTML scenes
  above it appear to "fill the hole" the subject occupies.

## Hole-cut composition pattern (reference for the future scene-type)

This is the layering an avatar scene-type would implement. Track allocation follows the
scene-hub convention (0-3 background, 4/5/6/8/9.. scenes, 7 outro, 97 brand-corner, 98
audio, 99 captions). The plate must be below the HTML copy, which must be below the subject.

| Track | Element | Why |
|---|---|---|
| **0** | `plate.webm` (inverse-alpha cutout) | Establishes the "hole" the subject sits in. HTML copy on a higher track renders *above* this layer, so it fills the silhouette gap. |
| 1-3 | Background mesh / grid / vignette | Standard shell background stack (`_shell`). |
| scene track (4/5/6/8/9..) | HTML headline / copy | Copy reads above the plate and behind the subject. |
| **higher scene track** | `speaker.webm` (transparent VP9-alpha subject) | The presenter occludes everything below it. Pick a track above the copy but below brand-corner (97). |
| 7 | outro scene | Pinned brand sign-off, last. |
| 97 | `#brand-corner` watermark | From the shell. |
| 98 | `<audio id="voiceover">` | Voiceover. |
| 99 | `#captions` | Karaoke captions. |

> Requirement is ordering, not exact numbers: `plate < HTML copy < subject`.

### The wrapper indirection (non-negotiable)

The runtime force-applies `position: absolute; top: 0; left: 0; width: 100%; height: 100%`
on every tracked direct child of `#stage`. That includes `<video>` elements themselves once
they have `data-start` (which they need so Hyperframes owns alpha-frame decoding under seek).

Result: a tracked `<video>` is sized to the stage. Good for full-frame cutouts -- bad if you
tween `scale` or `transform` directly on it, because the runtime keeps writing its inline
styles every frame.

**Pattern**: wrap each `<video>` in a non-timed `<div>`. The wrapper has its own CSS
(typically `position: absolute; inset: 0`) and is the GSAP target for opacity/scale tweens.
The `<video>` inside is timed (`data-start`, `data-duration`, `data-track-index`, `id`) so
Hyperframes decodes alpha frames seek-safely.

```html
<div id="thc-subject" class="thc__subject-wrap">
  <video id="thc-subject-video"
         class="thc__subject"
         src="assets/speaker.webm"
         data-start="0" data-duration="10" data-track-index="6"
         playsinline muted preload="auto"></video>
</div>
```

GSAP tweens always target the wrapper:

```js
tl.set("#thc-subject", { autoAlpha: 0 }, 0);
tl.to("#thc-subject", { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0.3);
```

Never `tl.to("#thc-subject-video", { ... })`.

### Seek-safe + paused timeline

Standard Hyperframes rules apply (the generated shell already wires these):

- `gsap.timeline({ paused: true })` -- frame-accurate seek requires it.
- `window.__timelines["<slug>"] = tl` -- registry is mandatory.
- Use `tl.set()` for discrete state changes; `onStart` / `onComplete` / `tl.call()` do NOT
  fire under seek.
- `playsinline muted` on `<video>` -- the Chromium renderer needs these to decode alpha
  frames offscreen. No `autoplay`, no `loop`.

## R2 hydration

Transparent WebMs are heavy (often 20-80 MB for a 10-15s clip). Do NOT commit them.

- `apps/hyperframe/src/episodes/*/assets/*.webm` is already gitignored.
- Push `speaker.webm` and `plate.webm` to R2 alongside the regular audio artifacts.
- Add both to `assets.remote.json` so `bun run hydrate:episode <slug> --manifest=assets`
  restores them on a fresh clone.
- The render pipeline picks them up from `assets/` once hydrated.

If a teammate's local episode is missing the WebMs, hydration recreates them from R2.

## Asset QA gotchas

- **Edges look jagged**: HeyGen and most cutout tools use semi-transparent edge pixels --
  this needs VP9 with alpha, not WebP or PNG sequence. Verify the WebM is `vp9` codec with
  `pix_fmt: yuva420p` via `ffprobe -show_streams assets/speaker.webm`.
- **Subject fills the frame edge-to-edge**: `object-fit: cover` + `object-position: center
  top` keeps the head anchored once composited. For waist-up framing, pre-crop the MP4
  before running `remove-background`.
- **Plate looks wrong on its own**: the plate is the *inverse* cutout, not a generic
  background. It only does something once HTML copy is layered between plate and subject. On
  its own it is expected to look like a silhouette mask.

## Integration status (follow-up)

The scene-hub (`apps/hyperframe/templates/scenes/<type>/v1/`) has 13 scene-types: hook,
title-cards, flow, fanout, metric, bars, big-stat, comparison, timeline, quote, code,
social-card, outro.
**None of them wraps an alpha-video presenter.** A short is assembled deterministically from
`scene-spec.json` by the engine in `apps/hyperframe/scripts/lib/` (`scene-instantiator`,
`assemble-episode`, `scene-spec`, `scene-router`) -- `index.html` is generated, never
hand-edited.

To make the presenter cutout usable in a short, the integration point is a **new
avatar-capable scene-type** added to the hub:

- A `templates/scenes/avatar/v1/{manifest.json,fragment.html,styles.css,timeline.js,sample.json}`
  set that emits the wrapper-div + timed `<video>` pattern above on a scene track, plus an
  optional inverse `plate.webm` on a background track.
- Spec fields for the asset paths (`subject`, `plate`), track placement, and in/out timing.
- The wrapper indirection and seek-safe rules above encoded in its `timeline.js`.

Until that scene-type exists, this skill delivers the prepped `speaker.webm` + `plate.webm`
in `apps/hyperframe/src/episodes/<slug>/assets/` (pushed to R2). Wiring them into a rendered
short is blocked on that follow-up.

> The orphaned `apps/hyperframe/src/episodes/demo-talking-head/` predates the scene-hub
> migration: it is a hand-authored monolithic `index.html` with no `scene-spec.json`, so it
> is not assembled or maintained by the current pipeline. Treat it as historical reference
> only.

## Out of scope (handled by parallel skills)

- Voice generation and captions -- audio-pipeline (`bun run audio ...`).
- The typed scene-spec short pipeline, scene-hub, assembly, per-scene QA, render --
  `canonical-short` and the intent skills (`short-informative`, `short-data-visual`,
  `short-workflow-explainer`, `short-social-overlay`, `short-brand-system`,
  `short-vfx-experimental`).
- Episode scaffolding (`bun run new:episode <slug>`) -- `new-episode`.
- Static PFP avatars in social overlays -- the `social-card` scene-type.

## See also

- `AGENTS.md` -- critical constraints (monolithic generated single file, paused timeline +
  registry, seek-safe, track convention).
- `apps/hyperframe/templates/scenes/` -- the 13 scene-types (none avatar-capable yet).
- `apps/hyperframe/scripts/lib/` -- the assembler engine the future avatar scene-type plugs
  into.
- `.agents/skills/canonical-short/SKILL.md` -- the full short pipeline.
- `.env.example` -- `HEYGEN_API_KEY` placeholder.
