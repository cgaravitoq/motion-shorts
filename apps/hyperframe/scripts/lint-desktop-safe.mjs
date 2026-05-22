#!/usr/bin/env bun
/**
 * Desktop 16:9 safe-zone linter for `index.desktop.html` episode variants.
 *
 * Rationale: Hyperframes' upstream `bunx hyperframes lint` doesn't know about
 * the 16:9 desktop variant we ship alongside the canonical 9:16 short. Rather
 * than forking the upstream package, we add a local script — same pattern as
 * `lint-seek-safe.mjs`. Scope-tier-1 (this file): stage box dimension check,
 * title-safe inset for `data-critical` elements, YouTube end-screen +
 * CTA dead-zone violations.
 *
 * Scope-tier-2 follow-ups (deliberately deferred):
 *   • Action-safe (90%) enforcement
 *   • Lower-third overlay collision detection
 *   • Font-size minimums for desktop readability
 *
 * Episodes without `index.desktop.html` are vacuously green — the linter
 * skips them rather than failing.
 *
 * Stage contract (per docs/formats.md):
 *   <div class="stage" data-format="desktop-1080p"
 *        data-width="1920" data-height="1080" data-fps="30">
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
const DESKTOP_FPS = 30;

const TITLE_SAFE_INSET_X = Math.round(DESKTOP_WIDTH * 0.1); // 192
const TITLE_SAFE_INSET_Y = Math.round(DESKTOP_HEIGHT * 0.1); // 108

const ENDSCREEN_BAND_HEIGHT = 120;
const CTA_SIZE = 160;

const DESKTOP_INDEX = "index.desktop.html";

/**
 * Extract attributes from a single HTML opening tag string.
 * Returns a Map of lowercased name -> raw value (unquoted).
 */
function parseAttrs(tag) {
  const attrs = new Map();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const m of tag.matchAll(re)) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    attrs.set(name, value);
  }
  return attrs;
}

/**
 * Find the stage <div data-composition-id=...> opening tag and parse its attrs.
 * Returns { tag, attrs, offset } or null when not found.
 */
function findStageTag(html) {
  const re = /<div\b[^>]*\bdata-composition-id="[^"]+"[^>]*>/;
  const m = html.match(re);
  if (!m) return null;
  return { tag: m[0], attrs: parseAttrs(m[0]), offset: m.index };
}

function offsetToLine(html, offset) {
  return html.slice(0, offset).split("\n").length;
}

/**
 * Find every element opening tag that has data-critical="true".
 * Returns [{ tag, attrs, line, offset }].
 */
function findCriticalElements(html) {
  const out = [];
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

/**
 * Parse a CSS-ish inline-style attribute into a Map of lowercased prop -> value.
 */
function parseInlineStyle(style) {
  const out = new Map();
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

/**
 * Parse a CSS length value (px, %, calc(...)) into a pixel number relative to a
 * given axis size. Returns NaN for things we cannot evaluate statically.
 */
function lengthToPx(value, axisSize) {
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

/**
 * Best-effort bounding box for a critical element from inline style attribute.
 * Returns { left, top, right, bottom, width, height } where each value is in
 * stage pixels OR NaN when undetermined. We deliberately keep this conservative:
 * if a coordinate is undetermined, the rule that depends on it is skipped.
 */
function inlineBox(attrs) {
  const style = parseInlineStyle(attrs.get("style") || "");
  const left = lengthToPx(style.get("left"), DESKTOP_WIDTH);
  const right = lengthToPx(style.get("right"), DESKTOP_WIDTH);
  const top = lengthToPx(style.get("top"), DESKTOP_HEIGHT);
  const bottom = lengthToPx(style.get("bottom"), DESKTOP_HEIGHT);
  const width = lengthToPx(style.get("width"), DESKTOP_WIDTH);
  const height = lengthToPx(style.get("height"), DESKTOP_HEIGHT);
  return { left, top, right, bottom, width, height };
}

const RULES = {
  "stage-dimensions": {
    severity: "error",
    message:
      `desktop-1080p stage must declare data-width="${DESKTOP_WIDTH}", data-height="${DESKTOP_HEIGHT}", data-fps="${DESKTOP_FPS}", data-format="desktop-1080p".`,
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
};

function checkStage(attrs, line) {
  const violations = [];
  const need = {
    "data-width": String(DESKTOP_WIDTH),
    "data-height": String(DESKTOP_HEIGHT),
    "data-fps": String(DESKTOP_FPS),
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
  return violations;
}

function checkCriticalElement(element) {
  const { attrs, line } = element;
  const box = inlineBox(attrs);
  const violations = [];

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

/**
 * Lint a single desktop-variant HTML file. Returns an array of violations.
 */
export function lintDesktopHtml(html) {
  const violations = [];
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

  violations.sort((a, b) => a.line - b.line);
  return violations;
}

function findDesktopEpisodes(episodesDir) {
  const out = [];
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

function formatViolation(file, v) {
  const tag = v.severity === "error" ? "error" : "warning";
  return `${file}:${v.line}:${v.col}  ${tag}  ${v.ruleId}  ${v.message}`;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];
  const episodesDir = path.resolve("src/episodes");

  const targets = [];
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
