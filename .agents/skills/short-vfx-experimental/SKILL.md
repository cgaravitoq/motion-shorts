---
name: short-vfx-experimental
description: >
  Use for vertical shorts led by experimental transitions, texture, kinetic hooks, or effects-forward
  visual systems with the mandatory catalog preflight.
---

# VFX experimental short

## Scope

Use for experimental transitions, texture, motion studies, kinetic hooks, and effects-forward shorts.

## Catalog preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

- Required: `brand-logo-outro`, `brand-logo-watermark`
- First-class: `grain-overlay`, `grid-pixelate-wipe`, `shimmer-sweep`
- Copy-paste: none
- Deprecated: `texture-mask-text`

Call `route({ intent: "vfx" })` and keep the chosen IDs as the first non-doctype line in `index.html`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
