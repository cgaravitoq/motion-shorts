import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { z } from "zod";
import type { CatalogEntry, CatalogSafeForSchema } from "./schema";

export type CatalogSafeForFormat = z.infer<typeof CatalogSafeForSchema>;

export type CompactCatalogEntry = Pick<
  CatalogEntry,
  | "id"
  | "type"
  | "status"
  | "intentTags"
  | "sourceDemo"
  | "timingGuidance"
  | "platformTargets"
  | "density"
  | "formatTargets"
  | "assetKinds"
  | "motionRoles"
  | "previewAssetPath"
>;

export const compactCatalogEntry = (entry: CatalogEntry): CompactCatalogEntry => ({
  id: entry.id,
  type: entry.type,
  status: entry.status,
  intentTags: entry.intentTags,
  sourceDemo: entry.sourceDemo,
  timingGuidance: entry.timingGuidance,
  platformTargets: entry.platformTargets,
  density: entry.density,
  formatTargets: entry.formatTargets,
  assetKinds: entry.assetKinds,
  motionRoles: entry.motionRoles,
  previewAssetPath: entry.previewAssetPath,
});

export function filterBySafeForFormat<T extends { safeFor?: readonly string[] }>(
  components: readonly T[],
  format: CatalogSafeForFormat,
): T[] {
  return components.filter((component) => (component.safeFor ?? ["short"]).includes(format));
}

export const repoRoot = (start = process.cwd()): string => {
  let current = resolve(start);
  while (!existsSync(resolve(current, "packages/catalog/manifest.json"))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Could not locate motion-shorts repo root from ${start}`);
    }
    current = parent;
  }
  return current;
};
