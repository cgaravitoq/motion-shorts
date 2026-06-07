#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// AGENTS.md rule 7 + docs/rules.md rule 7: Hyperframes seeks the timeline
// frame-by-frame and never plays it. Tween-level callbacks (onStart, onComplete,
// onRepeat), tl.call(), and any async-callback construction (setTimeout,
// setInterval, requestAnimationFrame) do not fire during seek. The timeline
// must be `paused: true` and registered in window.__timelines["<id>"].
//
// This linter scans inline <script> blocks inside each episode's index.html
// (rule 1: monolithic single-file) and flags violations before render time.

type Severity = "error" | "warning";

interface Rule {
  severity: Severity;
  message: string;
  pattern: RegExp;
  filter?: (match: RegExpMatchArray) => boolean;
}

interface Violation {
  ruleId: string;
  severity: Severity;
  message: string;
  line: number;
  col: number;
  snippet: string;
}

const RULES: Record<string, Rule> = {
  "seek-callback": {
    severity: "error",
    message:
      "Tween-level callback does not fire during seek (Hyperframes frame-seeks, never plays). Use tl.set(target, props, t) for discrete transitions.",
    // Match tween-config callback keys. onUpdate is seek-safe and excluded.
    pattern: /\b(onStart|onComplete|onRepeat|onReverseComplete)\s*:/g,
  },
  "tl-call": {
    severity: "error",
    message:
      "tl.call() does not fire during seek. Use tl.set(target, props, t) (zero-duration tween) for discrete transitions.",
    // .call( on a chained timeline expression. Avoid Function.prototype.call false
    // positives by anchoring to identifiers that look like timeline references.
    pattern: /\b(?:tl|timeline|master|mainTimeline)\s*\.\s*call\s*\(/g,
  },
  "repeat-infinite": {
    severity: "error",
    message:
      "repeat: -1 breaks determinism. Hyperframes renders a fixed duration; restructure the scene instead.",
    pattern: /\brepeat\s*:\s*-\s*1\b/g,
  },
  "repeat-finite": {
    severity: "warning",
    message:
      "repeat: <n> with n > 0 is seek-safe but rarely intended for shorts; double-check this is deliberate.",
    pattern: /\brepeat\s*:\s*(\d+)\b/g,
    // Filter out repeat: 0 (no-op) — only flag positive integers.
    filter: (match) => Number.parseInt(match[1] ?? "", 10) > 0,
  },
  "async-callback": {
    severity: "error",
    message:
      "Async scheduling inside timeline construction is non-deterministic and skipped during seek. Restructure the scene using tl.set/tl.to at explicit timeline positions.",
    pattern: /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/g,
  },
};

interface InlineScript {
  content: string;
  startOffset: number;
  startLine: number;
}

/**
 * Extract inline <script> blocks from HTML text.
 * Skips scripts with `src=` (external) and `type="application/json"` (captions-data).
 * Returns { content, startOffset, startLine } per block.
 */
export function extractInlineScripts(html: string): InlineScript[] {
  const blocks: InlineScript[] = [];
  const openRe = /<script\b([^>]*)>/gi;
  for (const openMatch of html.matchAll(openRe)) {
    const attrs = openMatch[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/\btype\s*=\s*["']application\/json["']/i.test(attrs)) continue;
    const contentStart = openMatch.index + openMatch[0].length;
    const closeIdx = html.indexOf("</script>", contentStart);
    if (closeIdx === -1) continue;
    const content = html.slice(contentStart, closeIdx);
    const startLine = html.slice(0, contentStart).split("\n").length;
    blocks.push({ content, startOffset: contentStart, startLine });
  }
  return blocks;
}

/**
 * Replace comment characters with spaces so regex offsets remain stable but
 * comments cannot match patterns.
 */
type StripState = "code" | "line-comment" | "block-comment" | "single" | "double" | "template";

export function stripComments(source: string): string {
  const out: string[] = [];
  let i = 0;
  const n = source.length;
  let state: StripState = "code";
  while (i < n) {
    const ch = source[i] as string;
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line-comment";
        out.push("  ");
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block-comment";
        out.push("  ");
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = "single";
        out.push(ch);
        i++;
        continue;
      }
      if (ch === '"') {
        state = "double";
        out.push(ch);
        i++;
        continue;
      }
      if (ch === "`") {
        state = "template";
        out.push(ch);
        i++;
        continue;
      }
      out.push(ch);
      i++;
      continue;
    }
    if (state === "line-comment") {
      if (ch === "\n") {
        state = "code";
        out.push("\n");
      } else {
        out.push(" ");
      }
      i++;
      continue;
    }
    if (state === "block-comment") {
      if (ch === "*" && next === "/") {
        state = "code";
        out.push("  ");
        i += 2;
        continue;
      }
      out.push(ch === "\n" ? "\n" : " ");
      i++;
      continue;
    }
    if (state === "single" || state === "double" || state === "template") {
      const quote = state === "single" ? "'" : state === "double" ? '"' : "`";
      if (ch === "\\" && i + 1 < n) {
        out.push(ch, source[i + 1] as string);
        i += 2;
        continue;
      }
      if (ch === quote) {
        state = "code";
        out.push(ch);
        i++;
        continue;
      }
      out.push(ch);
      i++;
    }
  }
  return out.join("");
}

function offsetToLineCol(source: string, offset: number): { line: number; col: number } {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const col = offset - (lastNl + 1) + 1;
  return { line, col };
}

/**
 * Scan a single inline-script block (already comment-stripped) for rule violations.
 * Returns an array of { ruleId, severity, message, line, col } relative to the file.
 */
function scanBlock(blockText: string, blockStartOffset: number, fullHtml: string): Violation[] {
  const violations: Violation[] = [];
  for (const [ruleId, rule] of Object.entries(RULES)) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const m of blockText.matchAll(re)) {
      if (rule.filter && !rule.filter(m)) continue;
      const absoluteOffset = blockStartOffset + m.index;
      const { line, col } = offsetToLineCol(fullHtml, absoluteOffset);
      violations.push({
        ruleId,
        severity: rule.severity,
        message: rule.message,
        line,
        col,
        snippet: m[0],
      });
    }
  }
  return violations;
}

