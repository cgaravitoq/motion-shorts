# Scene preflight reference

> Filename kept for stable cross-links. This is the **scene-type preflight** for the scene-hub flow. There is no catalog: a short is a typed `scene-spec.json` that a deterministic assembler turns into the monolithic `index.html`. You fill slots; you never hand-author HTML/CSS/GSAP.

Run this before entering a short-production skill:

1. Classify the short into one intent (`informative` | `data` | `workflow` | `social` | `brand` | `vfx`).
2. Get the recommended scene-types and a starter spine for that intent:
   - List every scene-type with `bun run scene:gallery` (CWD `apps/hyperframe`) and browse `templates/scenes/`, keeping the structural scene-types pinned (`hook` first, `outro` last) and picking the types that fit the intent.
3. Pick a scene skeleton from the returned `skeleton`, adapting counts/types to the script's beats. **`hook` is always first; `outro` is always last** (the pinned brand sign-off — never a plain `@handle` card). The 17 scene-types are the only building blocks: `hook, title-cards, flow, fanout, metric, bars, big-stat, comparison, timeline, quote, code, social-card, progress-ring, line-chart, contrib-heatmap, decision-tree, outro`.
4. Learn each chosen scene-type's exact slots by reading its `apps/hyperframe/templates/scenes/<type>/v1/manifest.json`. Respect repeatable-slot ranges (e.g. `title-cards.cards` 2-6, `flow.steps` 2-6, `metric.stats` 1-4, `comparison.left/rightPoints` 1-5, `timeline.events` 3-6, `code.lines` 1-12).
5. Write `apps/hyperframe/src/episodes/<slug>/scene-spec.json` filling only the slot parameters (the assembler owns background, brand-corner, timeline, crossfades, track allocation, captions/audio). `code` and `social-card` are already self-framed — do not wrap them in an extra glass/card frame.
6. Validate the spec, then assemble: `bun run scene:check <slug>` then `bun run assemble <slug>` (or scaffold from scratch with `bun run new:episode <slug> --intent=<intent>`).
7. Continue into `canonical-short`, `produce-from-source`, or `audio-pipeline` only after the spec validates.
