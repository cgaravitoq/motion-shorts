/**
 * scene-router — intent -> recommended scene-types, plus typed summaries.
 * Replaces the old catalog route(): the source of truth is now each
 * scene-type's manifest (intentTags + slot schema). hook + outro are
 * structural and recommended for every short.
 */
import { listSceneTypes } from "./scene-instantiator.mjs";

export const INTENTS = ["informative", "data", "workflow", "social", "brand", "vfx"];

// Default scene order per intent (the visual-director may adapt counts/types,
// but this is the spine). Always hook-first, outro-last. Visual-first by
// default: the content scenes lean graphic (fanout/bars/metric/big-stat/flow/
// timeline/code) with at most one text-led beat (title-cards/quote) — the
// narration + captions carry the words, the scene carries the picture.
const SKELETONS = {
  informative: ["hook", "flow", "big-stat", "title-cards", "outro"],
  data: ["hook", "bars", "line-chart", "big-stat", "outro"],
  workflow: ["hook", "fanout", "flow", "decision-tree", "outro"],
  social: ["hook", "social-card", "metric", "quote", "outro"],
  brand: ["hook", "big-stat", "bars", "title-cards", "outro"],
  vfx: ["hook", "big-stat", "fanout", "title-cards", "outro"],
};

function slotSummary(slots = {}) {
  return Object.entries(slots)
    .map(([name, def]) => {
      if (def.kind === "repeat") return `${name}[${def.min}-${def.max}]`;
      return `${name}${def.required ? "*" : "?"}`;
    })
    .join(", ");
}

export function listSceneTypeSummaries(hubRoot) {
  return listSceneTypes(hubRoot)
    .map(({ type, version, manifest }) => ({
      type,
      version,
      id: manifest.id,
      label: manifest.label ?? type,
      description: manifest.description ?? "",
      defaultDuration: manifest.defaultDuration ?? 6,
      intentTags: manifest.intentTags ?? [],
      slots: slotSummary(manifest.slots),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export function routeIntent(intent, { hubRoot } = {}) {
  if (!INTENTS.includes(intent)) {
    throw new Error(`unknown intent "${intent}". Supported: ${INTENTS.join(", ")}`);
  }
  const all = listSceneTypeSummaries(hubRoot);
  const byType = new Map(all.map((s) => [s.type, s]));
  const matching = all.filter((s) => s.intentTags.includes(intent));
  const skeleton = (SKELETONS[intent] ?? []).filter((t) => byType.has(t));
  return {
    intent,
    skeleton, // recommended scene order for a typical short of this intent
    recommended: matching, // every scene-type tagged for this intent
    structural: ["hook", "outro"].filter((t) => byType.has(t)),
  };
}
