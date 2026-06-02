---
name: short-social-overlay
description: >
  Use for vertical shorts built around social posts, creator overlays, follow CTAs, media cards, or
  platform-native UI beats, built from typed scene-types.
---

# Social overlay short

## Scope

Use for posts, comments, creator overlays, follow CTAs, media cards, and platform-native UI beats.

## Scene-type preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

Call `recommend_scene_types({ intent: "social" })`. Recommended scene-types lean on `social-card` for platform-native post beats, plus `quote` and `metric` for reactions and proof; `hook` and `outro` are structural (always first / always last).

Typical skeleton:

```
hook -> social-card -> quote -> metric -> outro
```

The `social-card` scene-type is already self-framed (it renders the post card) — do not wrap it in an extra card. Read each chosen scene-type's slots via `get_scene_type` (or its `manifest.json`), then write `scene-spec.json`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
