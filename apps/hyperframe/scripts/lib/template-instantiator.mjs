import fs from "node:fs";
import path from "node:path";

const supportedTemplates = new Map([
  [
    "source-driven-editorial@1",
    {
      dir: path.resolve("templates/source-driven-editorial/v1"),
    },
  ],
  [
    "social-proof-overlay@1",
    {
      dir: path.resolve("templates/social-proof-overlay/v1"),
    },
  ],
  [
    "workflow-canvas@1",
    {
      dir: path.resolve("templates/workflow-canvas/v1"),
    },
  ],
  [
    "data-benchmark@1",
    {
      dir: path.resolve("templates/data-benchmark/v1"),
    },
  ],
  [
    "brand-system-reveal@1",
    {
      dir: path.resolve("templates/brand-system-reveal/v1"),
    },
  ],
  [
    "asset-motion-showcase@1",
    {
      dir: path.resolve("templates/asset-motion-showcase/v1"),
    },
  ],
]);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const assertSafeHtml = (value, field) => {
  const text = String(value);
  const forbidden = /<(script|iframe|object|embed|link|style|meta|base)\b/i;
  if (forbidden.test(text) || /\son[a-z]+\s*=/i.test(text)) {
    throw new Error(`template data field "${field}" contains unsupported HTML`);
  }
  return text;
};

const replaceAll = (input, replacements) => {
  let output = input;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.replaceAll(token, value);
  }
  return output;
};

const mergeData = (base, override) => ({
  ...base,
  ...override,
  source: { ...base.source, ...override.source },
  hook: { ...base.hook, ...override.hook },
  proof: { ...base.proof, ...override.proof },
  support: { ...base.support, ...override.support },
  comparison: { ...base.comparison, ...override.comparison },
  payoff: { ...base.payoff, ...override.payoff },
});

function readBrandSnippet(snippetPath, replacements) {
  const raw = fs.readFileSync(snippetPath, "utf8");
  const style = raw.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? "";
  const section = raw.match(/<section\b[\s\S]*?<\/section>/)?.[0];
  const div = raw.match(/<div\b[\s\S]*?<\/div>/)?.[0];
  const body = section ?? div ?? "";
  return replaceAll(`${style}\n${body}`, replacements);
}

function renderComparisonRows(rows) {
  return rows
    .map(
      (row) => `<div class="hf-source-stat-comparison__row"><div class="hf-source-stat-comparison__bar" style="--bar-width: ${escapeHtml(row.barWidth ?? "50%")};"></div><div class="hf-source-stat-comparison__content"><span class="hf-source-stat-comparison__label">${escapeHtml(row.label)}</span><span class="hf-source-stat-comparison__value">${escapeHtml(row.value)}</span></div></div>`,
    )
    .join("\n            ");
}

export function listEpisodeTemplates() {
  return [...supportedTemplates.keys()];
}

export function instantiateEpisodeTemplate({
  templateId,
  slug,
  width,
  height,
  dataPath,
  catalogRoot = path.resolve("../..", "packages", "catalog"),
}) {
  const template = supportedTemplates.get(templateId);
  if (!template) {
    throw new Error(
      `unsupported template "${templateId}". Supported templates: ${listEpisodeTemplates().join(", ")}`,
    );
  }

  const manifest = readJson(path.join(template.dir, "manifest.json"));
  const sampleData = readJson(path.join(template.dir, "sample-data.json"));
  const overrideData = dataPath ? readJson(path.resolve(dataPath)) : {};
  const data = mergeData(sampleData, overrideData);
  const templateHtml = fs.readFileSync(path.join(template.dir, "template.html.tmpl"), "utf8");
  const css = fs.readFileSync(path.join(template.dir, "tokens.css"), "utf8");
  const timeline = fs.readFileSync(path.join(template.dir, "timeline.js"), "utf8");

  const defaults = manifest.defaults;
  const totalDuration = defaults.totalDuration;
  const audioDuration = defaults.audioDuration;
  const source = data.source;
  const brandSnippetRoot = path.join(catalogRoot, "snippets");
  const brandWatermark = readBrandSnippet(
    path.join(brandSnippetRoot, "brand-logo-watermark.html"),
    {
      "<TOTAL>": String(totalDuration),
    },
  );
  const brandOutro = readBrandSnippet(path.join(brandSnippetRoot, "brand-logo-outro.html"), {
    "<OUTRO_START>": String(defaults.outroStart),
    "<OUTRO_DURATION>": String(defaults.outroDuration),
    "&lt;SOURCE_LABEL&gt;": escapeHtml(source.label),
  });

  const renderedCss = replaceAll(css, {
    "__WIDTH__": String(width),
    "__HEIGHT__": String(height),
    "__SOURCE_ACCENT__": source.accent,
    "__SOURCE_ACCENT_2__": source.accent2,
  });

  return replaceAll(templateHtml, {
    "__CATALOG_IDS__": manifest.catalogIds.join(", "),
    "__LANG__": escapeHtml(data.lang ?? "en"),
    "__WIDTH__": String(width),
    "__HEIGHT__": String(height),
    "__SLUG__": slug,
    "__TOTAL_DURATION__": String(totalDuration),
    "__AUDIO_DURATION__": String(audioDuration),
    "__TEMPLATE_CSS__": renderedCss
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n"),
    "__BRAND_WATERMARK__": brandWatermark
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n"),
    "__BRAND_OUTRO__": brandOutro
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n"),
    "__TIMELINE_JS__": timeline
      .replaceAll("__SLUG__", slug)
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n"),
    "__SOURCE_MARK__": escapeHtml(source.mark),
    "__SOURCE_LABEL__": escapeHtml(source.label),
    "__SOURCE_PUBLISHER__": escapeHtml(source.publisher),
    "__SOURCE_PATH__": escapeHtml(source.path),
    "__HOOK_TITLE_HTML__": assertSafeHtml(data.hook.titleHtml, "hook.titleHtml"),
    "__HOOK_SUBTITLE__": escapeHtml(data.hook.subtitle),
    "__PROOF_METRIC__": escapeHtml(data.proof.metric),
    "__PROOF_METRIC_SUFFIX__": escapeHtml(data.proof.metricSuffix),
    "__PROOF_TITLE__": escapeHtml(data.proof.title),
    "__PROOF_BODY__": escapeHtml(data.proof.body),
    "__SUPPORT_NAME__": escapeHtml(data.support.name),
    "__SUPPORT_ROLE__": escapeHtml(data.support.role),
    "__SUPPORT_CLAIM__": escapeHtml(data.support.claim),
    "__COMPARISON_ROWS__": renderComparisonRows(data.comparison.rows ?? []),
    "__PAYOFF_TITLE__": escapeHtml(data.payoff.title),
    "__PAYOFF_BEFORE__": escapeHtml(data.payoff.before),
    "__PAYOFF_AFTER__": escapeHtml(data.payoff.after),
  });
}
