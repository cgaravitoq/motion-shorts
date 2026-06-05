---
name: short-vfx-experimental
description: >
  Use for vertical shorts led by experimental transitions, texture, kinetic hooks, or effects-forward
  visual systems, built from typed scene-types.
---

# VFX experimental short

## Scope

Use for experimental transitions, texture, motion studies, kinetic hooks, and effects-forward shorts.

## Scene-type preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

Call `recommend_scene_types({ intent: "vfx" })`. Recommended scene-types lean on `big-stat`, `title-cards`, and `quote` for bold kinetic beats; `hook` and `outro` are structural (always first / always last). Texture and transition motion are owned by the assembler's crossfades and each scene-type's entrance — drive impact through punchy slot copy and scene pacing.

Typical skeleton:

```
hook -> big-stat -> title-cards -> quote -> outro
```

Read each chosen scene-type's slots via `get_scene_type` (or its `manifest.json`), then write `scene-spec.json`.

## Handoff

Continue to `canonical-short`; if producing end-to-end from a source URL or idea, continue inside `produce-from-source`.
