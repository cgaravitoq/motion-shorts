---
name: short-router
description: >
  Use before producing a vertical short when the user describes a topic, brief, or desired visual
  style but has not selected an intent skill. Classifies the short intent, routes to the matching
  intent-specific short skill, and runs the scene-type preflight.
---

# Short router

Classify the user's short request into exactly one intent, route to the matching intent skill, then run the scene-type preflight.

## Intent classification

- `informative`: concept explainers, definitions, lessons, frameworks, or educational narratives.
- `data`: metrics, charts, comparisons, trends, benchmarks, dashboards, or proof-point driven stories.
- `workflow`: process diagrams, agent flows, decision trees, automations, pipelines, or step-by-step systems.
- `social`: posts, comments, creator overlays, follow CTAs, media cards, or platform-native UI beats.
- `brand`: brand-system showcases, logo-led pieces, identity reveals, or visual-system demonstrations.
- `vfx`: experimental transitions, texture, motion studies, kinetic hooks, or effects-forward shorts.

If multiple intents fit, pick the primary visual job of the short. Do not continue until one intent is selected.

If the requested visual direction includes product/workspace screenshots, generated app surfaces, handoff bundles, dense diagrams, or connector-heavy workflows, carry a `generated-raster-assets` note into the routed skill and invoke `.agents/skills/generated-raster-assets/SKILL.md` before `canonical-short` authoring.

## Intent -> skill

| Intent | Skill |
|--------|-------|
| `informative` | `.agents/skills/short-informative/SKILL.md` |
| `data` | `.agents/skills/short-data-visual/SKILL.md` |
| `workflow` | `.agents/skills/short-workflow-explainer/SKILL.md` |
| `social` | `.agents/skills/short-social-overlay/SKILL.md` |
| `brand` | `.agents/skills/short-brand-system/SKILL.md` |
| `vfx` | `.agents/skills/short-vfx-experimental/SKILL.md` |

## Scene-type preflight

There is no catalog. A short is a typed `scene-spec.json` assembled deterministically into the monolithic `index.html`. Get recommended scene-types and a starter spine for the chosen intent with `recommend_scene_types({ intent })` (or `bun run scene:gallery` from `apps/hyperframe`).

## Handoff

Invoke the routed intent skill and require it to complete `.agents/skills/references/catalog-preflight.md` (the scene-type preflight) before `canonical-short`, `produce-from-source`, or `audio-pipeline` begins.
