# GSAP timeline reference

Load this file when writing the GSAP timeline for an episode. It contains the canonical pattern validated across `short-{01..08}`.

## Scene timing template

```js
const T = {
  hook:    { in: 0,    out: 5.5 },
  concept: { in: 5.5,  out: 13.0 },
  detail:  { in: 13.0, out: 23.0 },
  stats:   { in: 23.0, out: 32.0 },
  cta:     { in: 32.0, out: 50.0 },
};
const FADE = 0.75; // canonical scene cross-fade duration
```

## Scene visibility gates

All scenes have `data-duration="<TOTAL>"` and `position: absolute; inset: 0` on the element. Visibility is gated by GSAP `autoAlpha`, NOT Hyperframes clip semantics (clip auto-hide creates flicker at boundaries).

**Entry pattern (scene fades in):**
```js
// Scene starts hidden, then fades in at its start time
tl.set("#scene-concept", { autoAlpha: 0, scale: 1.06, filter: "blur(8px)" }, 0);
tl.to("#scene-concept",
  { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: FADE, ease: "power2.out" },
  T.concept.in);
```

**Exit pattern (scene fades out):**
```js
tl.to("#scene-concept",
  { autoAlpha: 0, scale: 0.94, filter: "blur(8px)", duration: FADE, ease: "power2.in" },
  T.concept.out - FADE);
```

## Why `tl.set` + `tl.to` (not `tl.fromTo`)

`tl.fromTo` is also valid but `tl.set(target, { autoAlpha: 0 }, 0)` is the canonical pattern because it's more explicit about the initial state. Hyperframes seeks frame-by-frame — `tl.set` at position 0 ensures the element is visible in the right state regardless of seek position.

## GSAP callbacks during seek

Hyperframes seeks (doesn't play), so:
- `onStart` / `onComplete` / `onUpdate` / `tl.add(callback)` / `tl.call(...)` do **NOT** fire
- `tl.set(target, props, t)` — zero-duration tween, materialises at any seek position. Use for discrete transitions (class toggle, textContent swap)
- For animated counters and bar fills use staggered `tl.set(target, props, t)` keyframes (the pattern used by `metric`/`big-stat`) — `onUpdate` does **NOT** fire during seek

## Brand corner crossfade

```js
// ~5s before end of CTA scene:
tl.set("#cta-brand", { autoAlpha: 0 }, 0);
tl.to("#brand-corner", { autoAlpha: 0, duration: 0.5, ease: "power2.in" }, T.cta.in + 5.0);
tl.fromTo("#cta-brand",
  { autoAlpha: 0, scale: 0.7, y: 30 },
  { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, ease: "back.out(1.7)" },
  T.cta.in + 5.2);
tl.to("#cta-brand", { scale: 1.04, duration: 0.5, yoyo: true, repeat: 1, ease: "sine.inOut" }, T.cta.in + 6.0);
```

## Mesh BG breathing

```js
// Half-period ≈ TOTAL/2:
tl.fromTo("#bg-mesh",
  { scale: 1.0, filter: "hue-rotate(0deg) saturate(1.05)" },
  { scale: 1.06, filter: "hue-rotate(20deg) saturate(1.18)", duration: TOTAL / 2, ease: "sine.inOut" }, 0);
tl.to("#bg-mesh",
  { scale: 1.0, filter: "hue-rotate(0deg) saturate(1.05)", duration: TOTAL / 2, ease: "sine.inOut" }, TOTAL / 2);
```

## Captions karaoke

```js
const captionsData = JSON.parse(document.getElementById("captions-data").textContent || "[]");
window.__hf.karaoke(tl, "#captions", captionsData, { maxChars: 24, maxTokens: 5 });
```

`render-episode.mjs` auto-inlines `assets/captions.json` into the `<script id="captions-data">` placeholder at render time. Source stays empty (`[]`).

## Timeline registry

```js
window.__timelines = window.__timelines || {};
window.__timelines["<slug>"] = tl;
```

Both lines are non-negotiable. Missing registry = no animation. Missing `paused: true` = frame seek breaks.

## Word-synced timing

Use word-level timestamps from `captions.json` to fire `tl.set`/`tl.to` events on the exact word:

```js
// "tools" spoken at 17.1s of audio, scene-arch starts at 11.0s
tl.to("#prim-tools", { scale: 1.04, duration: 0.3, yoyo: true, repeat: 1 },
      T.arch.in + 6.1);
```
