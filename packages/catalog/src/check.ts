import { readFileSync } from "node:fs";
import type { CatalogEntry, CatalogManifest } from "./schema";

export type CatalogCheckFailure = {
  rule: string;
  episode: string;
  fix: string;
};

export type CatalogCheckResult = {
  ok: boolean;
  failures: CatalogCheckFailure[];
};

type CatalogDeclaration = {
  ids: string[];
  disabled: string[];
  reason?: string;
};

const DECLARATION_RE =
  /^<!-- catalog: \[([^\]]*)\](?: disabled: \[([^\]]*)\] reason: "([^"]+)")? -->$/;
const DISABLED_WITHOUT_REASON_RE =
  /^<!-- catalog: \[[^\]]*\] disabled: \[[^\]]+\](?! reason: "[^"]+")/;

const splitIds = (value: string | undefined): string[] => {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
};

const failure = (episode: string, rule: string, fix: string): CatalogCheckFailure => ({
  rule,
  episode,
  fix,
});

const parseDeclaration = (
  html: string,
  episode: string,
): { declaration?: CatalogDeclaration; failures: CatalogCheckFailure[] } => {
  const lines = html.split(/\r?\n/);
  const failures: CatalogCheckFailure[] = [];

  if (!/^<!doctype html>$/i.test(lines[0] ?? "")) {
    failures.push(
      failure(
        episode,
        "catalog-comment-position",
        "Make line 1 <!doctype html> and line 2 the catalog comment.",
      ),
    );
    return { failures };
  }

  const comment = lines[1] ?? "";
  const match = comment.match(DECLARATION_RE);
  if (!match) {
    failures.push(
      failure(
        episode,
        DISABLED_WITHOUT_REASON_RE.test(comment) ? "disabled-reason" : "catalog-comment-format",
        'Add line 2 as <!-- catalog: [id, ...] --> or include disabled: [id, ...] reason: "...".',
      ),
    );
    return { failures };
  }

  return {
    declaration: {
      ids: splitIds(match[1]),
      disabled: splitIds(match[2]),
      reason: match[3],
    },
    failures,
  };
};

const hasTrack = (html: string, track: number): boolean => {
  return new RegExp(`\\bdata-track-index=["']${track}["']`).test(html);
};

