# Formats — render profiles

motion-shorts ships two render profiles. Both come out of the same monolithic-single-file pipeline (AGENTS.md rule 1) and share the same `assets/voice.mp3` + `assets/captions.json` per episode.

| Profile        | Aspect | Resolution  | FPS | Codec / audio                      | Target use                                                              | Source file              |
|----------------|--------|-------------|-----|------------------------------------|-------------------------------------------------------------------------|--------------------------|
| `short`        | 9:16   | 1080 × 1920 | 30  | H.264 High + AAC-LC 48 kHz         | YouTube Shorts, TikTok, Instagram Reels, LinkedIn mobile feed           | `index.html`             |
| `desktop-1080p`| 16:9   | 1920 × 1080 | 30  | H.264 High + AAC-LC 48 kHz / 384 kbps, 12 Mbps 2-pass VBR | YouTube long-form, LinkedIn desktop, X landscape, Vimeo, embedded heroes | `index.desktop.html`     |

`short` is the default; existing episodes and tooling work unchanged. `desktop-1080p` is purely additive — opt-in per episode by adding an `index.desktop.html` (the scaffolder stamps one with `bun run new:episode <slug> --with-desktop`).

## Render

```bash
# 9:16 short (default, byte-identical to pre-desktop behavior):
bun run render:episode <slug>
bun run render:episode <slug> --variant=short

# 16:9 desktop:
bun run render:episode <slug> --variant=desktop-1080p
```

Container is independent of variant:

```bash
bun run render:episode <slug> --variant=desktop-1080p --format=mp4   # h264 mp4 (default)
bun run render:episode <slug> --variant=desktop-1080p --format=mov   # ProRes 4444 + alpha
bun run render:episode <slug> --variant=desktop-1080p --format=webm  # VP9 + alpha
```

> Why `--variant` and not `--format=desktop-1080p`? `--format` in the existing `bunx hyperframes render` surface already means container (mp4 / mov / webm). Keeping that flag stable preserves byte-identical 9:16 renders and avoids ambiguity at the boundary with the upstream Hyperframes CLI. Inside the catalog manifest the per-component scope field is still called `safeFor: ["short", "desktop-1080p"]`.

## Stage markup contract

Every episode stage declares its profile:

```html
<!-- index.html (9:16) -->
<div id="ep-stage"
     data-composition-id="<slug>"
     data-width="1080" data-height="1920" data-fps="30"
     data-start="0" data-duration="<stamped>">

<!-- index.desktop.html (16:9) -->
<div id="ep-stage"
     data-composition-id="<slug>-desktop"
     data-format="desktop-1080p"
     data-width="1920" data-height="1080" data-fps="30"
     data-start="0" data-duration="<stamped>">
```

The `data-format` attribute on the desktop variant is what `bun run lint:desktop-safe` keys off. The 9:16 short does not set `data-format` — absence means `short`.

## Safe zones — 16:9 desktop

```
+--------------------------------------------------------------------+   1920 × 1080
|                                                                    |
|    +----- action-safe (inner 90%, 1728 × 972) ----------------+   |
|    |                                                          |   |
|    |    +---- title-safe (inner 80%, 1536 × 864) ---------+  |   |
|    |    |                                                 |  |   |
|    |    |  Critical text, KPIs, CTAs MUST stay here.      |  |   |
|    |    |  Mark each with data-critical="true" so the     |  |   |
|    |    |  lint:desktop-safe script can validate inset.   |  |   |
|    |    |                                                 |  |   |
|    |    +-------------------------------------------------+  |   |
|    |                                                          |   |
|    +----------------------------------------------------------+   |
|                                                              +-+  |
|  +----- YouTube end-screen bar (bottom 120 px) -----------+  |C|  |
|  |  Reserved by YouTube for "subscribe / next video" UI.  |  |T|  |
|  |  No critical content. Captions sit ABOVE this band.    |  |A|  |
|  +--------------------------------------------------------+  +-+  |
+--------------------------------------------------------------------+
                                              CTA / info-card slot
                                              (bottom-right 160 × 160)
```

* **Title-safe (1536 × 864)** — `data-critical` elements need ≥192 px left/right inset and ≥108 px top/bottom inset. Headlines, KPIs, CTAs, source-attribution.
* **Action-safe (1728 × 972)** — secondary UI; not enforced today, scope-tier-2.
* **YouTube end-screen bar** — bottom 120 px. YouTube overlays "Subscribe" / "Next video" / "More videos" here on long-form. Keep critical content above. Captions in the desktop template are pinned to `bottom: 180px` for this reason.
* **YouTube CTA / info-card slot** — bottom-right 160 × 160 px. YouTube cards and "Subscribe" hover badge land here.

## Debug overlay — `?guides=1`

The `desktop-1080p.html` template includes a `#safe-zone-guides` overlay that visualises both safe bands and both dead zones. Toggle by appending `?guides=1` to the dev URL (e.g. `http://localhost:3000?guides=1`). The overlay is non-rendering — it's hidden unless `?guides=1` is set, so renders never see it.

## Lint

```bash
bun run lint:desktop-safe                              # scan every src/episodes/*/index.desktop.html
bun run lint:desktop-safe src/episodes/<slug>          # scan one episode
```

Episodes without an `index.desktop.html` are vacuously green — the linter skips them. Catches today:

* Stage box must be `data-width="1920" data-height="1080" data-fps="30" data-format="desktop-1080p"`.
* `data-critical` elements with inline `left/right/top/bottom` styles must satisfy title-safe insets.
* `data-critical` elements must not overlap the YouTube end-screen bar (bottom 120 px) or the CTA slot (bottom-right 160 × 160).

Scope-tier-2 follow-ups (deliberately deferred): action-safe enforcement, font-size minimums for desktop readability, lower-third overlay collision detection.

## Catalog — `safeFor`

Every component in `packages/catalog/manifest.json` declares which variants it ships in:

```json
{
  "id": "data-chart",
  "safeFor": ["short"]
}
```

Today every component is `["short"]` — additive default for back-compat. As components are validated for desktop layouts they'll be promoted to `["short", "desktop-1080p"]`. Picker filtering by `safeFor` is intentionally out of scope here.

## Follow-ups (not in this profile set)

* `desktop-4k` (3840 × 2160, 40 Mbps) for premium long-form delivery.
* `square-1080` (1:1, 1080 × 1080) for Facebook / LinkedIn mobile feed.
* `--fps=60` opt-in for high-motion shorts.
* Catalog picker filter by `safeFor`.
