---
name: short-brand-system
description: >
  Use for vertical shorts centered on brand systems, identity, logo-led motion, or visual-system
  demonstrations with the mandatory catalog preflight.
---

# Brand system short

## Scope

Use for brand-system showcases, identity reveals, logo-led pieces, and visual-system demonstrations.

## Catalog preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

- Required: `brand-logo-outro`, `brand-logo-watermark`
- First-class: none
- Copy-paste: none
- Deprecated: `legacy-text-watermark`

Call `route({ intent: "brand" })` and keep the chosen IDs as the first non-doctype line in `index.html`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
