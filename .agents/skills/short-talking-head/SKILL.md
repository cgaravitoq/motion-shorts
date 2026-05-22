---
name: short-talking-head
description: >
  Use when a short needs a presenter "talking head" cutout composited into the scene -- a
  transparent VP9-alpha video of a person speaking, hole-cut over background layers and HTML
  headlines. Covers the full Hyperframes avatar workflow: HeyGen (or any presenter MP4) ->
  `hyperframes remove-background` -> `speaker.webm` + `plate.webm` -> drop into a Hyperframes
  composition via the `talking-head-cutout` catalog component. Defer to this skill whenever
  the user says "add a talking head", "presenter cutout", "avatar in the short", "HeyGen
  avatar", or asks to composite a person over motion-graphics. Skip for static portraits,
  static PFP overlays (use `yt-lower-third` / `tiktok-follow` / `instagram-follow`), or
  full-frame webcam footage with no alpha.
---

# Short: talking-head cutout (Hyperframes avatar workflow)

> **CWD**: all bash commands below assume `cd apps/hyperframe` first.

Adds a transparent VP9-alpha presenter cutout to an otherwise normal Hyperframes short. The
presenter is *hole-cut* into the composition: an inverse-alpha plate on the background track,
HTML headlines on intermediate tracks, and the subject cutout on a higher track. This skill
covers asset generation (`hyperframes remove-background`) and composition wiring; the rest of
the pipeline (script, audio, captions, render, brand outro) follows `canonical-short`.

## Pre-flight

1. **Catalog preflight.** Run `bun run catalog:list` and confirm `talking-head-cutout` is in
   the list. Inspect `packages/catalog/components/talking-head-cutout/entry.json` for the
   current usage and validation rules.
2. **Presenter source.** Decide where the presenter video comes from:
   - **HeyGen avatar** (first-party): run the HeyGen skills (`heygen-avatar`,
     `heygen-video`). See "HeyGen path" below.
   - **Any other presenter MP4**: webcam recording, D-ID, Synthesia, Google Veo, Loom,
     QuickTime export. The only hard requirement is a clean, well-lit subject against a
     solid (ideally green or pure white) background. `hyperframes remove-background` accepts
     any MP4.
3. **Env.** `HEYGEN_API_KEY` is only required for the HeyGen path. See `.env.example`.

## Pipeline

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
drop into composition via catalog `talking-head-cutout`
    |
follow canonical-short for voice, captions, render, brand outro
```

## HeyGen path (first-party, requires HEYGEN_API_KEY)

The Hyperframes CLI ships first-party skills for the HeyGen avatar API. They are NOT
installed by default and require a HeyGen account.

```bash
# One-time install (interactive; uses the user's local HeyGen account)
bunx hyperframes skills install heygen-avatar heygen-video
```

Once installed, the agent-facing flow is:

1. `heygen-avatar` -- upload a clear front-facing photo. Writes
   `AVATAR-<NAME>.md` to the working dir with the avatar id, voice id, training status,
   and a sample MP4 URL.
2. `heygen-video` -- pass the avatar id + a script (or audio file). Writes the
   final presenter MP4 (typically `speaker.mp4`).

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
- D-ID, Synthesia, or Heygen alternatives (any service that ships an MP4).
- Google Veo, Sora, or other generative video tools that produce a clean presenter shot.

For best alpha extraction, ensure the subject is well-lit and the background contrasts
clearly. The tool produces two artifacts:

- `speaker.webm` -- VP9 with alpha channel. The presenter on transparency.
- `plate.webm` -- the inverse-alpha background cutout. Sits on track 0 so HTML scenes above
  it appear to "fill the hole" the subject occupies.

## Hole-cut composition pattern

The composition layers, from back to front:

| Track | Element | Why |
|---|---|---|
| **0** | `plate.webm` (inverse-alpha cutout) | Establishes the "hole" the subject sits in. HTML headlines on intermediate tracks render *above* this layer, so they fill the silhouette gap. |
| 1-3 | Background mesh / grid / vignette | Standard background stack from `canonical-short`. |
| **2** | HTML headline scene | Copy reads above the plate and behind the subject. |
| 3+ | Other scene HTML | Normal scenes. |
| **3** (or higher) | `speaker.webm` (transparent VP9-alpha subject) | The presenter occludes everything below it. Pick a track high enough to overlap your headline scene but below brand-corner (97). |
| 97 | `#brand-corner` watermark | Required, from `brand-logo-watermark`. |
| 98 | `<audio id="voiceover">` | Voiceover. |
| 99 | `#captions` | Karaoke captions. |

> The example shows plate on 0 and subject on 3 to match the task's documented layering. The
> demo episode uses subject on track 5 to allow more headline scene tracks below it; either
> works as long as plate < HTML < subject.

### The wrapper indirection (non-negotiable)

The runtime force-applies `position: absolute; top: 0; left: 0; width: 100%; height: 100%`
on every direct child of `#stage` that has `data-start`. That includes `<video>` elements
themselves once they have `data-start` (which they need so Hyperframes owns alpha-frame
decoding under seek).

Result: a tracked `<video>` is sized to the stage. Good for full-frame cutouts -- bad if
you try to tween `scale` or `transform` directly on it, because the runtime keeps writing
its inline styles every frame.

