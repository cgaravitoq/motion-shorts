# Formats — render profiles

motion-shorts ships **one** supported render profile: the **9:16 short**. It comes out of the monolithic-single-file pipeline (AGENTS.md rule 1) — `index.html` is generated from `scene-spec.json` by the assembler — and pairs with the episode's `assets/voice.mp3` + `assets/captions.json`.

| Profile | Aspect | Resolution  | FPS | Codec / audio              | Target use                                                    | Source file  |
|---------|--------|-------------|-----|----------------------------|---------------------------------------------------------------|--------------|
| `short` | 9:16   | 1080 × 1920 | 30  | H.264 High + AAC-LC 48 kHz | YouTube Shorts, TikTok, Instagram Reels, LinkedIn mobile feed | `index.html` |

> 16:9 and 1:1 variants are a planned future **shell variant** (`templates/_shell/`), not a feature today. There is no `--variant`, no `--with-desktop` / `--with-square`, and no `index.desktop.html` / `index.square.html` to author.

## Render

`index.html` is generated — assemble it from `scene-spec.json` first, then render:

```bash
bun run assemble <slug>                          # regenerate index.html from scene-spec.json
bun run render:episode <slug> --format=mp4       # final full render
bun run render:episode <slug> --format=mp4 --keep-local
```

Container is selected with `--format`:

```bash
bun run render:episode <slug> --format=mp4   # h264 yuv420p mp4 (default)
bun run render:episode <slug> --format=mov   # ProRes 4444 + alpha
bun run render:episode <slug> --format=webm  # VP9 + alpha
```

Opt into 60 fps with `--fps=60`. The render wrapper forwards the frame rate to Hyperframes and stamps `data-fps="60"` onto the working-copy stage. The 30 fps target bitrate is **10 Mbps**; at 60 fps it scales to **15 Mbps**.

| FPS | Video bitrate |
|-----|---------------|
| 30  | 10 Mbps       |
| 60  | 15 Mbps       |

## Stage markup contract

The assembled `index.html` declares the profile on its root stage:

```html
<div id="ep-stage"
     data-composition-id="<slug>"
     data-width="1080" data-height="1920" data-fps="30"
     data-start="0" data-duration="<stamped>">
```

`render:episode` stamps `data-duration` from the measured voice length (+ tail) and stamps `data-fps` from `--fps`. Never hand-edit `index.html` — change `scene-spec.json` and re-run `bun run assemble`.

## Safe zones — 9:16 short

The shell (`templates/_shell/shell.css`) reserves the bottom strip for captions and pins the brand corner. Keep critical content clear of both.

```
+----------------------------+   1080 × 1920
|        96px        [brand]  |  <- #brand-corner: top/right 96px
|                            |
|                            |
|   Scene content lives in   |
|   the central region.      |
|   KPIs, headlines, CTAs    |
|   stay clear of the bottom |
|   caption band.            |
|                            |
|                            |
|  +----- captions band ---+ |  <- #captions: bottom 4.5%, height 12% (track 99)
|  +-----------------------+ |
+----------------------------+
```

* **Caption band** — `#captions` (track 99) sits at `bottom: 4.5%`, `height: 12%`. No scene content overlaps it; the scene-types lay out above this strip.
* **Brand corner** — `#brand-corner` (track 97) pins to `top: 96px; right: 96px`. Keep headlines and KPIs out of the top-right corner.

## Lint

```bash
bunx hyperframes lint src/episodes/<slug>     # composition lint (HTML/GSAP/track contract)
bun run lint:seek-safe                         # scan every src/episodes/*/index.html
bun run lint:seek-safe src/episodes/<slug>     # scan one episode
```

`lint:seek-safe` enforces AGENTS.md rule 7 (docs/rules.md rule 21): the timeline must be `paused: true` and registered in `window.__timelines["<id>"]`, and discrete transitions must use `tl.set(...)` — tween callbacks (`onStart` / `onComplete` / `onRepeat`) and `tl.call()` do not fire during frame-by-frame seek. It also flags `repeat: -1` (non-deterministic) and other determinism hazards.

Validate the spec before assembling, and per-scene QA after, with `bun run scene:check` and `bun run scripts/scene-qa.mjs <slug>` (see AGENTS.md).