const TIMELINE_CONSTRUCTOR_RE = /\bgsap\s*\.\s*timeline\s*\(\s*(\{[^}]*\}|)\s*\)/g;
const REGISTRY_RE = /\bwindow\s*\.\s*__timelines\s*\[/;

/**
 * Whole-script checks: paused:true on gsap.timeline(), and registry assignment.
 * These are episode-wide (one timeline per file) so we check on the joined
 * stripped source of all inline scripts.
 */
interface StrippedScript {
  startOffset: number;
  stripped: string;
}

interface LineMap {
  fullHtml: string;
}

function scanWholeFile(strippedScripts: StrippedScript[], lineMap: LineMap): Violation[] {
  const violations: Violation[] = [];
  const joined = strippedScripts.map((b) => b.stripped).join("\n");

  // Check every gsap.timeline(...) call has paused: true in its config object.
  const re = new RegExp(TIMELINE_CONSTRUCTOR_RE.source, TIMELINE_CONSTRUCTOR_RE.flags);
  let foundTimeline = false;
  for (const m of joined.matchAll(re)) {
    foundTimeline = true;
    const configBody = m[1] || "";
    if (!/\bpaused\s*:\s*true\b/.test(configBody)) {
      const { line, col } = mapJoinedOffset(m.index, strippedScripts, lineMap);
      violations.push({
        ruleId: "missing-paused",
        severity: "error",
        message:
          "gsap.timeline() must be constructed with `paused: true` so Hyperframes can frame-seek deterministically.",
        line,
        col,
        snippet: m[0].slice(0, 60),
      });
    }
  }

  if (foundTimeline && !REGISTRY_RE.test(joined)) {
    violations.push({
      ruleId: "missing-registry",
      severity: "error",
      message:
        'Timeline is not registered in window.__timelines["<id>"]; Hyperframes will not find it at seek time.',
      line: 1,
      col: 1,
      snippet: "<no window.__timelines[...] assignment found>",
    });
  }

  return violations;
}

function mapJoinedOffset(
  joinedOffset: number,
  strippedScripts: StrippedScript[],
  lineMap: LineMap,
): { line: number; col: number } {
  let cursor = 0;
  for (let i = 0; i < strippedScripts.length; i++) {
    const blk = strippedScripts[i] as StrippedScript;
    const length = blk.stripped.length;
    if (joinedOffset <= cursor + length) {
      const localOffset = joinedOffset - cursor;
      return offsetToLineCol(lineMap.fullHtml, blk.startOffset + localOffset);
    }
    // +1 for the "\n" we inserted between blocks during join.
    cursor += length + 1;
  }
  return { line: 1, col: 1 };
}

/**
 * Lint a single HTML file. Returns an array of violation records.
 */
export function lintHtml(html: string): Violation[] {
  const blocks = extractInlineScripts(html);
  const strippedScripts: StrippedScript[] = blocks.map((b) => ({
    startOffset: b.startOffset,
    stripped: stripComments(b.content),
  }));

  const violations: Violation[] = [];
  for (const blk of strippedScripts) {
    violations.push(...scanBlock(blk.stripped, blk.startOffset, html));
  }
  violations.push(...scanWholeFile(strippedScripts, { fullHtml: html }));

  // Sort by line, col for stable output.
  violations.sort((a, b) => a.line - b.line || a.col - b.col);
  return violations;
}

interface Target {
  slug: string;
  path: string;
}

function findEpisodes(episodesDir: string): Target[] {
  const out: Target[] = [];
  for (const name of readdirSync(episodesDir).sort()) {
    if (name.startsWith("_")) continue;
    const dir = path.join(episodesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const html = path.join(dir, "index.html");
    if (existsSync(html)) out.push({ slug: name, path: html });
    // 16:9 desktop variant — same monolithic single-file contract, must also
    // be seek-safe. Episodes without one are silently skipped.
    const desktopHtml = path.join(dir, "index.desktop.html");
    if (existsSync(desktopHtml)) out.push({ slug: `${name} (desktop)`, path: desktopHtml });
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
        `lint-seek-safe: ${episodesDir} not found. Run from apps/hyperframe/ (see AGENTS.md rule 5).`,
      );
      process.exit(2);
    }
    targets.push(...findEpisodes(episodesDir));
  } else {
    const resolved = path.resolve(target);
    if (statSync(resolved).isDirectory()) {
      const html = path.join(resolved, "index.html");
      if (!existsSync(html)) {
        console.error(`lint-seek-safe: no index.html in ${resolved}`);
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
    const violations = lintHtml(html);
    if (violations.length === 0) {
      console.log(`${t.path}: seek-safe lint passed`);
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
      `\nlint-seek-safe: ${errorCount} error(s), ${warningCount} warning(s) across ${filesWithIssues} file(s).`,
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