const hasBrandCornerTrack = (html: string): boolean => {
  return (
    /<[^>]+id=["']brand-corner["'][^>]+data-track-index=["']97["'][^>]*>/.test(html) ||
    /<[^>]+data-track-index=["']97["'][^>]+id=["']brand-corner["'][^>]*>/.test(html)
  );
};

const classListRe = /class=["']([^"']*)["']/g;

const hasClass = (html: string, className: string): boolean => {
  for (const match of html.matchAll(classListRe)) {
    const tokens = (match[1] ?? "").split(/\s+/).filter(Boolean);
    if (tokens.includes(className)) return true;
  }
  return false;
};

const hasId = (html: string, id: string): boolean => {
  const idRe = new RegExp(`(?:^|[\\s/])id=["']${id}["']`);
  return idRe.test(html);
};

const getStartSeconds = (tag: string): number | undefined => {
  const raw = tag.match(/\bdata-start=["']([^"']+)["']/)?.[1];
  if (raw === undefined) return undefined;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
};

const hasFinalSceneBrandOutro = (html: string): boolean => {
  const outroTag = html.match(/<[^>]+id=["']scene-brand-outro["'][^>]*>/)?.[0];
  if (!outroTag) return false;
  const outroStart = getStartSeconds(outroTag);
  if (outroStart === undefined) return false;

  for (const match of html.matchAll(/<[^>]+class=["'][^"']*\bscene\b[^"']*\bclip\b[^"']*["'][^>]*>/g)) {
    const tag = match[0];
    if (tag.includes('id="scene-brand-outro"') || tag.includes("id='scene-brand-outro'")) continue;
    const start = getStartSeconds(tag);
    if (start !== undefined && start > outroStart) return false;
  }
  return true;
};

const hasFiveBrandOutroPieces = (html: string): boolean => {
  const pieces = new Set<string>();
  for (const match of html.matchAll(/\bid=["'](brand-piece-[^"']+)["'][^>]*\bclass=["'][^"']*\bbrand-outro__piece\b[^"']*["']/g)) {
    pieces.add(match[1] ?? "");
  }
  for (const match of html.matchAll(/\bclass=["'][^"']*\bbrand-outro__piece\b[^"']*["'][^>]*\bid=["'](brand-piece-[^"']+)["']/g)) {
    pieces.add(match[1] ?? "");
  }
  return [
    "brand-piece-left",
    "brand-piece-top-left",
    "brand-piece-bridge",
    "brand-piece-bottom-right",
    "brand-piece-right",
  ].every((id) => pieces.has(id));
};

const hasBrandCornerFadeBeforeOutro = (html: string): boolean =>
  /#brand-corner[\s\S]{0,160}autoAlpha\s*:\s*0/.test(html) &&
  /#scene-brand-outro[\s\S]{0,160}autoAlpha\s*:\s*1/.test(html);

const timelineCallsForTarget = (html: string, id: string): string[] => {
  const calls: string[] = [];
  const target = `#${id}`;
  for (const match of html.matchAll(/\btl\.(?:set|to|from|fromTo)\([\s\S]*?\);/g)) {
    const call = match[0] ?? "";
    if (call.includes(target)) calls.push(call);
  }
  return calls;
};

const hasProps = (call: string, props: RegExp[]): boolean => props.every((prop) => prop.test(call));

const hasOutroTextBlurScaleReveal = (html: string): boolean => {
  const sourceIds = ["brand-source", "outro-attribution"].filter((id) => hasId(html, id));
  const textIds = ["brand-name", "brand-tagline", ...sourceIds];
  const initialProps = [
    /(?:autoAlpha|opacity)\s*:\s*0/,
    /scale\s*:\s*0\.\d+/,
    /filter\s*:\s*["']blur\((?!0px\)\s*["'])[^"']+\)["']/,
  ];
  const finalProps = [
    /(?:autoAlpha|opacity)\s*:\s*1/,
    /scale\s*:\s*1/,
    /filter\s*:\s*["']blur\(0px\)["']/,
  ];

  return textIds.every((id) => {
    const calls = timelineCallsForTarget(html, id);
    return (
      calls.some((call) => hasProps(call, initialProps)) &&
      calls.some((call) => hasProps(call, finalProps))
    );
  });
};

const componentSelectors = (entry: CatalogEntry): string[] =>
  entry.validationRules
    .flatMap((rule) => {
      if (rule.startsWith("requires #"))
        return [`id=["']${rule.slice("requires #".length).split(" ")[0]}["']`];
      if (rule.startsWith("requires .")) {
        const className = rule.slice("requires .".length).split(" ")[0];
        return [`class=["'][^"']*\\b${className}\\b[^"']*["']`];
      }
      return [];
    })
    .filter(Boolean);

const componentUsesReservedTrack = (html: string, entry: CatalogEntry): boolean => {
  for (const selector of componentSelectors(entry)) {
    const elementRe = new RegExp(
      `<[^>]*(?:${selector})[^>]*data-track-index=["'](?:97|98|99)["'][^>]*>`,
    );
    const reversedElementRe = new RegExp(
      `<[^>]*data-track-index=["'](?:97|98|99)["'][^>]*(?:${selector})[^>]*>`,
    );
    if (elementRe.test(html) || reversedElementRe.test(html)) return true;
  }
  return false;
};

const evaluateValidationRule = (html: string, entry: CatalogEntry, rule: string): boolean => {
  if (rule.startsWith("requires #")) {
    const id = rule.slice("requires #".length).split(" ")[0];
    if (!id) return false;
    if (rule.includes("or scene-local equivalent")) {
      return hasId(html, id) || /social-overlay--instagram/.test(html);
    }
    return hasId(html, id);
  }
  if (rule.startsWith("requires .")) {
    const className = rule.slice("requires .".length).split(" ")[0];
    if (!className) return false;
    return hasClass(html, className);
  }
  if (rule === "requires data-track-index 97") return hasBrandCornerTrack(html);
  if (rule === "requires paused GSAP timeline")
    return /gsap\.timeline\(\{\s*paused:\s*true\s*\}\)/.test(html);
  if (rule === "requires brand mark SVG paths") return /<svg\b[\s\S]*<path\b/.test(html);
  if (rule === "requires final scene-brand-outro") return hasFinalSceneBrandOutro(html);
  if (rule === "requires five brand-outro pieces") return hasFiveBrandOutroPieces(html);
  if (rule === "requires brand-corner fade before outro")
    return hasBrandCornerFadeBeforeOutro(html);
  if (rule === "requires outro text blur scale reveal") return hasOutroTextBlurScaleReveal(html);
  if (rule === "requires seek-safe metric onUpdate") return /onUpdate\s*:/.test(html);
  if (rule === "requires tl.set for discrete labels") return /\.set\(/.test(html);
  if (rule === "requires fixed glitch offsets") return /steps\(1\)|glitch/i.test(html);
  if (rule === "requires --shimmer-pos timeline tween") return /--shimmer-pos/.test(html);
  if (rule.startsWith("forbidden ")) {
    const forbidden = rule.slice("forbidden ".length);
    if (forbidden === "repeat:-1") return !/repeat\s*:\s*-1/.test(html);
    if (forbidden === "stagger from random")
      return !/stagger[\s\S]{0,120}(random|Math\.random)/.test(html);
    if (forbidden === "data-composition-src") return !/data-composition-src/.test(html);
    if (forbidden === "tracks 97..99") return !componentUsesReservedTrack(html, entry);
    if (forbidden === "in new episodes") return false;
  }
  if (rule.startsWith("deprecated replacement ")) return true;
  if (rule === "sourceDemo empty allowed only for reference entries") return true;
  return true;
};

export function checkEpisode(htmlPath: string, manifest: CatalogManifest): CatalogCheckResult {
  const html = readFileSync(htmlPath, "utf8");
  const failures: CatalogCheckFailure[] = [];
  const byId = new Map<string, CatalogEntry>(manifest.map((entry) => [entry.id, entry]));
  const { declaration, failures: declarationFailures } = parseDeclaration(html, htmlPath);
  failures.push(...declarationFailures);

  if (!declaration) return { ok: false, failures };

  for (const id of [...declaration.ids, ...declaration.disabled]) {
    if (!byId.has(id)) {
      failures.push(
        failure(
          htmlPath,
          "catalog-id-exists",
          `Remove unknown catalog id "${id}" or add it to packages/catalog/manifest.json.`,
        ),
      );
    }
  }

  for (const id of declaration.ids) {
    const entry = byId.get(id);
    if (entry?.status === "deprecated") {
      failures.push(
        failure(
          htmlPath,
          "catalog-id-not-deprecated",
          `Replace deprecated catalog id "${id}" with a supported component.`,
        ),
      );
    }
  }

  for (const entry of manifest) {
    if (entry.status !== "required") continue;
    if (declaration.ids.includes(entry.id)) continue;
    if (declaration.disabled.includes(entry.id) && declaration.reason) continue;
    failures.push(
      failure(
        htmlPath,
        "required-component",
        `Add "${entry.id}" to catalog: [...] or disable it with disabled: [...] reason: "...".`,
      ),
    );
  }

  for (const id of declaration.ids) {
    const entry = byId.get(id);
    if (!entry) continue;
    for (const track of entry.requiredTracks) {
      if (!hasTrack(html, track)) {
        failures.push(
          failure(
            htmlPath,
            "required-track",
            `Place "${entry.id}" on data-track-index="${track}".`,
          ),
        );
      }
    }
    for (const rule of entry.validationRules) {
      if (!evaluateValidationRule(html, entry, rule)) {
        failures.push(
          failure(htmlPath, rule, `Update the episode so "${entry.id}" satisfies: ${rule}.`),
        );
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
