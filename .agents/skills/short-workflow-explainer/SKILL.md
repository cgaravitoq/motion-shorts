---
name: short-workflow-explainer
description: >
  Use for vertical shorts that explain workflows, pipelines, automations, decisions, or agent flows,
  built from typed scene-types.
---

# Workflow explainer short

## Scope

Use for processes, agent flows, decision trees, automations, pipelines, and step-by-step systems.

## Scene-type preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

Call `recommend_scene_types({ intent: "workflow" })`. Recommended scene-types lean on `flow`, `code`, and `timeline` for step-by-step systems; `hook` and `outro` are structural (always first / always last).

Typical skeleton:

```
hook -> flow -> code -> timeline -> outro
```

Respect repeatable-slot ranges (`flow.steps` 2-6, `timeline.events` 3-6, `code.lines` 1-12). The `code` scene-type is already self-framed — do not wrap it in an extra card. Read each chosen scene-type's slots via `get_scene_type` (or its `manifest.json`), then write `scene-spec.json`.

If the workflow needs product/workspace UI, a handoff bundle, or a connector-heavy diagram beyond what `flow` expresses cleanly, invoke `.agents/skills/generated-raster-assets/SKILL.md` before `canonical-short`.

## Handoff

Continue to `canonical-short`; if producing end-to-end from a source URL or idea, continue inside `produce-from-source`.
