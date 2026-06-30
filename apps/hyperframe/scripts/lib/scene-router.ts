import type { SceneTypeManifest } from "@cgaravitoq/spec";
import { listSceneTypes } from "./scene-instantiator";

export const INTENTS: ReadonlyArray<string> = [
  "informative",
  "data",
  "workflow",
  "social",
  "brand",
  "vfx",
];

const SKELETONS: Record<string, ReadonlyArray<string>> = {
  informative: ["hook", "flow", "big-stat", "title-cards", "outro"],
  data: ["hook", "bars", "line-chart", "big-stat", "outro"],
  workflow: ["hook", "fanout", "flow", "decision-tree", "outro"],
  social: ["hook", "social-card", "metric", "quote", "outro"],
  brand: ["hook", "big-stat", "bars", "title-cards", "outro"],
  vfx: ["hook", "big-stat", "fanout", "title-cards", "outro"],
};

function slotSummary(slots: SceneTypeManifest["slots"]): string {
  return Object.entries(slots)
    .map(([name, def]) => {
      if (def.kind === "repeat") return `${name}[${def.min}-${def.max}]`;
      return `${name}${def.required ? "*" : "?"}`;
    })
    .join(", ");
}

export interface SceneTypeSummary {
  type: string;
  version: number;
  id: string;
  label: string;
  description: string;
  defaultDuration: number;
  intentTags: ReadonlyArray<string>;
  slots: string;
}

export function listSceneTypeSummaries(hubRoot?: string): SceneTypeSummary[] {
  return listSceneTypes(hubRoot)
    .map(({ type, version, manifest }) => ({
      type,
      version,
      id: manifest.id,
      label: manifest.label,
      description: manifest.description,
      defaultDuration: manifest.defaultDuration,
      intentTags: manifest.intentTags,
      slots: slotSummary(manifest.slots),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export interface IntentRoute {
  intent: string;
  skeleton: string[];
  recommended: SceneTypeSummary[];
  structural: string[];
}

export function routeIntent(intent: string, { hubRoot }: { hubRoot?: string } = {}): IntentRoute {
  if (!INTENTS.includes(intent)) {
    throw new Error(`unknown intent "${intent}". Supported: ${INTENTS.join(", ")}`);
  }
  const all = listSceneTypeSummaries(hubRoot);
  const byType = new Map(all.map((s) => [s.type, s]));
  const matching = all.filter((s) => s.intentTags.includes(intent));
  const skeleton = (SKELETONS[intent] ?? []).filter((t) => byType.has(t));
  return {
    intent,
    skeleton,
    recommended: matching,
    structural: ["hook", "outro"].filter((t) => byType.has(t)),
  };
}
