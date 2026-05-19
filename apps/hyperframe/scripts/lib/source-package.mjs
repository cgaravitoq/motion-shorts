import path from "node:path";

export const SOURCE_PACKAGE_FILENAME = "source.json";
export const SOURCE_ASSET_KINDS = ["image", "font", "screenshot", "svg", "logo", "video", "other"];
export const SOURCE_ASSET_ROLES = [
  "hero",
  "proof",
  "brand",
  "background",
  "texture",
  "ui",
  "reference",
];
export const SOURCE_ASSET_MOTION = [
  "ken-burns",
  "spotlight",
  "reveal",
  "pan",
  "path-draw",
  "parallax",
  "turntable",
  "static",
];
export const PUBLISHABILITY_STATUSES = ["ok", "review-required", "blocked"];
export const AGENT_INSTRUCTION_DENYLIST = new Set([
  "agent",
  "agents",
  "claude",
  "cursor",
  "cursorrules",
  "instructions",
  "opencode",
  "prompt",
  "prompts",
  "system",
  "system-prompt",
  "system_prompt",
  "windsurf",
  "windsurfrules",
]);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const AUTH_REQUIRED_HOSTS = new Set(["accounts.google.com", "login.microsoftonline.com"]);
const AUTH_REQUIRED_PATH_RE = /(^|\/)(login|signin|sign-in|auth|oauth|sso)(\/|$)/i;

export const sourceAssetsDirForSlug = (slug) => path.join("src/episodes", slug, "assets");

export const sourcePackagePathForSlug = (slug) =>
  path.join(sourceAssetsDirForSlug(slug), SOURCE_PACKAGE_FILENAME);

export const validateEpisodeSlug = (slug) => ({
  ok: SLUG_RE.test(slug),
  errors: SLUG_RE.test(slug)
    ? []
    : [`slug must be lowercase kebab-case ([a-z0-9-]+), got "${slug}"`],
});

export const validateCaptureUrl = (rawUrl) => {
  const errors = [];
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, errors: [`source URL must be a valid URL, got "${rawUrl}"`] };
  }

  if (parsed.protocol !== "https:") {
    errors.push(`source URL must use https:, got "${parsed.protocol}"`);
  }
  if (AUTH_REQUIRED_HOSTS.has(parsed.hostname) || AUTH_REQUIRED_PATH_RE.test(parsed.pathname)) {
    errors.push(`source URL appears to require authentication: ${rawUrl}`);
  }

  return { ok: errors.length === 0, errors };
};

const normalizedQuarantineStem = (filename) =>
  filename
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\.(md|txt)$/i, "");

