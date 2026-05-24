# Captions: burn-in vs sidecars

Motion-shorts renders captions **burned in** by default — they're materialised inline in the HTML composition (the `#captions` div with `data-track-index="99"`) and baked into the rendered video. Universal player support, no metadata required, but viewers cannot toggle, translate, or restyle them.

When you also need a **sidecar** (separate `.srt` / `.vtt` files), pass `--caption-format=srt,vtt` to the audio generator:

```sh
cd apps/hyperframe
bun --env-file=../../.env run scripts/generate-audio.mjs <script.txt> \
  --lang=<en|es> \
  --out=<dir> \
  --caption-format=srt,vtt
```

The sidecars carry the same word-level timing as `captions.json` but in standard SRT and WebVTT formats, ready to upload to players that support them.

## Burn-in vs sidecar trade-off

| Aspect          | Burn-in (default)         | Sidecar (SRT/VTT)               |
| --------------- | ------------------------- | ------------------------------- |
| Player support  | Universal                 | Player must read the file       |
| Viewer toggle   | No                        | Yes                             |
| Translation     | Re-render per language    | Add a new file per language     |
| Styling         | Composition-controlled    | Player-controlled               |
| File count      | 1 video                   | 1 video + 1 file per language   |

## Player workflows

- **YouTube** — Studio → Subtitles tab. Upload `.srt` or `.vtt`. Each language is a separate track.
- **Vimeo** — Video settings → Distribution → Subtitles. Prefer `.vtt`.
- **LinkedIn** — Native player accepts `.srt`; upload when scheduling the post.
- **Web `<video>`** — `<track kind="captions" src="captions.vtt" srclang="en" default>` inside the `<video>` element.

## Example episode

`apps/hyperframe/src/episodes/demo-explainer-blocks/assets/` ships:

- `voice.mp3` — Inworld TTS (in R2 via `assets.remote.json`; `bun run hydrate:episode demo-explainer-blocks --manifest=assets` to fetch).
- `captions.json` — word-level (Hyperframes runtime burn-in).
- `captions.srt` — sidecar for YouTube / LinkedIn.
- `captions.vtt` — sidecar for Vimeo / web players.
