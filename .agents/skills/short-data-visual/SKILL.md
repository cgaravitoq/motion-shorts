---
name: short-data-visual
description: >
  Use for vertical shorts led by metrics, charts, comparisons, trends, dashboards, benchmarks, or
  quantified proof points, built from typed scene-types.
---

# Data visual short

## Scope

Use for metrics, charts, comparisons, trends, benchmarks, dashboards, and quantified proof points.

## Scene-type preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

Call `recommend_scene_types({ intent: "data" })`. Recommended scene-types lean on `big-stat`, `metric`, and `comparison` for quantified proof; `hook` and `outro` are structural (always first / always last).

Typical skeleton:

```
hook -> big-stat -> metric -> comparison -> outro
```

Respect repeatable-slot ranges (`metric.stats` 1-4, `comparison.left/rightPoints` 1-5). Read each chosen scene-type's slots via `get_scene_type` (or its `manifest.json`), then write `scene-spec.json`.

## Handoff

Continue to `canonical-short`; if producing end-to-end from a source URL or idea, continue inside `produce-from-source`.
