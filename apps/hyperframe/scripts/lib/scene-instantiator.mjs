/**
 * scene-instantiator — turns a scene-type + params into a frozen HTML fragment.
 *
 * A scene-type lives at templates/scenes/<type>/v<version>/ with:
 *   manifest.json   typed slot declarations (text | richText | repeat)
 *   fragment.html   inner DOM with __SLOT__ tokens and <!-- repeat:NAME --> blocks
 *   styles.css      class-based styles (shared across instances of this type)
 *   timeline.js     build_<builder>(tl, t, s, p) entrance choreography
 *
 * Token rules (deterministic, so identical params => identical bytes):
 *   text/richText slot "metricSuffix"  ->  __METRIC_SUFFIX__
 *   repeat slot "cards" count           ->  __CARDS_COUNT__
 *   repeat item field "title"           ->  __ITEM_TITLE__   (inside the block)
 */
import fs from "node:fs";
import path from "node:path";
import { decodeSceneTypeManifest, formatParseError, ManifestInvalid } from "@cgaravitoq/spec";
import { Either } from "effect";

// hubRoot is the apps/hyperframe dir. Defaults to cwd (CLI runs from there);
// the MCP server passes an absolute path so it works from any cwd.
const scenesRoot = (hubRoot) => path.resolve(hubRoot ?? process.cwd(), "templates/scenes");

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const FORBIDDEN_TAG = /<(script|iframe|object|embed|link|style|meta|base)\b/i;
const FORBIDDEN_ATTR = /\son[a-z]+\s*=/i;

export function assertSafeHtml(value, field) {
  const text = String(value);
  if (FORBIDDEN_TAG.test(text) || FORBIDDEN_ATTR.test(text)) {
    throw new Error(
      `slot "${field}": rich-text contains unsupported HTML (no <script>/<style>/<iframe>/... tags or on*= handlers)`,
    );
  }
  return text;
}

const tokenize = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();

export function resolveSceneType(type, version = 1, hubRoot) {
  const dir = path.join(scenesRoot(hubRoot), type, `v${version}`);
  if (!fs.existsSync(dir)) {
    throw new Error(`unknown scene-type "${type}@${version}" (looked in ${path.relative(process.cwd(), dir)})`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const decoded = decodeSceneTypeManifest(manifest);
  if (Either.isLeft(decoded)) {
    throw new ManifestInvalid({ type, version, issues: formatParseError(decoded.left, "manifest") });
  }
  return {
    dir,
    // keep the raw parse: the schema pass is validation-only, so instantiation bytes cannot change
    manifest,
    fragment: fs.readFileSync(path.join(dir, "fragment.html"), "utf8"),
    styles: fs.readFileSync(path.join(dir, "styles.css"), "utf8"),
    timeline: fs.readFileSync(path.join(dir, "timeline.js"), "utf8"),
  };
}

export function listSceneTypes(hubRoot) {
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
          const manifest = JSON.parse(fs.readFileSync(path.join(typeDir, v.name, "manifest.json"), "utf8"));
          return { type: d.name, version: Number(v.name.slice(1)), manifest };
        });
    });
}

function renderRepeat(fragment, slotName, slotDef, items) {
  const re = new RegExp(`<!--\\s*repeat:${slotName}\\s*-->([\\s\\S]*?)<!--\\s*/repeat:${slotName}\\s*-->`);
  const match = fragment.match(re);
  if (!match) {
    throw new Error(
      `scene fragment is missing a repeat block for slot "${slotName}" (expected <!-- repeat:${slotName} --> ... <!-- /repeat:${slotName} -->)`,
    );
  }
  const rowTemplate = match[1];
  const itemDef = slotDef.item ?? {};
  const rows = items.map((item, idx) => {
    let row = rowTemplate;
    for (const [field, def] of Object.entries(itemDef)) {
      let raw = item[field];
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

export function instantiateScene({ type, version = 1, params = {}, hubRoot }) {
  const resolved = resolveSceneType(type, version, hubRoot);
  const { manifest } = resolved;
  let html = resolved.fragment;
  for (const [name, def] of Object.entries(manifest.slots ?? {})) {
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
      const value = def.kind === "richText" ? assertSafeHtml(raw, name) : escapeHtml(raw);
      html = html.replaceAll(`__${tokenize(name)}__`, value);
    }
  }
  return { html, css: resolved.styles, timeline: resolved.timeline, manifest };
}
