import { catalogManifest } from "./manifest";
import type { CatalogEntry, CatalogManifest } from "./schema";

export type CatalogIntent = "informative" | "data" | "workflow" | "social" | "brand" | "vfx";
export type CatalogPlatform = "youtube-shorts" | "tiktok" | "instagram-reels" | "linkedin";
export type CatalogDensity = "low" | "medium" | "high";
export type CatalogFormat = "portrait" | "square" | "landscape";
export type CatalogAssetKind =
  | "image"
  | "font"
  | "screenshot"
  | "svg"
  | "logo"
  | "video"
  | "other";
export type CatalogMotionRole = "hook" | "reveal" | "transition" | "ambient" | "proof" | "brand" | "cta";

export type RouteInput = {
  intent: CatalogIntent;
  tags?: string[];
  source?: string;
  platform?: CatalogPlatform;
  density?: CatalogDensity;
  format?: CatalogFormat;
  assetKinds?: CatalogAssetKind[];
  motionRoles?: CatalogMotionRole[];
};

export type RouteResult = {
  skillPath: string;
  requiredComponents: CatalogEntry[];
  recommendedComponents: CatalogEntry[];
  deprecatedAvoid: CatalogEntry[];
};

const skillPaths: Record<CatalogIntent, string> = {
  informative: ".agents/skills/short-informative",
  data: ".agents/skills/short-data-visual",
  workflow: ".agents/skills/short-workflow-explainer",
  social: ".agents/skills/short-social-overlay",
  brand: ".agents/skills/short-brand-system",
  vfx: ".agents/skills/short-vfx-experimental",
};

const statusRank: Record<CatalogEntry["status"], number> = {
  required: 0,
  "first-class": 1,
  "copy-paste": 2,
  experimental: 3,
  deprecated: 4,
};

const catalog: CatalogManifest = catalogManifest;

function overlaps<T>(left: readonly T[] | undefined, right: Set<T>): boolean {
  return left === undefined || left.length === 0 || left.some((value) => right.has(value));
}

function densityRank(value: CatalogDensity | undefined): number {
  if (value === "low") return 1;
  if (value === "medium") return 2;
  if (value === "high") return 3;
  return 0;
}

function matches(entry: CatalogEntry, input: RouteInput, tags: Set<string>): boolean {
  if (entry.intentTags.includes("source")) {
    if (!tags.has("source") && (input.source === undefined || entry.sourceDemo !== input.source)) {
      return false;
    }
  } else if (!entry.intentTags.some((tag) => tags.has(tag)) && input.source !== entry.sourceDemo) {
    return false;
  }

  if (input.platform && !entry.platformTargets?.includes(input.platform)) {
    return false;
  }
  if (input.format && !entry.formatTargets?.includes(input.format)) {
    return false;
  }
  if (input.density && densityRank(entry.density) > densityRank(input.density)) {
    return false;
  }
  if (input.assetKinds?.length && !overlaps(entry.assetKinds, new Set(input.assetKinds))) return false;
  if (input.motionRoles?.length && !overlaps(entry.motionRoles, new Set(input.motionRoles))) return false;

  return true;
}

function byStatusThenId(a: CatalogEntry, b: CatalogEntry): number {
  return statusRank[a.status] - statusRank[b.status] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function route(input: RouteInput): RouteResult {
  const { intent, tags = [] } = input;
  const routeTags = new Set<string>([intent, ...tags]);
  const requiredComponents = catalog
    .filter((entry) => entry.status === "required")
    .sort(byStatusThenId);
  const recommendedComponents = catalog
    .filter(
      (entry) =>
        entry.status !== "required" &&
        entry.status !== "deprecated" &&
        entry.status !== "experimental" &&
        matches(entry, input, routeTags),
    )
    .sort(byStatusThenId);
  const deprecatedAvoid = catalog
    .filter((entry) => entry.status === "deprecated" && matches(entry, input, routeTags))
    .sort(byStatusThenId);

  return {
    skillPath: skillPaths[intent],
    requiredComponents,
    recommendedComponents,
    deprecatedAvoid,
  };
}
