---
name: short-router
description: >
  Use before producing a vertical short when the user describes a topic, brief, or desired visual
  style but has not selected an intent skill. Classifies the short intent and routes to the matching
  intent-specific short skill with catalog preflight requirements.
---

# Short router

Classify the user's short request into exactly one intent, call the catalog router, then hand off to the routed intent skill.

## Intent classification

- `informative`: concept explainers, definitions, lessons, frameworks, or educational narratives.
- `data`: metrics, charts, comparisons, trends, benchmarks, dashboards, or proof-point driven stories.
- `workflow`: process diagrams, agent flows, decision trees, automations, pipelines, or step-by-step systems.
- `social`: posts, comments, creator overlays, follow CTAs, media cards, or platform-native UI beats.
- `brand`: brand-system showcases, logo-led pieces, identity reveals, or visual-system demonstrations.
- `vfx`: experimental transitions, texture, motion studies, kinetic hooks, or effects-forward shorts.

If multiple intents fit, pick the primary visual job of the short. Do not continue until one intent is selected.

If the requested visual direction includes product/workspace screenshots, generated app surfaces, handoff bundles, dense diagrams, or connector-heavy workflows, carry a `generated-raster-assets` note into the routed skill and invoke `.agents/skills/generated-raster-assets/SKILL.md` before `canonical-short` scene authoring.

## Catalog route

Call `route({ intent, tags?, source? })` from `@cgaravitoq/catalog` before invoking the next skill.

```bash
bun run --filter @cgaravitoq/catalog route -- --intent <intent>
```

Use `skillPath` as the next skill. Carry `requiredComponents`, `recommendedComponents`, and `deprecatedAvoid` into that skill's catalog preflight.

## Handoff

After routing, invoke the returned skill path and require it to complete `.agents/skills/references/catalog-preflight.md` before `canonical-short`, `produce-from-notion`, or `audio-pipeline` begins.
