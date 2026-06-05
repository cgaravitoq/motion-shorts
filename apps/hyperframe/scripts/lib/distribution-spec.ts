/**
 * distribution-spec — the typed contract for per-episode publishing copy
 * (src/episodes/<slug>/distribution.json). Text fields are paste-ready:
 * hashtags live inline in the copy and the validator counts them there.
 * Hard platform limits fail; house-style ranges only warn. An `approved`
 * platform must pin the exact rendered mp4 (renderRef.sha256) so a
 * re-render resets the review.
 *
 * Shape:
 *   {
 *     slug: "kebab-case",
 *     renderRef?: { sha256, key?, runId? },
 *     platforms: {
 *       youtube?:   { status, es?: { title, description }, en?: { ... } },
 *       instagram?: { status, es?: { caption }, en?: { ... } },
 *       tiktok?:    { status, es?: { caption }, en?: { ... } },
 *       linkedin?:  { status, es?: { post }, en?: { ... } }
 *     }
 *   }
 *   status: "draft" | "approved" | "rejected" (per platform)
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const STATUSES = ["draft", "approved", "rejected"];
const LANGS = ["es", "en"];
const HASHTAG_RE = /#[^\s#]+/g;

type CopyBlock = Record<string, unknown>;
type PlatformBlock = Record<string, unknown>;

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;
const countHashtags = (s: string): number => (s.match(HASHTAG_RE) ?? []).length;
const hashtagSet = (s: string): Set<string> =>
  new Set((s.match(HASHTAG_RE) ?? []).map((h) => h.toLowerCase()));

// Verified platform hard limits (docs/research/distribution-publishing.research.json).
export const PLATFORM_LIMITS = {
  youtube: { titleChars: 100, descriptionUtf8Bytes: 5000, hashtagsMax: 15, forbidden: /[<>]/ },
  instagram: { captionChars: 2200, hashtagsMax: 30 },
  tiktok: { captionUtf16Units: 2200 },
  linkedin: { postChars: 3000 },
};

// House style (publishing-copies.md): channel platforms use 5-7 hashtags;
// LinkedIn is personal voice (humanizer profile: at most 3). Same set across ES/EN.
const HASHTAG_STYLE = {
  youtube: { min: 5, max: 7 },
  instagram: { min: 5, max: 7 },
  tiktok: { min: 5, max: 7 },
  linkedin: { min: 0, max: 3 },
};

const checkRequiredText = (
  block: CopyBlock,
  field: string,
  label: string,
  errors: string[],
): string | null => {
  const value = block[field];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label}.${field} must be a non-empty string`);
    return null;
  }
  return value;
};

const checkHashtagStyle = (
  text: string,
  label: string,
  errors: string[],
  warnings: string[],
  hardMax: number | null,
  band: { min: number; max: number },
): void => {
  const n = countHashtags(text);
  if (hardMax != null && n > hardMax)
    errors.push(`${label} has ${n} hashtags; platform max is ${hardMax}`);
  else if (n < band.min || n > band.max) {
    warnings.push(`${label} has ${n} hashtags; house style is ${band.min}-${band.max}`);
  }
};

type PlatformCheck = (block: CopyBlock, label: string, errors: string[], warnings: string[]) => void;

const PLATFORM_CHECKS: Record<string, PlatformCheck> = {
  youtube(block, label, errors, warnings) {
    const limits = PLATFORM_LIMITS.youtube;
    const title = checkRequiredText(block, "title", label, errors);
    if (title) {
      if (title.length > limits.titleChars) {
        errors.push(`${label}.title is ${title.length} chars; max is ${limits.titleChars}`);
      }
      if (limits.forbidden.test(title)) errors.push(`${label}.title must not contain < or >`);
    }
    const description = checkRequiredText(block, "description", label, errors);
    if (description) {
      const bytes = utf8Bytes(description);
      if (bytes > limits.descriptionUtf8Bytes) {
        errors.push(
          `${label}.description is ${bytes} UTF-8 bytes; max is ${limits.descriptionUtf8Bytes}`,
        );
      }
      if (limits.forbidden.test(description))
        errors.push(`${label}.description must not contain < or >`);
      checkHashtagStyle(
        description,
        `${label}.description`,
        errors,
        warnings,
        limits.hashtagsMax,
        HASHTAG_STYLE.youtube,
      );
    }
  },
  instagram(block, label, errors, warnings) {
    const limits = PLATFORM_LIMITS.instagram;
    const caption = checkRequiredText(block, "caption", label, errors);
    if (caption) {
      if (caption.length > limits.captionChars) {
        errors.push(`${label}.caption is ${caption.length} chars; max is ${limits.captionChars}`);
      }
      checkHashtagStyle(
        caption,
        `${label}.caption`,
        errors,
        warnings,
        limits.hashtagsMax,
        HASHTAG_STYLE.instagram,
      );
    }
  },
  tiktok(block, label, errors, warnings) {
    const limits = PLATFORM_LIMITS.tiktok;
    const caption = checkRequiredText(block, "caption", label, errors);
    if (caption) {
      if (caption.length > limits.captionUtf16Units) {
        errors.push(
          `${label}.caption is ${caption.length} UTF-16 units; max is ${limits.captionUtf16Units}`,
        );
      }
      checkHashtagStyle(caption, `${label}.caption`, errors, warnings, null, HASHTAG_STYLE.tiktok);
    }
  },
  linkedin(block, label, errors, warnings) {
    const limits = PLATFORM_LIMITS.linkedin;
    const post = checkRequiredText(block, "post", label, errors);
    if (post) {
      if (post.length > limits.postChars) {
        errors.push(`${label}.post is ${post.length} chars; max is ${limits.postChars}`);
      }
      checkHashtagStyle(post, `${label}.post`, errors, warnings, null, HASHTAG_STYLE.linkedin);
    }
  },
};

export const PLATFORM_NAMES = Object.keys(PLATFORM_CHECKS);

const platformText = (block: CopyBlock): string =>
  Object.values(block)
    .filter((v): v is string => typeof v === "string")
    .join("\n");

export interface DistributionValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDistribution(
  dist: unknown,
  { renderSha256 }: { renderSha256?: string } = {},
): DistributionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dist || typeof dist !== "object")
    return { ok: false, errors: ["distribution is not an object"], warnings };
  const record = dist as {
    slug?: unknown;
    renderRef?: { sha256?: unknown } | null;
    platforms?: Record<string, PlatformBlock | null | undefined>;
  };
  if (typeof record.slug !== "string" || !SLUG_RE.test(record.slug))
    errors.push(`slug must be kebab-case, got "${record.slug}"`);

  if (record.renderRef != null && typeof record.renderRef.sha256 !== "string") {
    errors.push("renderRef.sha256 must be a string when renderRef is set");
  }

  if (
    !record.platforms ||
    typeof record.platforms !== "object" ||
    Object.keys(record.platforms).length === 0
  ) {
    errors.push("platforms must be a non-empty object");
    return { ok: errors.length === 0, errors, warnings };
  }

  for (const [name, block] of Object.entries(record.platforms)) {
    const check = PLATFORM_CHECKS[name];
    if (!check) {
      errors.push(`unknown platform "${name}" (allowed: ${PLATFORM_NAMES.join(", ")})`);
      continue;
    }
    if (!block || typeof block !== "object") {
      errors.push(`platform "${name}" must be an object`);
      continue;
    }
    if (typeof block.status !== "string" || !STATUSES.includes(block.status)) {
      errors.push(
        `platform "${name}" status must be one of ${STATUSES.join("|")}, got "${block.status}"`,
      );
    }
    for (const key of Object.keys(block)) {
      if (key !== "status" && !LANGS.includes(key))
        warnings.push(`platform "${name}" has unknown key "${key}" — ignored`);
    }

    const present = LANGS.filter((l) => block[l] != null);
    if (present.length === 0) {
      errors.push(`platform "${name}" has no copy (expected at least one of: ${LANGS.join(", ")})`);
      continue;
    }
    for (const lang of LANGS.filter((l) => !present.includes(l))) {
      warnings.push(`platform "${name}" is missing "${lang}" copy (house contract is ES+EN)`);
    }
    for (const lang of present) {
      check(block[lang] as CopyBlock, `${name}.${lang}`, errors, warnings);
    }

    if (present.length === LANGS.length) {
      const sets = present.map((l) => hashtagSet(platformText(block[l] as CopyBlock)));
      const same =
        sets[0] && sets[1] && sets[0].size === sets[1].size && [...sets[0]].every((h) => sets[1]?.has(h));
      if (!same)
        warnings.push(
          `platform "${name}" uses different hashtag sets in ES and EN (house style: same set)`,
        );
    }

    if (block.status === "approved") {
      if (!record.renderRef?.sha256) {
        errors.push(
          `platform "${name}" is approved but renderRef.sha256 is missing — approve against a rendered mp4`,
        );
      } else if (renderSha256 === undefined) {
        errors.push(
          `platform "${name}" is approved but the episode has no render.remote.json mp4 to pin against`,
        );
      } else if (record.renderRef.sha256 !== renderSha256) {
        errors.push(
          `platform "${name}" is approved against a stale render (pinned ${String(record.renderRef.sha256).slice(0, 12)}…, current ${renderSha256.slice(0, 12)}…) — re-review and reset to draft`,
        );
      }
    }
  }

  if (
    typeof record.renderRef?.sha256 === "string" &&
    renderSha256 !== undefined &&
    record.renderRef.sha256 !== renderSha256 &&
    !Object.values(record.platforms).some((b) => b?.status === "approved")
  ) {
    warnings.push(
      "renderRef.sha256 no longer matches render.remote.json — refresh the pin before approving",
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
