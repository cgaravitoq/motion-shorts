---
name: short-data-visual
description: >
  Use for vertical shorts led by metrics, charts, comparisons, trends, dashboards, benchmarks, or
  quantified proof points with the mandatory catalog preflight.
---

# Data visual short

## Scope

Use for metrics, charts, comparisons, trends, benchmarks, dashboards, and quantified proof points.

## Catalog preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

- Required: `brand-logo-outro`, `brand-logo-watermark`
- First-class: `data-chart`
- Copy-paste: none
- Deprecated: none

Call `route({ intent: "data" })` and keep the chosen IDs as the first non-doctype line in `index.html`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
