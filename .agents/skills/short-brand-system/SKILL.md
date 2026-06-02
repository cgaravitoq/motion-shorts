---
name: short-brand-system
description: >
  Use for vertical shorts centered on brand systems, identity, logo-led motion, or visual-system
  demonstrations, built from typed scene-types.
---

# Brand system short

## Scope

Use for brand-system showcases, identity reveals, logo-led pieces, and visual-system demonstrations.

## Scene-type preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

Call `recommend_scene_types({ intent: "brand" })`. Recommended scene-types lean on `title-cards`, `big-stat`, and `quote` to frame identity and pillars; `hook` and `outro` are structural (always first / always last). The brand sign-off is the `outro` scene-type plus the shell's brand-corner watermark — never a plain `@handle` card.

Typical skeleton:

```
hook -> title-cards -> big-stat -> quote -> outro
```

Read each chosen scene-type's slots via `get_scene_type` (or its `manifest.json`), then write `scene-spec.json`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
