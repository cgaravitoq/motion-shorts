#!/usr/bin/env bun
/**
 * Desktop 16:9 safe-zone linter for `index.desktop.html` episode variants.
 *
 * Rationale: Hyperframes' upstream `bunx hyperframes lint` doesn't know about
 * the 16:9 desktop variant we ship alongside the canonical 9:16 short. Rather
 * than forking the upstream package, we add a local script — same pattern as
 * `lint-seek-safe.ts`. Scope-tier-1 (this file): stage box dimension check,
 * title-safe inset for `data-critical` elements, YouTube end-screen +
 * CTA dead-zone violations.
 *
 * Scope-tier-2: action-safe (90%) warnings, lower-third collision warnings,
 * and desktop readability font-size errors.
 *
 * Episodes without `index.desktop.html` are vacuously green — the linter
 * skips them rather than failing.
 *
 * Stage contract (per docs/formats.md):
 *   <div class="stage" data-format="desktop-1080p"
 *        data-width="1920" data-height="1080" data-fps="30|60">
 *
 * Critical elements inside the stage MUST stay within title-safe (inner 80%):
 *   left/right inset >= 192px (1920 * 0.10)
 *   top/bottom inset >= 108px (1080 * 0.10)
 *
 * YouTube dead zones (no critical content):
 *   end-screen bar: bottom 120 px (left:0, right:0, bottom:0, height:120)
 *   CTA/info-card:  bottom-right 160×160 px
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DESKTOP_WIDTH = 1920;
const DESKTOP_HEIGHT = 1080;
const DESKTOP_FPS_VALUES = ["30", "60"];

const TITLE_SAFE_INSET_X = Math.round(DESKTOP_WIDTH * 0.1); // 192
const TITLE_SAFE_INSET_Y = Math.round(DESKTOP_HEIGHT * 0.1); // 108
const ACTION_SAFE_INSET_X = Math.round(DESKTOP_WIDTH * 0.05); // 96
const ACTION_SAFE_INSET_Y = Math.round(DESKTOP_HEIGHT * 0.05); // 54
const LOWER_THIRD_HEIGHT = Math.round(DESKTOP_HEIGHT * 0.25); // 270

const ENDSCREEN_BAND_HEIGHT = 120;
const CTA_SIZE = 160;

const DESKTOP_INDEX = "index.desktop.html";

type Severity = "error" | "warning";
type Attrs = Map<string, string>;
type Style = Map<string, string>;

interface Violation {
  ruleId: string;
  severity: Severity;
  message: string;
  line: number;
  col: number;
  suggestion?: string;
}

interface StageTag {
  tag: string;
  attrs: Attrs;
  offset: number;
}

interface CriticalElement {
  tag: string;
  attrs: Attrs;
  line: number;
  offset: number;
}

interface TrackedElement {
  tagName: string;
  tag: string;
  attrs: Attrs;
  line: number;
  offset: number;
}

interface StyleRule {
  selector: string;
  declarations: Style;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface RuleMeta {
  severity: Severity;
  message: string;
}

interface Target {
  slug: string;
  path: string;
}

/**
 * Extract attributes from a single HTML opening tag string.
 * Returns a Map of lowercased name -> raw value (unquoted).
 */
function parseAttrs(tag: string): Attrs {
  const attrs: Attrs = new Map();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const m of tag.matchAll(re)) {
    const name = (m[1] ?? "").toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    attrs.set(name, value);
  }
  return attrs;
}

/**
 * Find the stage <div data-composition-id=...> opening tag and parse its attrs.
 * Returns { tag, attrs, offset } or null when not found.
 */
function findStageTag(html: string): StageTag | null {
  const re = /<div\b[^>]*\bdata-composition-id="[^"]+"[^>]*>/;
  const m = html.match(re);
  if (!m) return null;
  return { tag: m[0], attrs: parseAttrs(m[0]), offset: m.index ?? 0 };
}

function offsetToLine(html: string, offset: number): number {
  return html.slice(0, offset).split("\n").length;
}

/**
 * Find every element opening tag that has data-critical="true".
 * Returns [{ tag, attrs, line, offset }].
 */
