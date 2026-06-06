/**
 * scene-instantiator — turns a scene-type + params into a frozen HTML fragment.
 *
 * A scene-type lives at templates/scenes/<type>/v<version>/ with:
 *   manifest.json   typed slot declarations (text | richText | repeat)
 *   fragment.html   inner DOM with __SLOT__ tokens and <!-- repeat:NAME --> blocks
 *   styles.css      class-based styles (shared across instances of this type)
 *   styles.desktop.css  optional 16:9 overrides, emitted only by desktop builds
 *   timeline.js     build_<builder>(tl, t, s, p) entrance choreography
 *
 * Token rules (deterministic, so identical params => identical bytes):
 *   text/richText slot "metricSuffix"  ->  __METRIC_SUFFIX__
 *   repeat slot "cards" count           ->  __CARDS_COUNT__
 *   repeat item field "title"           ->  __ITEM_TITLE__   (inside the block)
 */
import fs from "node:fs";
import path from "node:path";
import {
  decodeSceneTypeManifest,
  formatParseError,
  ManifestInvalid,
  type RepeatSlotDef,
  type SceneTypeManifest,
} from "@cgaravitoq/spec";
import { Result } from "effect";

// hubRoot is the apps/hyperframe dir. Defaults to cwd (CLI runs from there);
// the MCP server passes an absolute path so it works from any cwd.
const scenesRoot = (hubRoot?: string): string =>
  path.resolve(hubRoot ?? process.cwd(), "templates/scenes");

export const escapeHtml = (value: unknown): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const FORBIDDEN_TAG = /<(script|iframe|object|embed|link|style|meta|base)\b/i;
const FORBIDDEN_ATTR = /\son[a-z]+\s*=/i;

export function assertSafeHtml(value: unknown, field: string): string {
  const text = String(value);
  if (FORBIDDEN_TAG.test(text) || FORBIDDEN_ATTR.test(text)) {
    throw new Error(
      `slot "${field}": rich-text contains unsupported HTML (no <script>/<style>/<iframe>/... tags or on*= handlers)`,
    );
  }
  return text;
}

// Image slots bind a path relative to the episode dir (e.g. assets/generated/x.png).
export function assertSafeImagePath(value: unknown, field: string): string {
  const text = String(value);
  if (text === "") return text;
  if (text.startsWith("/") || text.includes("..") || text.includes("://")) {
    throw new Error(
      `slot "${field}": image must be a relative path inside the episode dir (got "${text}")`,
    );
  }
  return text;
}

const tokenize = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();

export interface ResolvedSceneType {
  dir: string;
  manifest: SceneTypeManifest;
  fragment: string;
  styles: string;
  stylesDesktop: string | null;
  timeline: string;
}

function readValidatedManifest(file: string, type: string, version: number): SceneTypeManifest {
  const manifest: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  const decoded = decodeSceneTypeManifest(manifest);
  if (Result.isFailure(decoded)) {
    throw new ManifestInvalid({ type, version, issues: formatParseError(decoded.failure, "manifest") });
  }
  // keep the raw parse: the schema pass is validation-only, so instantiation bytes cannot change
  return manifest as SceneTypeManifest;
}

export function resolveSceneType(type: string, version = 1, hubRoot?: string): ResolvedSceneType {
  const dir = path.join(scenesRoot(hubRoot), type, `v${version}`);
  if (!fs.existsSync(dir)) {
    throw new Error(`unknown scene-type "${type}@${version}" (looked in ${path.relative(process.cwd(), dir)})`);
  }
  const desktopCssPath = path.join(dir, "styles.desktop.css");
  return {
    dir,
    manifest: readValidatedManifest(path.join(dir, "manifest.json"), type, version),
    fragment: fs.readFileSync(path.join(dir, "fragment.html"), "utf8"),
    styles: fs.readFileSync(path.join(dir, "styles.css"), "utf8"),
    stylesDesktop: fs.existsSync(desktopCssPath) ? fs.readFileSync(desktopCssPath, "utf8") : null,
    timeline: fs.readFileSync(path.join(dir, "timeline.js"), "utf8"),
  };
}

