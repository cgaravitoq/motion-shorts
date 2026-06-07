# Formats — render profiles

motion-shorts ships **two** supported render profiles, both generated from the same `scene-spec.json` by the assembler (AGENTS.md rule 1). The canonical profile is the **9:16 short**; the **16:9 desktop** variant is opt-in per invocation — assembling one format never touches the other's file.

| Profile         | Aspect | Resolution  | FPS | Codec / audio              | Target use                                                    | Source file          |
|-----------------|--------|-------------|-----|----------------------------|---------------------------------------------------------------|----------------------|
| `short`         | 9:16   | 1080 × 1920 | 30  | H.264 High + AAC-LC 48 kHz | YouTube Shorts, TikTok, Instagram Reels, LinkedIn mobile feed | `index.html`         |
| `desktop-1080p` | 16:9   | 1920 × 1080 | 30  | H.264 High + AAC-LC 48 kHz | YouTube landscape, LinkedIn native video, embeds              | `index.desktop.html` |

> `desktop-4k` re-renders `index.desktop.html` at 3840×2160 (40 Mbps). The 1:1 `square-1080` variant is declared in `render:episode` but has no assembler support yet.

## Render

Compositions are generated — assemble from `scene-spec.json` first, then render:

```bash
bun run assemble <slug>                          # regenerate index.html (9:16) from scene-spec.json
bun run render:episode <slug> --format=mp4       # final full render (9:16)
bun run render:episode <slug> --format=mp4 --keep-local

bun run assemble <slug> --format=desktop         # regenerate index.desktop.html (16:9)
bun run render:episode <slug> --variant=desktop-1080p --format=mp4   # renders/<slug>.desktop.mp4
```

Container is selected with `--format`:

```bash
bun run render:episode <slug> --format=mp4   # h264 yuv420p mp4 (default)
bun run render:episode <slug> --format=mov   # ProRes 4444 + alpha
bun run render:episode <slug> --format=webm  # VP9 + alpha
```

**Transparent output.** Verified by ffprobe on draft renders (1920×1080, 30 fps): only `mov` actually preserves alpha through the repo's render path — it produces an alpha-capable `pix_fmt=yuva444p12le`. `webm` does **not** preserve alpha here (it falls back to `pix_fmt=yuv420p`), despite the `--format=webm` "VP9 + alpha" label. Use `mov` for any transparent render.

Opt into 60 fps with `--fps=60`. The render wrapper forwards the frame rate to Hyperframes and stamps `data-fps="60"` onto the working-copy stage. The 30 fps target bitrate scales 1.5× at 60 fps.

| Variant         | 30 fps bitrate | 60 fps bitrate |
|-----------------|----------------|----------------|
| `short`         | 10 Mbps        | 15 Mbps        |
| `desktop-1080p` | 12 Mbps        | 18 Mbps        |
| `desktop-4k`    | 40 Mbps        | 60 Mbps        |

## Stage markup contract

The assembled composition declares the profile on its root stage:

```html
<!-- index.html (9:16 short) -->
<div id="ep-stage"
     data-composition-id="<slug>"
     data-width="1080" data-height="1920" data-fps="30"
     data-start="0" data-duration="<stamped>">

<!-- index.desktop.html (16:9 desktop) -->
<div id="ep-stage"
     data-composition-id="<slug>"
     data-width="1920" data-height="1080" data-fps="30"
     data-start="0" data-duration="<stamped>"
     data-format="desktop-1080p">
```

`data-format="desktop-1080p"` is the desktop discriminator: desktop-only CSS (`_shell/shell.desktop.css` + per-scene-type `styles.desktop.css`) is appended by the assembler, and scene builders branch on `document.getElementById("ep-stage")?.dataset.format === "desktop-1080p"`. The portrait file never carries the attribute or the desktop CSS, so its bytes are untouched by desktop work.

`render:episode` stamps `data-duration` from the measured voice length (+ tail) and stamps `data-fps` from `--fps`. Never hand-edit a generated composition — change `scene-spec.json` and re-run `bun run assemble [--format=desktop]`.

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

## Safe zones — 16:9 desktop

`_shell/shell.desktop.css` swaps the safe-band tokens for landscape: `--safe-top: 140px`, `--safe-bottom: 230px`, `--safe-x: 120px`, `--title-block-gap: 40px` — a ~1536 × 710 px usable band. The caption band drops the percentage geometry and is pinned in absolute px (`#captions { bottom: 60px; height: 130px }`, spanning 60–190 px from the bottom, clearing the ~90 px YouTube player control bar) with the karaoke font recomputed to 48px. `lint:desktop-safe` additionally enforces YouTube's dead zones: the bottom 120 px end-screen bar and the bottom-right 160×160 px CTA slot must stay clear of `data-critical` content, and title-safe insets are 192 px L/R, 108 px T/B.

## Lint

```bash
bunx hyperframes lint src/episodes/<slug>     # composition lint (HTML/GSAP/track contract)
bun run lint:seek-safe                         # scan every src/episodes/*/index.html
bun run lint:seek-safe src/episodes/<slug>     # scan one episode
bun run lint:desktop-safe                      # scan every src/episodes/*/index.desktop.html
bun run lint:desktop-safe src/episodes/<slug>  # scan one desktop variant
```

`lint:seek-safe` enforces AGENTS.md rule 7 (docs/rules.md rule 7): the timeline must be `paused: true` and registered in `window.__timelines["<id>"]`, and discrete transitions must use `tl.set(...)` — tween callbacks (`onStart` / `onComplete` / `onRepeat`) and `tl.call()` do not fire during frame-by-frame seek. It also flags `repeat: -1` (non-deterministic) and other determinism hazards.

Validate the spec before assembling, and per-scene QA after, with `bun run scene:check` and `bun run scripts/scene-qa.ts <slug>` (see AGENTS.md). The desktop variant gets its own per-scene pass: `bun run scripts/scene-qa.ts <slug> --format=desktop` snapshots at 1920×1080 into `renders/<slug>-desktop-qa/`.
