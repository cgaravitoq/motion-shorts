---
name: short-informative
description: >
  Use for vertical shorts that explain a concept, lesson, framework, or educational narrative with
  clear visual support, built from typed scene-types.
---

# Informative short

## Scope

Use for concept explainers, definitions, frameworks, lessons, and educational narratives.

## Scene-type preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

Call `recommend_scene_types({ intent: "informative" })`. Recommended scene-types lean on `title-cards`, `flow`, and `quote` for clear conceptual support; `hook` and `outro` are structural (always first / always last).

Typical skeleton:

```
hook -> title-cards -> flow -> quote -> outro
```

Read each chosen scene-type's slots via `get_scene_type` (or its `manifest.json`), then write `scene-spec.json`. If the explanation depends on a polished workspace/product visual, a handoff bundle, or a dense wiki-style diagram, invoke `.agents/skills/generated-raster-assets/SKILL.md` before `canonical-short`.

## Handoff

Continue to `canonical-short`; if producing end-to-end from a source URL or idea, continue inside `produce-from-source`.
