---
name: hyperframes-visual-qa
description: >
  Use when a Hyperframes short or scene must be visually verified with rendered screenshots,
  contact sheets, and iterative inspection before claiming the work is done. Trigger for scene
  redesigns, overlap/clipping fixes, "looks bad" feedback, caption-safe checks, final MP4 QA,
  or any request that mentions screenshots, stills, contact sheets, visual QA, malformed visuals,
  weak scenes, crowded elements, or semantic mismatch.
---

# Hyperframes Visual QA

Use this skill after any meaningful visual change to a Hyperframes episode. Code review is not enough: the output must be rendered, sampled as screenshots, inspected, and iterated until the visible frames pass.

## Core Loop

1. Read the episode file and current artifacts before editing.
2. Make the smallest visual change that addresses the actual scene problem.
3. Run static checks from `apps/hyperframe/`.
4. Render the MP4.
5. Extract representative stills from the rendered MP4.
6. Inspect the stills visually, not just their existence.
7. Iterate if any frame has overlap, clipping, dead space, weak composition, unreadable text, caption collisions, or semantic mismatch.

Do not claim a visual fix passed unless rendered screenshots were inspected in the current turn.

## Static Checks

Run from `apps/hyperframe/`:

```bash
bun run catalog:check src/episodes/<slug>/index.html
bun run lint:seek-safe src/episodes/<slug>
bunx hyperframes lint src/episodes/<slug>
```

Then render:

```bash
bun run render:episode <slug> --format=mp4
```

Verify the final file:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration,size -of json renders/<slug>.mp4
ffmpeg -v error -i renders/<slug>.mp4 -f null -
```

## Screenshot Sampling

For a full rebuild, sample each scene at entry, mid, and exit. For a scoped scene fix, sample at least three meaningful timestamps inside that scene.

Choose timestamps from the actual timeline:

- entry: after the scene content is visible, not during a blank fade
- mid: where the main visual state is present
- exit: where late evidence, captions, or final state could collide

Save evidence under:

```text
apps/hyperframe/renders/<slug>-qa/<pass-name>/frames/
apps/hyperframe/renders/<slug>-qa/<pass-name>/contact.jpg
```

Extract frames from `apps/hyperframe/`:

```bash
mkdir -p renders/<slug>-qa/<pass-name>/frames
ffmpeg -v error -ss <seconds> -i renders/<slug>.mp4 -frames:v 1 -q:v 2 renders/<slug>-qa/<pass-name>/frames/<label>.jpg
```

Create a contact sheet:

```bash
ffmpeg -v error -pattern_type glob -i 'renders/<slug>-qa/<pass-name>/frames/*.jpg' -vf scale=360:-1,tile=<cols>x<rows> -frames:v 1 renders/<slug>-qa/<pass-name>/contact.jpg
```

## Visual Inspection Rubric

Inspect the screenshots directly. A frame passes only if:

- visible text is readable at 1080x1920
- elements do not overlap, collide, or feel cramped
- no important content is clipped
- captions do not cover important visuals
- the scene has a clear focal point and balanced spacing
- the visual directly supports the narration at that timestamp
- screenshots do not rely on random or unrelated decorative assets
- transitions are seek-safe and no state depends on playback-only callbacks

If one frame fails, fix the scene and repeat the render/screenshot inspection cycle.

## Hyperframes Constraints

Keep the episode contract intact:

- monolithic `index.html` with inline CSS/HTML/JS
- `paused: true`
- registered `window.__timelines["<slug>"]`
- deterministic timeline construction
- seconds-based timing
- no `Math.random`, `Date.now`, `repeat: -1`, async timeline construction, or seek-unsafe `tl.call()` / `onStart` / `onComplete` for visual state

Do not change narration, captions, audio, or unrelated scenes unless the user explicitly asks or timing makes the requested visual impossible.

## Reporting

Final response should include:

- what visual problem was fixed
- screenshot/contact-sheet path
- render path
- checks run and whether they passed
- any unrelated dirty worktree files left untouched

Do not commit, push, or delete generated assets unless the user explicitly asks in the current turn.
