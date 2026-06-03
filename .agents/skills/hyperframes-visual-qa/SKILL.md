---
name: hyperframes-visual-qa
description: >
  Use when a Hyperframes short must be visually verified before claiming the work is done — the
  per-scene visual gate (Gate 3) of the production pipeline. Trigger for scene redesigns,
  overlap/clipping fixes, "looks bad" feedback, caption-safe checks, weak or crowded scenes,
  semantic mismatch, or any request that mentions screenshots, key frames, visual QA, malformed
  visuals, or overflow/overlap inspection.
---

# Hyperframes Visual QA

Use this skill after any meaningful visual change to a Hyperframes episode. A passing lint is not enough: each scene must be assembled, captured as key frames, inspected for overflow/overlap, and approved per scene before the final render.

This skill drives **Gate 3** of the pipeline (per-scene visual approval), which precedes Gate 4 (final `render:episode`). It does **not** render the full MP4.

## What QA runs on

A short is a typed `scene-spec.json` at `apps/hyperframe/src/episodes/<slug>/scene-spec.json`. You edit scene **slots** there, never the generated `index.html`. The assembler turns the spec into `index.html` (1:1 deterministic). QA re-assembles for you, so the loop is always: **edit slots → scene-qa → review frames → repeat**.

## Core Loop

1. Read the episode's `scene-spec.json` and the latest QA artifacts before editing.
2. Make the smallest slot change that addresses the actual scene problem.
3. Run the static pre-flight (`scene:check`, then `assemble`, then lint).
4. Run per-scene QA — it re-assembles, captures key frames, and inspects.
5. Review the per-scene key frames against the rubric, not just their existence.
6. Iterate **only the rejected scenes** with `--scenes=<id>` until every scene passes.

Do not claim a visual fix passed unless the current turn captured and reviewed the key frames.

## Static pre-flight

Run from `apps/hyperframe/`:

```bash
bun run scene:check src/episodes/<slug>/scene-spec.json
bun run assemble <slug>
bun run lint:seek-safe src/episodes/<slug>
bunx hyperframes lint src/episodes/<slug>
```

`scene:check` validates the spec against the scene-type manifests (slot names, repeatable-slot ranges, required fields) without assembling — the fast gate. `assemble` regenerates `index.html` from the spec. `scene-qa` re-assembles too, so a clean `scene:check` is the real blocker here.

## Per-scene capture + inspect

This replaces the old `ffmpeg -ss` still extraction and contact sheets. One command:

```bash
bun run scripts/scene-qa.mjs <slug>
```

It (1) re-assembles `index.html` from `scene-spec.json`, (2) materialises a working copy under `out/episodes/<slug>` (src/ untouched, captions inlined if present), (3) runs `hyperframes snapshot` to produce one settled **final** frame per scene plus a `contact-sheet.jpg` grid of every sampled scene, and (4) runs `hyperframes inspect --json` for a mechanical overflow/overlap verdict. No MP4 is produced.

Output:

```text
apps/hyperframe/renders/<slug>-qa/<scene-id>/entry-<t>s.png
apps/hyperframe/renders/<slug>-qa/<scene-id>/mid-<t>s.png
apps/hyperframe/renders/<slug>-qa/<scene-id>/late-<t>s.png
apps/hyperframe/renders/<slug>-qa/report.json
```

`report.json` carries the verdict and per-scene index: `inspectOk` (boolean), `inspectIssues` (count), and for each scene its `type`, `track`, time `window`, and `frames` paths. If `inspectOk` is false, the run prints the issue list.

Read the frames directly (they are PNGs in the per-scene folders) and read `report.json` for the inspect verdict.

### Iterating only rejected scenes

After the user rejects specific scenes, edit those scenes' slots in `scene-spec.json` and re-QA just those ids:

```bash
bun run scripts/scene-qa.mjs <slug> --scenes=hook,pieces
```

Default is one settled final frame per scene; add `--frames=3` only when you need entry/mid/late key frames to debug motion.

## Acceptance

A scene passes only when **both** gates clear:

1. **Mechanical (blocking):** `inspect` reports `inspectOk: true` / `inspectIssues: 0` for the scene. Any overflow/overlap issue blocks — fix the slots and re-QA.
2. **Human (final):** the per-scene key frames are reviewed against the rubric below and the user approves that scene.

The episode advances to Gate 4 (final render) only when every scene is approved.

## Visual Inspection Rubric

Apply this to each scene's final frame (and to entry/mid/late when running `--frames=3`). A scene passes only if:

- visible text is readable at 1080x1920
- elements do not overlap, collide, or feel cramped
- no important content is clipped or pushed off-frame
- captions (track 99) and the brand-corner watermark (track 97) do not cover important visuals
- the scene has a clear focal point and balanced spacing
- the visual directly supports the narration at that timestamp
- the scene does not lean on random or unrelated decorative content
- **orthography is correct for Spanish** — accents and ñ render intact (á é í ó ú ñ ¿ ¡), no mojibake or dropped diacritics in titles, slots, or captions
- transitions are seek-safe (state materialises at any seek position; nothing depends on playback-only callbacks)

If one frame fails, fix that scene's slots and repeat the `--scenes=<id>` QA cycle.

## Hyperframes Constraints

The episode contract is owned by the assembler — keep edits inside `scene-spec.json` slots so it stays intact:

- monolithic generated `index.html` (never hand-edit it), inline CSS/HTML/JS, no `data-composition-src`
- single `paused: true` GSAP timeline registered as `window.__timelines["<slug>"]`
- deterministic, seconds-based timing
- no `Math.random`, `Date.now`, `repeat: -1`, async timeline construction, or seek-unsafe `tl.call()` / `onStart` / `onComplete` for visual state
- track allocation: scenes on 4,5,6,8,9..; `outro` on 7; brand-corner 97; audio 98; captions 99
- brand sign-off is the pinned `outro` scene-type plus the shell's brand-corner — never a plain @handle card
- self-framed scene-types (`code`, `social-card`) already provide their own container; do not double-frame them

Do not change narration, captions, audio, or unrelated scenes unless the user explicitly asks or the timing makes the requested visual impossible.

## Reporting

Final response should include:

- the `contact-sheet.jpg` shown **in the chat** (CLI session: deliver the file into the conversation; MCP client: `scene_qa` already returns it as an inline image) — the user reviews from the chat, never by opening folders
- what visual problem was fixed (which scenes / slots)
- the per-scene QA path (`renders/<slug>-qa/`) and the key frames reviewed
- the `inspect` verdict (`inspectOk` / `inspectIssues`) from `report.json`
- which scenes are approved vs. still pending the user's per-scene call
- any unrelated dirty worktree files left untouched

Do not commit, push, or delete generated assets unless the user explicitly asks in the current turn.
