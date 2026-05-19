# Captions positioning

Load this file when writing the `#captions` CSS block for an episode. This block is **non-negotiable** — without it, the runtime force-applies `position: absolute; inset: 0` and karaoke tokens float mid-screen instead of sitting in a bottom strip.

## Container CSS

```css
#captions {
  position: absolute; left: 0; right: 0; bottom: 4.5%; height: 12%;
  display: flex; align-items: center; justify-content: center;
  font-family: "Inter", system-ui, sans-serif;
  font-size: 60px; font-weight: 900; line-height: 1.1; letter-spacing: -1px;
  color: var(--paper);
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(0, 0, 0, 0.7);
  text-align: center; padding: 0 64px; box-sizing: border-box;
  pointer-events: none; z-index: 50;
}
```

## Active token accent

```css
#captions .hf-caption-token {
  opacity: 0.78;
  transition: color 0.06s linear, opacity 0.06s linear, transform 0.06s ease-out;
}
#captions .hf-caption-token.--active {
  color: var(--primary-2);  /* e.g. var(--cyan-2), var(--violet-2), var(--emerald-2) */
  opacity: 1;
  transform: scale(1.08);
}
```

The karaoke renderer (`window.__hf.karaoke`) attaches `.hf-caption-token` and `.hf-caption-token.--active` classes. The active accent is theme-driven — the renderer never hardcodes a color.

## Captions JSON inlining

The HTML source keeps an empty placeholder:
```html
<script type="application/json" id="captions-data">[]</script>
```

`render-episode.mjs` reads `assets/captions.json` and stamps the JSON into this placeholder when building the working copy under `out/episodes/<slug>/`. **Don't paste the JSON by hand** — the source stays diff-clean. If the placeholder tag is missing, render-episode aborts.

## Why inline (not fetch)

Hyperframes seeks the timeline immediately on render. Async construction (`await fetch()`) leaves tweens unregistered. The working-copy inline keeps the build synchronous without dirtying `src/`.