export interface SceneTypeListing {
  type: string;
  version: number;
  manifest: SceneTypeManifest;
}

export function listSceneTypes(hubRoot?: string): SceneTypeListing[] {
  const root = scenesRoot(hubRoot);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const typeDir = path.join(root, d.name);
      return fs
        .readdirSync(typeDir, { withFileTypes: true })
        .filter((v) => v.isDirectory() && /^v\d+$/.test(v.name))
        .map((v) => {
          const version = Number(v.name.slice(1));
          const manifest = readValidatedManifest(
            path.join(typeDir, v.name, "manifest.json"),
            d.name,
            version,
          );
          return { type: d.name, version, manifest };
        });
    });
}

function renderRepeat(
  fragment: string,
  slotName: string,
  slotDef: RepeatSlotDef,
  items: ReadonlyArray<unknown>,
): string {
  const re = new RegExp(`<!--\\s*repeat:${slotName}\\s*-->([\\s\\S]*?)<!--\\s*/repeat:${slotName}\\s*-->`);
  const match = fragment.match(re);
  if (!match) {
    throw new Error(
      `scene fragment is missing a repeat block for slot "${slotName}" (expected <!-- repeat:${slotName} --> ... <!-- /repeat:${slotName} -->)`,
    );
  }
  const rowTemplate = match[1] ?? "";
  const itemDef = slotDef.item ?? {};
  const rows = items.map((item, idx) => {
    let row = rowTemplate;
    const record = item as Record<string, unknown>;
    for (const [field, def] of Object.entries(itemDef)) {
      let raw = record[field];
      if (raw === undefined || raw === null) {
        if (def.required) throw new Error(`slot "${slotName}"[${idx}] missing required field "${field}"`);
        raw = def.default ?? "";
      }
      const value = def.kind === "richText" ? assertSafeHtml(raw, `${slotName}[${idx}].${field}`) : escapeHtml(raw);
      row = row.replaceAll(`__ITEM_${tokenize(field)}__`, value);
    }
    return row.trim();
  });
  return fragment.replace(re, rows.join("\n      "));
}

export interface InstantiatedScene {
  html: string;
  css: string;
  cssDesktop: string | null;
  timeline: string;
  manifest: SceneTypeManifest;
}

export function instantiateScene(args: {
  type: string;
  version?: number;
  params?: Record<string, unknown>;
  hubRoot?: string;
}): InstantiatedScene {
  const { type, version = 1, params = {}, hubRoot } = args;
  const resolved = resolveSceneType(type, version, hubRoot);
  const { manifest } = resolved;
  let html = resolved.fragment;
  for (const [name, def] of Object.entries(manifest.slots)) {
    if (def.kind === "repeat") {
      const items = params[name];
      if (!Array.isArray(items)) {
        throw new Error(`scene-type "${type}" slot "${name}" expects an array, got ${typeof items}`);
      }
      if (items.length < def.min || items.length > def.max) {
        throw new Error(
          `scene-type "${type}" slot "${name}" expects ${def.min}-${def.max} items, got ${items.length}. Tell the user this count is out of range.`,
        );
      }
      html = renderRepeat(html, name, def, items);
      html = html.replaceAll(`__${tokenize(name)}_COUNT__`, String(items.length));
    } else {
      let raw = params[name];
      if (raw === undefined || raw === null) {
        if (def.required) throw new Error(`scene-type "${type}" missing required slot "${name}"`);
        raw = def.default ?? "";
      }
      const value =
        def.kind === "richText"
          ? assertSafeHtml(raw, name)
          : def.kind === "image"
            ? escapeHtml(assertSafeImagePath(raw, name))
            : escapeHtml(raw);
      html = html.replaceAll(`__${tokenize(name)}__`, value);
    }
  }
  return { html, css: resolved.styles, cssDesktop: resolved.stylesDesktop, timeline: resolved.timeline, manifest };
}