function findCriticalElements(html: string): CriticalElement[] {
  const out: CriticalElement[] = [];
  const re = /<[a-zA-Z][^>]*\bdata-critical=["']true["'][^>]*>/g;
  for (const m of html.matchAll(re)) {
    out.push({
      tag: m[0],
      attrs: parseAttrs(m[0]),
      line: offsetToLine(html, m.index),
      offset: m.index,
    });
  }
  return out;
}

function findTrackedElements(html: string): TrackedElement[] {
  const out: TrackedElement[] = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-track-index=["'][^"']+["'][^>]*>/g;
  for (const m of html.matchAll(re)) {
    out.push({
      tagName: (m[1] ?? "").toLowerCase(),
      tag: m[0],
      attrs: parseAttrs(m[0]),
      line: offsetToLine(html, m.index),
      offset: m.index,
    });
  }
  return out;
}

/**
 * Parse a CSS-ish inline-style attribute into a Map of lowercased prop -> value.
 */
function parseInlineStyle(style: string | undefined): Style {
  const out: Style = new Map();
  if (!style) return out;
  for (const decl of style.split(";")) {
    const [rawProp, ...rest] = decl.split(":");
    if (!rawProp) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (prop) out.set(prop, value);
  }
  return out;
}

function parseStyleRules(html: string): StyleRule[] {
  const rules: StyleRule[] = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const styleMatch of html.matchAll(styleRe)) {
    const css = (styleMatch[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
    for (const ruleMatch of css.matchAll(ruleRe)) {
      const declarations = parseInlineStyle(ruleMatch[2]);
      for (const rawSelector of (ruleMatch[1] ?? "").split(",")) {
        const selector = rawSelector.trim();
        if (selector) rules.push({ selector, declarations });
      }
    }
  }
  return rules;
}

function selectorMatchesElement(selector: string, element: TrackedElement): boolean {
  const id = element.attrs.get("id") || "";
  const classes = (element.attrs.get("class") || "").split(/\s+/).filter(Boolean);
  const simple = selector.trim().split(/\s+/).at(-1) || "";
  const tokens = simple.match(/[#.]?[a-zA-Z][\w-]*/g) || [];
  for (const token of tokens) {
    if (token.startsWith("#")) {
      if (id !== token.slice(1)) return false;
    } else if (token.startsWith(".")) {
      if (!classes.includes(token.slice(1))) return false;
    } else if (token.toLowerCase() !== element.tagName) {
      return false;
    }
  }
  return tokens.length > 0;
}

function computedStyleFor(element: TrackedElement, styleRules: StyleRule[]): Style {
  const out: Style = new Map();
  for (const rule of styleRules) {
    if (!selectorMatchesElement(rule.selector, element)) continue;
    for (const [prop, value] of rule.declarations) out.set(prop, value);
  }
  for (const [prop, value] of parseInlineStyle(element.attrs.get("style") || "")) out.set(prop, value);
  return out;
}

/**
 * Parse a CSS length value (px, %, calc(...)) into a pixel number relative to a
 * given axis size. Returns NaN for things we cannot evaluate statically.
 */
function lengthToPx(value: string | undefined | null, axisSize: number): number {
  if (value === undefined || value === null) return Number.NaN;
  const v = String(value).trim().toLowerCase();
  if (v === "" || v === "auto") return Number.NaN;
  if (v.endsWith("px")) return Number.parseFloat(v);
  if (v.endsWith("%")) {
    const pct = Number.parseFloat(v);
    return Number.isFinite(pct) ? (pct / 100) * axisSize : Number.NaN;
  }
  // Bare number — treat as px (CSS does NOT, but inline styles in our templates
  // almost always end in px; a bare number is most likely a copy-paste bug).
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function fontSizeToPx(value: string | undefined | null): number {
  if (value === undefined || value === null) return Number.NaN;
  const v = String(value).trim().toLowerCase();
  // TODO: Tier-2 intentionally evaluates px-only font sizes; rem/em/vw/vh need cascade + viewport semantics.
  if (!v.endsWith("px")) return Number.NaN;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function expandInsetShorthand(style: Style): Style {
  if (!style.has("inset")) return style;
  const out: Style = new Map(style);
  const tokens = String(style.get("inset")).trim().split(/\s+/).slice(0, 4);
  const [top, right = top, bottom = top, left = right] = tokens;
  const sides: Record<string, string | undefined> = { top, right, bottom, left };
  for (const [side, value] of Object.entries(sides)) {
    if (!out.has(side) && value !== undefined && value.toLowerCase() !== "auto") out.set(side, value);
  }
  return out;
}

function cssBox(style: Style): Box {
  const expandedStyle = expandInsetShorthand(style);
  const left = lengthToPx(expandedStyle.get("left"), DESKTOP_WIDTH);
  const right = lengthToPx(expandedStyle.get("right"), DESKTOP_WIDTH);
  const top = lengthToPx(expandedStyle.get("top"), DESKTOP_HEIGHT);
  const bottom = lengthToPx(expandedStyle.get("bottom"), DESKTOP_HEIGHT);
  const width = lengthToPx(expandedStyle.get("width"), DESKTOP_WIDTH);
  const height = lengthToPx(expandedStyle.get("height"), DESKTOP_HEIGHT);
  return { left, top, right, bottom, width, height };
}

function translateToPx(transform: string | undefined): { x: number; y: number } {
  const out = { x: 0, y: 0 };
  if (!transform) return out;
  const match = String(transform).match(/translate(?:3d|x|y)?\(([^)]*)\)/i);
  if (!match) return out;
  const args = (match[1] ?? "").split(",").map((x) => x.trim());
  const fn = match[0].slice(0, match[0].indexOf("(")).toLowerCase();
  if (fn === "translatex") out.x = lengthToPx(args[0], DESKTOP_WIDTH);
  else if (fn === "translatey") out.y = lengthToPx(args[0], DESKTOP_HEIGHT);
  else {
    out.x = lengthToPx(args[0], DESKTOP_WIDTH);
    out.y = lengthToPx(args[1], DESKTOP_HEIGHT);
  }
  return out;
}

function classList(attrs: Attrs): string[] {
  return (attrs.get("class") || "").split(/\s+/).filter(Boolean);
}

function hasClassMatch(attrs: Attrs, re: RegExp): boolean {
  return classList(attrs).some((name) => re.test(name));
}

function isExemptLowerThird(element: TrackedElement): boolean {
  const id = element.attrs.get("id") || "";
  return id === "captions" || id === "brand-corner" || classList(element.attrs).includes("caption") || classList(element.attrs).includes("lower-third-safe");
}

function isExemptActionSafe(element: TrackedElement): boolean {
  const id = element.attrs.get("id") || "";
  const classes = classList(element.attrs);
  return (
    id === "brand-corner" ||
    classes.some((name) => /^(bg-mesh|bg-grid|vignette|scene)$/i.test(name))
  );
}

function isTrackedText(element: TrackedElement): boolean {
  return ["h1", "h2", "h3"].includes(element.tagName) || hasClassMatch(element.attrs, /headline|title|caption|copy|text|subcopy|label/i);
}

function isHeadline(element: TrackedElement): boolean {
  return ["h1", "h2"].includes(element.tagName) || hasClassMatch(element.attrs, /headline|hero|title/i);
}

/**
 * Best-effort bounding box for a critical element from inline style attribute.
 * Returns { left, top, right, bottom, width, height } where each value is in
 * stage pixels OR NaN when undetermined. We deliberately keep this conservative:
 * if a coordinate is undetermined, the rule that depends on it is skipped.
 */
function inlineBox(attrs: Attrs): Box {
  const style = parseInlineStyle(attrs.get("style") || "");
  const left = lengthToPx(style.get("left"), DESKTOP_WIDTH);
  const right = lengthToPx(style.get("right"), DESKTOP_WIDTH);
  const top = lengthToPx(style.get("top"), DESKTOP_HEIGHT);
  const bottom = lengthToPx(style.get("bottom"), DESKTOP_HEIGHT);
  const width = lengthToPx(style.get("width"), DESKTOP_WIDTH);
  const height = lengthToPx(style.get("height"), DESKTOP_HEIGHT);
  return { left, top, right, bottom, width, height };
}

type RuleId =
  | "stage-dimensions"
  | "title-safe-inset"
  | "endscreen-dead-zone"
  | "cta-dead-zone"
  | "action-safe-inset"
  | "lower-third-collision"
  | "desktop-font-minimum";

const RULES: Record<RuleId, RuleMeta> = {
  "stage-dimensions": {
    severity: "error",
    message:
      `desktop-1080p stage must declare data-width="${DESKTOP_WIDTH}", data-height="${DESKTOP_HEIGHT}", data-fps="30" or "60", data-format="desktop-1080p".`,
  },
  "title-safe-inset": {
    severity: "error",
    message: `data-critical element violates title-safe inset (need ≥${TITLE_SAFE_INSET_X}px L/R, ≥${TITLE_SAFE_INSET_Y}px T/B).`,
  },
  "endscreen-dead-zone": {
    severity: "error",
    message: `data-critical element overlaps the YouTube end-screen bar (bottom ${ENDSCREEN_BAND_HEIGHT}px).`,
  },
  "cta-dead-zone": {
    severity: "error",
    message: `data-critical element overlaps the YouTube CTA/info-card slot (bottom-right ${CTA_SIZE}×${CTA_SIZE}px).`,
  },
  "action-safe-inset": {
    severity: "warning",
    message: `tracked stage child violates action-safe inset (need ≥${ACTION_SAFE_INSET_X}px L/R, ≥${ACTION_SAFE_INSET_Y}px T/B).`,
  },
  "lower-third-collision": {
    severity: "warning",
    message: `tracked text element sits in the bottom ${LOWER_THIRD_HEIGHT}px lower-third strip reserved for captions/overlays.`,
  },
  "desktop-font-minimum": {
    severity: "error",
    message: "desktop-1080p text is below the minimum readable font size.",
  },
};

function checkStage(attrs: Attrs, line: number): Violation[] {
  const violations: Violation[] = [];
  const need: Record<string, string> = {
    "data-width": String(DESKTOP_WIDTH),
    "data-height": String(DESKTOP_HEIGHT),
    "data-format": "desktop-1080p",
  };
  for (const [k, v] of Object.entries(need)) {
    if (attrs.get(k) !== v) {
      violations.push({
        ruleId: "stage-dimensions",
        severity: RULES["stage-dimensions"].severity,
        message: `${RULES["stage-dimensions"].message} Found ${k}="${attrs.get(k) ?? ""}", expected "${v}".`,
        line,
        col: 1,
      });
    }
  }
  const fps = attrs.get("data-fps");
  if (!DESKTOP_FPS_VALUES.includes(fps ?? "")) {
    violations.push({
      ruleId: "stage-dimensions",
      severity: RULES["stage-dimensions"].severity,
      message: `${RULES["stage-dimensions"].message} Found data-fps="${fps ?? ""}", expected one of ${DESKTOP_FPS_VALUES.join(", ")}.`,
      line,
      col: 1,
    });
  }
  return violations;
}

function checkCriticalElement(element: CriticalElement): Violation[] {
  const { attrs, line } = element;
  const box = inlineBox(attrs);
  const violations: Violation[] = [];

  // Title-safe inset: at least one explicit inset side per axis must satisfy
  // the band. If neither side is determinable we skip — author can mark
  // `data-critical` on layout containers without inline coords and the linter
  // will not produce false positives.
  const xOK =
    (Number.isFinite(box.left) && box.left >= TITLE_SAFE_INSET_X) ||
    (Number.isFinite(box.right) && box.right >= TITLE_SAFE_INSET_X);
  const xDeterminable = Number.isFinite(box.left) || Number.isFinite(box.right);
  if (xDeterminable && !xOK) {
    violations.push({
      ruleId: "title-safe-inset",
      severity: RULES["title-safe-inset"].severity,
      message: `${RULES["title-safe-inset"].message} Found left=${box.left}, right=${box.right}.`,
      line,
      col: 1,
    });
  }

  const yOK =
    (Number.isFinite(box.top) && box.top >= TITLE_SAFE_INSET_Y) ||
    (Number.isFinite(box.bottom) && box.bottom >= TITLE_SAFE_INSET_Y);
  const yDeterminable = Number.isFinite(box.top) || Number.isFinite(box.bottom);
  if (yDeterminable && !yOK) {
    violations.push({
      ruleId: "title-safe-inset",
      severity: RULES["title-safe-inset"].severity,
      message: `${RULES["title-safe-inset"].message} Found top=${box.top}, bottom=${box.bottom}.`,
      line,
      col: 1,
    });
  }

  // YouTube end-screen dead zone — bottom 120 px.
  // Element overlaps if its bottom inset is < 120 OR (height + top) > stageH - 120.
  let overlapsEndscreen = false;
  if (Number.isFinite(box.bottom) && box.bottom < ENDSCREEN_BAND_HEIGHT) {
    overlapsEndscreen = true;
  } else if (Number.isFinite(box.top) && Number.isFinite(box.height)) {
    if (box.top + box.height > DESKTOP_HEIGHT - ENDSCREEN_BAND_HEIGHT) overlapsEndscreen = true;
  }
  if (overlapsEndscreen) {
    violations.push({
      ruleId: "endscreen-dead-zone",
      severity: RULES["endscreen-dead-zone"].severity,
      message: RULES["endscreen-dead-zone"].message,
      line,
      col: 1,
    });
  }

  // YouTube CTA/info-card dead zone — bottom-right 160×160 px.
  // Element overlaps if (right < 160 AND bottom < 160) OR equivalent via
  // explicit coordinates that put any corner inside the box.
  let overlapsCta = false;
  if (Number.isFinite(box.right) && Number.isFinite(box.bottom)) {
    if (box.right < CTA_SIZE && box.bottom < CTA_SIZE) overlapsCta = true;
  }
  if (Number.isFinite(box.left) && Number.isFinite(box.width) && Number.isFinite(box.top) && Number.isFinite(box.height)) {
    const elRight = box.left + box.width;
    const elBottom = box.top + box.height;
    if (elRight > DESKTOP_WIDTH - CTA_SIZE && elBottom > DESKTOP_HEIGHT - CTA_SIZE) {
      overlapsCta = true;
    }
  }
  if (overlapsCta) {
    violations.push({
      ruleId: "cta-dead-zone",
      severity: RULES["cta-dead-zone"].severity,
      message: RULES["cta-dead-zone"].message,
      line,
      col: 1,
    });
  }

  return violations;
}

function checkTrackedElement(element: TrackedElement, styleRules: StyleRule[]): Violation[] {
  const style = computedStyleFor(element, styleRules);
  const violations: Violation[] = [];
  const id = element.attrs.get("id") || element.tagName;

  // Full-frame structural background/scene layers may intentionally touch the stage edge.
  const positioningProps = ["top", "left", "right", "bottom", "inset", "width", "height", "transform"];
  if (!isExemptActionSafe(element) && positioningProps.some((prop) => style.has(prop))) {
    const box = cssBox(style);
    const translate = translateToPx(style.get("transform"));
    const left = Number.isFinite(box.left) && Number.isFinite(translate.x) ? box.left + translate.x : Number.NaN;
    const top = Number.isFinite(box.top) && Number.isFinite(translate.y) ? box.top + translate.y : Number.NaN;
    const right = Number.isFinite(box.right) && Number.isFinite(translate.x) ? box.right - translate.x : Number.NaN;
    const bottom = Number.isFinite(box.bottom) && Number.isFinite(translate.y) ? box.bottom - translate.y : Number.NaN;
    const computedRight = Number.isFinite(left) && Number.isFinite(box.width) ? DESKTOP_WIDTH - (left + box.width) : right;
    const computedBottom = Number.isFinite(top) && Number.isFinite(box.height) ? DESKTOP_HEIGHT - (top + box.height) : bottom;
    const computedLeft = Number.isFinite(right) && Number.isFinite(box.width) ? DESKTOP_WIDTH - (right + box.width) : left;
    const computedTop = Number.isFinite(bottom) && Number.isFinite(box.height) ? DESKTOP_HEIGHT - (bottom + box.height) : top;

    if (
      (Number.isFinite(computedLeft) && computedLeft < ACTION_SAFE_INSET_X) ||
      (Number.isFinite(computedRight) && computedRight < ACTION_SAFE_INSET_X) ||
      (Number.isFinite(computedTop) && computedTop < ACTION_SAFE_INSET_Y) ||
      (Number.isFinite(computedBottom) && computedBottom < ACTION_SAFE_INSET_Y)
    ) {
      violations.push({
        ruleId: "action-safe-inset",
        severity: RULES["action-safe-inset"].severity,
        message: `${RULES["action-safe-inset"].message} Found ${id}: left=${computedLeft}, right=${computedRight}, top=${computedTop}, bottom=${computedBottom}.`,
        suggestion: `Keep tracked stage children inside the inner 90%: left/right ≥${ACTION_SAFE_INSET_X}px and top/bottom ≥${ACTION_SAFE_INSET_Y}px.`,
        line: element.line,
        col: 1,
      });
    }
  }

  if (!isExemptLowerThird(element) && isTrackedText(element)) {
    const box = cssBox(style);
    const translate = translateToPx(style.get("transform"));
    const bottom = Number.isFinite(box.bottom) && Number.isFinite(translate.y) ? box.bottom - translate.y : Number.NaN;
    const top = Number.isFinite(box.top) && Number.isFinite(translate.y) ? box.top + translate.y : Number.NaN;
    const effectiveBottom = Number.isFinite(bottom)
      ? bottom
      : Number.isFinite(top) && Number.isFinite(box.height)
        ? DESKTOP_HEIGHT - (top + box.height)
        : Number.NaN;
    if (Number.isFinite(effectiveBottom) && effectiveBottom <= LOWER_THIRD_HEIGHT) {
      violations.push({
        ruleId: "lower-third-collision",
        severity: RULES["lower-third-collision"].severity,
        message: `${RULES["lower-third-collision"].message} Found bottom=${effectiveBottom}px on ${id}.`,
        suggestion: "Move tracked text above the lower third or add class=\"lower-third-safe\" for intentional overlays.",
        line: element.line,
        col: 1,
      });
    }
  }

  if (isTrackedText(element) && !isExemptLowerThird(element)) {
    const fontSize = fontSizeToPx(style.get("font-size"));
    const min = isHeadline(element) ? 48 : 24;
    if (Number.isFinite(fontSize) && fontSize < min) {
      violations.push({
        ruleId: "desktop-font-minimum",
        severity: RULES["desktop-font-minimum"].severity,
        message: `${RULES["desktop-font-minimum"].message} Found ${fontSize}px on ${id}; minimum is ${min}px.`,
        suggestion: `Use at least ${min}px for ${isHeadline(element) ? "headline" : "body"} text at 1920×1080.`,
        line: element.line,
        col: 1,
      });
    }
  }

  return violations;
}

/**
 * Lint a single desktop-variant HTML file. Returns an array of violations.
 */
export function lintDesktopHtml(html: string): Violation[] {
  const violations: Violation[] = [];
  const stage = findStageTag(html);
  if (!stage) {
    violations.push({
      ruleId: "stage-dimensions",
      severity: "error",
      message: "desktop-1080p variant must contain a <div data-composition-id=...> stage element.",
      line: 1,
      col: 1,
    });
    return violations;
  }
  const stageLine = offsetToLine(html, stage.offset);
  violations.push(...checkStage(stage.attrs, stageLine));

  const critical = findCriticalElements(html);
  for (const el of critical) {
    violations.push(...checkCriticalElement(el));
  }

  const styleRules = parseStyleRules(html);
  const tracked = findTrackedElements(html);
  for (const el of tracked) {
    violations.push(...checkTrackedElement(el, styleRules));
  }

  violations.sort((a, b) => a.line - b.line);
  return violations;
}

function findDesktopEpisodes(episodesDir: string): Target[] {
  const out: Target[] = [];
  for (const name of readdirSync(episodesDir).sort()) {
    if (name.startsWith("_")) continue;
    const dir = path.join(episodesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const html = path.join(dir, DESKTOP_INDEX);
    if (!existsSync(html)) continue; // vacuously green — no desktop variant
    out.push({ slug: name, path: html });
  }
  return out;
}

function formatViolation(file: string, v: Violation): string {
  const tag = v.severity === "error" ? "error" : "warning";
  return `${file}:${v.line}:${v.col}  ${tag}  ${v.ruleId}  ${v.message}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = args[0];
  const episodesDir = path.resolve("src/episodes");

  const targets: Target[] = [];
  if (!target) {
    if (!existsSync(episodesDir)) {
      console.error(
        `lint-desktop-safe: ${episodesDir} not found. Run from apps/hyperframe/ (see AGENTS.md rule 5).`,
      );
      process.exit(2);
    }
    targets.push(...findDesktopEpisodes(episodesDir));
    if (targets.length === 0) {
      console.log("lint-desktop-safe: no index.desktop.html variants found — nothing to lint.");
      return;
    }
  } else {
    const resolved = path.resolve(target);
    if (statSync(resolved).isDirectory()) {
      const html = path.join(resolved, DESKTOP_INDEX);
      if (!existsSync(html)) {
        console.error(`lint-desktop-safe: no ${DESKTOP_INDEX} in ${resolved}`);
        process.exit(2);
      }
      targets.push({ slug: path.basename(resolved), path: html });
    } else {
      targets.push({ slug: path.basename(path.dirname(resolved)), path: resolved });
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  let filesWithIssues = 0;

  for (const t of targets) {
    const html = readFileSync(t.path, "utf8");
    const violations = lintDesktopHtml(html);
    if (violations.length === 0) {
      console.log(`${t.path}: desktop-safe lint passed`);
      continue;
    }
    filesWithIssues++;
    for (const v of violations) {
      console.log(formatViolation(t.path, v));
      if (v.severity === "error") errorCount++;
      else warningCount++;
    }
  }

  if (filesWithIssues > 0) {
    console.log(
      `\nlint-desktop-safe: ${errorCount} error(s), ${warningCount} warning(s) across ${filesWithIssues} file(s).`,
    );
  }

  if (errorCount > 0) process.exit(1);
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(path.basename(process.argv[1] || ""));

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
