# Transparent output spike

## Status

Deferred — follow-up issue required.

## Context

the spike time-boxed a spike to render `landscape-motion` with transparency through the existing worker render path for `webm` and `mov` outputs.

## Attempt

The spike rendered a transparent-background variant of `apps/mcp/src/resources/compositions/landscape-motion.html` through `renderCompositionToFile()` with `quality: "draft"`, `fps: 30`, and formats `webm` and `mov`. Outputs were inspected with:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt,width,height -of default=noprint_wrappers=1 <output>
```

## Outcome

`mov` produced an alpha-capable pixel format:

```text
mov 0 width=1920
height=1080
pix_fmt=yuva444p12le
```

`webm` did not preserve alpha:

```text
webm 0 width=1920
height=1080
pix_fmt=yuv420p
```

## Decision

Do not ship `transparent-overlay.html` in the spike. Transparent `mov` appears possible with the current path, but `webm` does not preserve alpha through the same render path. The reusable transparent-output contract needs an explicit format/support decision before becoming a first-class template.

Blocker verbatim: `webm 0 width=1920 height=1080 pix_fmt=yuv420p`.

follow-up issue required
