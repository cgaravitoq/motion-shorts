---
name: short-informative
description: >
  Use for vertical shorts that explain a concept, lesson, framework, or educational narrative with
  clear visual support and the mandatory catalog preflight.
---

# Informative short

## Scope

Use for concept explainers, definitions, frameworks, lessons, and educational narratives.

## Catalog preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

- Required: `brand-logo-outro`, `brand-logo-watermark`
- First-class: `data-chart`, `flowchart`
- Copy-paste: `macos-notification`
- Deprecated: none

Call `route({ intent: "informative" })` and keep the chosen IDs as the first non-doctype line in `index.html`.

If the explanation depends on a polished workspace/product visual, a handoff bundle, or a dense visual wiki-style diagram, invoke `.agents/skills/generated-raster-assets/SKILL.md` after catalog preflight and before `canonical-short`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