export const isQuarantineCandidate = (filename) =>
  AGENT_INSTRUCTION_DENYLIST.has(normalizedQuarantineStem(filename));

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const requireString = (obj, field, errors) => {
  if (typeof obj[field] !== "string" || obj[field].length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
};

const requireStringArray = (obj, field, errors) => {
  if (!Array.isArray(obj[field]) || obj[field].some((item) => typeof item !== "string")) {
    errors.push(`${field} must be an array of strings`);
  }
};

export const validateSourcePackage = (obj) => {
  const errors = [];
  if (!isRecord(obj)) {
    return { ok: false, errors: ["source package must be an object"] };
  }

  for (const field of ["sourceUrl", "capturedAt", "title", "summary", "publisher", "subject"]) {
    requireString(obj, field, errors);
  }

  if (typeof obj.capturedAt === "string" && Number.isNaN(Date.parse(obj.capturedAt))) {
    errors.push("capturedAt must be an ISO timestamp");
  }

  requireStringArray(obj, "keyPoints", errors);

  if (!isRecord(obj.brandSystem)) {
    errors.push("brandSystem must be an object");
  } else {
    if (!Array.isArray(obj.brandSystem.dominantColors)) {
      errors.push("brandSystem.dominantColors must be an array");
    }
    if (!Array.isArray(obj.brandSystem.fonts)) {
      errors.push("brandSystem.fonts must be an array");
    }
    if (obj.brandSystem.logoPath !== undefined && typeof obj.brandSystem.logoPath !== "string") {
      errors.push("brandSystem.logoPath must be a string when present");
    }
  }

  if (!Array.isArray(obj.assets)) {
    errors.push("assets must be an array");
  } else {
    obj.assets.forEach((asset, index) => {
      if (!isRecord(asset)) {
        errors.push(`assets[${index}] must be an object`);
        return;
      }
      if (!SOURCE_ASSET_KINDS.includes(asset.kind)) {
        errors.push(`assets[${index}].kind must be one of ${SOURCE_ASSET_KINDS.join(", ")}`);
      }
      for (const field of ["localPath", "sourceUrl"]) {
        if (typeof asset[field] !== "string" || asset[field].length === 0) {
          errors.push(`assets[${index}].${field} must be a non-empty string`);
        }
      }
      if (asset.bytes !== undefined && (!Number.isInteger(asset.bytes) || asset.bytes < 0)) {
        errors.push(`assets[${index}].bytes must be a non-negative integer when present`);
      }
      if (asset.role !== undefined && !SOURCE_ASSET_ROLES.includes(asset.role)) {
        errors.push(`assets[${index}].role must be one of ${SOURCE_ASSET_ROLES.join(", ")} when present`);
      }
      if (asset.motion !== undefined && !SOURCE_ASSET_MOTION.includes(asset.motion)) {
        errors.push(`assets[${index}].motion must be one of ${SOURCE_ASSET_MOTION.join(", ")} when present`);
      }
      if (asset.altText !== undefined && typeof asset.altText !== "string") {
        errors.push(`assets[${index}].altText must be a string when present`);
      }
      if (asset.licenseRisk !== undefined && !["low", "review", "blocked"].includes(asset.licenseRisk)) {
        errors.push(`assets[${index}].licenseRisk must be low, review, or blocked when present`);
      }
      if (asset.brandRisk !== undefined && !["low", "review", "blocked"].includes(asset.brandRisk)) {
        errors.push(`assets[${index}].brandRisk must be low, review, or blocked when present`);
      }
      if (asset.transparent !== undefined && typeof asset.transparent !== "boolean") {
        errors.push(`assets[${index}].transparent must be a boolean when present`);
      }
      if (asset.animatableParts !== undefined) {
        requireStringArray(asset, "animatableParts", errors);
      }
      if (asset.safeCrop !== undefined) {
        if (!isRecord(asset.safeCrop)) {
          errors.push(`assets[${index}].safeCrop must be an object when present`);
        } else {
          for (const field of ["x", "y", "width", "height"]) {
            if (typeof asset.safeCrop[field] !== "number") {
              errors.push(`assets[${index}].safeCrop.${field} must be a number when present`);
            }
          }
        }
      }
      if (asset.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(asset.sha256)) {
        errors.push(`assets[${index}].sha256 must be a lowercase sha256 hex digest when present`);
      }
      if (asset.quarantined !== undefined && typeof asset.quarantined !== "boolean") {
        errors.push(`assets[${index}].quarantined must be a boolean when present`);
      }
      if (asset.quarantined === true) {
        if (typeof asset.originalFilename !== "string" || asset.originalFilename.length === 0) {
          errors.push(
            `assets[${index}].originalFilename must be a non-empty string when quarantined`,
          );
        }
        if (
          typeof asset.localPath !== "string" ||
          !asset.localPath.startsWith("assets/captured-raw/quarantined-")
        ) {
          errors.push(
            `assets[${index}].localPath must start with assets/captured-raw/quarantined- when quarantined`,
          );
        }
      }
    });
  }

  if (!isRecord(obj.attribution)) {
    errors.push("attribution must be an object");
  } else {
    if (obj.attribution.author !== undefined && typeof obj.attribution.author !== "string") {
      errors.push("attribution.author must be a string when present");
    }
    if (obj.attribution.license !== undefined && typeof obj.attribution.license !== "string") {
      errors.push("attribution.license must be a string when present");
    }
  }

  if (!isRecord(obj.publishability)) {
    errors.push("publishability must be an object");
  } else {
    if (!PUBLISHABILITY_STATUSES.includes(obj.publishability.status)) {
      errors.push(`publishability.status must be one of ${PUBLISHABILITY_STATUSES.join(", ")}`);
    }
    if (
      !Array.isArray(obj.publishability.reasons) ||
      obj.publishability.reasons.some((reason) => typeof reason !== "string")
    ) {
      errors.push("publishability.reasons must be an array of strings");
    }
  }

  return { ok: errors.length === 0, errors };
};
