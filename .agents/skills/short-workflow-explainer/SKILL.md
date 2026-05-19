---
name: short-workflow-explainer
description: >
  Use for vertical shorts that explain workflows, pipelines, automations, decisions, or agent flows
  with the mandatory catalog preflight.
---

# Workflow explainer short

## Scope

Use for processes, agent flows, decision trees, automations, pipelines, and step-by-step systems.

## Catalog preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

- Required: `brand-logo-outro`, `brand-logo-watermark`
- First-class: `flowchart`
- Copy-paste: none
- Deprecated: none

Call `route({ intent: "workflow" })` and keep the chosen IDs as the first non-doctype line in `index.html`.

If the workflow needs more than four nodes, crossing connectors, product/workspace UI, or a handoff bundle, invoke `.agents/skills/generated-raster-assets/SKILL.md` after catalog preflight and before `canonical-short`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