**Pattern**: wrap each `<video>` in a non-timed `<div>`. The wrapper has its own CSS
(typically `position: absolute; inset: 0`) and is the GSAP target for opacity/scale tweens.
The `<video>` inside is timed (`data-start`, `data-duration`, `data-track-index`, `id`) so
Hyperframes decodes alpha frames seek-safely.

```html
<div id="thc-subject" class="talking-head-cutout__subject-wrap">
  <video id="thc-subject-video"
         class="talking-head-cutout__subject"
         src="assets/speaker.webm"
         data-start="0" data-duration="10" data-track-index="5"
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

Standard Hyperframes rules apply:

- `gsap.timeline({ paused: true })` -- frame-accurate seek requires it.
- `window.__timelines["<composition-id>"] = tl` -- registry is mandatory.
- Use `tl.set()` for discrete state changes; `onStart` / `onComplete` / `tl.call()` do NOT
  fire under seek.
- `playsinline muted` on `<video>` -- Chromium renderer needs these to decode alpha
  frames offscreen. No `autoplay`, no `loop`.

## R2 hydration

Transparent WebMs are heavy (often 20-80 MB for a 10-15s clip). Do NOT commit them.

- `apps/hyperframe/src/episodes/*/assets/*.webm` is already gitignored.
- Push `speaker.webm` and `plate.webm` to R2 alongside the regular audio artifacts.
- Add both to `assets.remote.json` so `bun run hydrate:episode <slug> --manifest=assets`
  restores them on a fresh clone.
- The render pipeline picks them up from `assets/` once hydrated.

If a teammate's local episode is missing the WebMs, hydration recreates them from R2.

## Build the short

After `speaker.webm` and `plate.webm` are in `apps/hyperframe/src/episodes/<slug>/assets/`:

1. Scaffold the episode (`bun run new:episode <slug>` from `apps/hyperframe/`).
2. Replace the catalog declaration on line 2 of `index.html` with the talking-head set:
   ```html
   <!-- catalog: [brand-logo-watermark, brand-logo-outro, talking-head-cutout] -->
   ```
3. Drop the `talking-head-cutout` snippet
   (`packages/catalog/snippets/talking-head-cutout.html`) into the stage. Adjust track
   indices if your scene layout differs from the demo.
4. Author the rest of the scenes per `canonical-short`. The presenter cutout is one scene
   beat -- the rest of the short (concept, detail, stats, brand outro) still follows the
   5-scene template.
5. Generate audio + captions per `audio-pipeline`. Build the GSAP timeline. Render.

## Demo + catalog

- Catalog component: `packages/catalog/components/talking-head-cutout/entry.json`
- Snippet: `packages/catalog/snippets/talking-head-cutout.html`
- Demo episode: `apps/hyperframe/src/episodes/demo-talking-head/index.html`
  - Ships with placeholder `<video src="assets/speaker.webm">` and
    `<video src="assets/plate.webm">` pointing to assets that do NOT exist in the repo.
    Run `hyperframes remove-background` on your own presenter MP4 to materialize them.
  - The lint passes clean apart from the standard `audio_src_not_found` warning for
    `assets/voice.mp3` (same as every other demo episode in this repo).

## Gotchas

- **Subject sits too low**: increase the subject's `data-track-index`. The presenter must be
  above your headline scene, not below.
- **Subject fills the frame edge-to-edge**: `object-fit: cover` + `object-position: center
  top` keeps the head anchored. For waist-up framing, pre-crop the MP4 before running
  `remove-background`.
- **Edges look jagged**: HeyGen and most cutout tools use semi-transparent edge pixels --
  this needs VP9 with alpha, not WebP or PNG sequence. Verify the WebM is `vp9` codec with
  `pix_fmt: yuva420p` via `ffprobe -show_streams assets/speaker.webm`.
- **Video frozen in renders**: the `<video>` is missing `data-start`. Hyperframes only
  manages playback for timed media; without `data-start` it shows the first frame and
  stops.
- **Animations don't apply during seek**: targeting `<video>` directly instead of the
  wrapper. Move the GSAP target to the non-timed wrapper div.
- **Plate isn't doing anything**: the plate is the *inverse* cutout, not a generic
  background. Without HTML scenes layered between plate (track 0) and subject (track 3+),
  there is no visible "hole-cut" effect. Either accept a simpler composition (subject over
  background) or add headline scenes between the two video layers.

## Out of scope (handled by parallel skills)

- Voice generation and captions -- `audio-pipeline`.
- 5-scene short structure, brand outro, hierarchical spacing -- `canonical-short`.
- Episode scaffolding -- `new-episode`.
- Static PFP avatars in social overlays -- `yt-lower-third`, `tiktok-follow`,
  `instagram-follow`.

## See also

- `AGENTS.md` -- critical constraints (rule 1: wrapper indirection; rule 2: paused +
  registry; rule 7: seek-safe).
- `packages/catalog/components/talking-head-cutout/entry.json` -- catalog entry.
- `apps/hyperframe/src/episodes/demo-talking-head/index.html` -- working reference.
- `.agents/skills/canonical-short/SKILL.md` -- the full short pipeline.
- `.env.example` -- `HEYGEN_API_KEY` placeholder.
