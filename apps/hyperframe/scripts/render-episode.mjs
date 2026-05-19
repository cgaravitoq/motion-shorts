#!/usr/bin/env bun
/**
 * Render a Hyperframes episode without mutating `src/`.
 *
 * Strategy: build a self-contained working copy under `out/episodes/<slug>/`
 * (HTML stamped with the real duration + captions inlined from
 * assets/captions.json), symlink `lib` and `assets` to the originals, and
 * point `bunx hyperframes render` at that copy. `src/episodes/<slug>/` stays
 * read-only — no more git-dirty surprises after a render.
 *
 *   bun run scripts/render-episode.mjs <slug> [--format=mp4|mov|webm]
 *                                              [--quality=draft|standard|high]
 *                                              [--output=<path>]
 *                                              [--fps=30]
 *                                              [--tail=<seconds>]
 *                                              [--crf=<value>]
 *                                              [--run-id=<id>]
 *                                              [--local-only]
 *                                              [--keep-local]
 *
 * Episode layout expected:
 *   src/episodes/<slug>/index.html       # root composition
 *   src/episodes/<slug>/meta.json        # { id, name, ... }
 *   src/episodes/<slug>/hyperframes.json # config
 *   src/episodes/<slug>/assets/voice.mp3
 *   src/episodes/<slug>/assets/captions.json
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { getAudioDurationSeconds } from "@cgaravitoq/audio";
import { checkEpisode } from "@cgaravitoq/catalog";
import manifest from "../../../packages/catalog/manifest.json";
import {
  missingR2EnvKeys,
  publishEpisodeArtifacts,
  resolveR2PublishOptions,
} from "./lib/r2-artifacts.mjs";

// CWD guard — paths in this script (`src/episodes/`, `src/lib/`, `out/`,
// `brands/`, `renders/`) all resolve relative to process.cwd(). The
// canonical invocation is `bun run render:episode` from `apps/hyperframe/`
// (or via `turbo run`, which sets cwd per task). Running from elsewhere
// silently looks up paths in the wrong place.
const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(
    `render-episode: must run from ${expectedCwd}, got ${process.cwd()}.\n` +
      "Hint: cd apps/hyperframe && bun run render:episode <slug>",
  );
  process.exit(1);
}

const HELP = `Usage: bun run scripts/render-episode.mjs <slug> [options]

Options:
  --format=mp4|mov|webm    Output format. Default mp4 (h264 yuv420p). mov gives
                           ProRes 4444 + alpha; webm gives VP9 + alpha.
  --quality=draft|standard|high
                           Render quality preset. Default standard.
  --output=<path>          Output file. Default renders/<slug>.<format>.
  --fps=24|30|60           Frame rate. Default 30.
  --tail=<seconds>         Padding past end-of-audio so the final frame can
                           hold for reading. Resolution order: CLI flag >
                           meta.json "tail" field > 0.3 fallback.
  --crf=<value>            Forward CRF to Hyperframes render when supported.
  --local-only             Skip R2 upload even when credentials are configured.
                           Local render outputs are kept.
  --upload=r2              Back-compat no-op; R2 upload is the default when
                           credentials are configured.
  --run-id=<id>            Override the R2 run folder name. Default: UTC timestamp.
  --keep-local             After verified upload, keep the local render output.
  --delete-local           Deprecated back-compat no-op; local render outputs
                           are deleted by default after verified R2 upload.
  -h, --help               Show this help.
`;

const VALID_FORMATS = ["mp4", "mov", "webm"];
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const stampDuration = (html, totalSeconds, voiceSeconds) => {
  // Anchor on the canonical identifier (`data-composition-id`), then rewrite
  // `data-duration` regardless of attribute order. `[^>]*` matches across
  // newlines (it's a negated char class, not `.`), so multi-line stage tags
  // emitted by the scaffolder also work.
  const stageTagRe = /<div\b[^>]*\bdata-composition-id="[^"]+"[^>]*>/;
  const stageTag = html.match(stageTagRe)?.[0];
  if (!stageTag) {
    throw new Error(
      "render-episode: did not find a root <div data-composition-id=...> to stamp. " +
        "Check the index.html stage element follows the canonical pattern.",
    );
  }
  if (!/\bdata-duration="[^"]*"/.test(stageTag)) {
    throw new Error(
      "render-episode: stage <div> is missing data-duration attribute. " +
        'Add a placeholder (e.g. data-duration="30") so it can be stamped.',
    );
  }
  const stampedStage = stageTag.replace(
    /\bdata-duration="[^"]*"/,
    `data-duration="${totalSeconds}"`,
  );
  let stamped = html.replace(stageTag, stampedStage);

  // Stamp the voiceover audio's data-duration the same way (best-effort —
  // some compositions don't have a voiceover track).
  const voiceTagRe = /<audio\b[^>]*\bid="voiceover"[^>]*>/;
  const voiceTag = stamped.match(voiceTagRe)?.[0];
  if (voiceTag && /\bdata-duration="[^"]*"/.test(voiceTag)) {
    const stampedVoice = voiceTag.replace(
      /\bdata-duration="[^"]*"/,
      `data-duration="${voiceSeconds.toFixed(2)}"`,
    );
    stamped = stamped.replace(voiceTag, stampedVoice);
  }
  return stamped;
};

const stampBrand = (html, brandSlug) => {
  if (!brandSlug) return { html, brand: null };
  const brandPath = path.resolve("brands", brandSlug, "brand.json");
  if (!fs.existsSync(brandPath)) {
    throw new Error(
      `render-episode: meta.brand="${brandSlug}" but ${brandPath} does not exist. Create the brand pack or remove the field.`,
    );
  }
  let brand;
  try {
    brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  } catch (err) {
    throw new Error(`render-episode: ${brandPath} is not valid JSON: ${err.message}`);
  }
  if (!brand.palette || typeof brand.palette !== "object") {
    throw new Error(`render-episode: ${brandPath} missing required "palette" object.`);
  }

  const cssVars = Object.entries(brand.palette)
    .map(([key, value]) => `  --brand-${key}: ${value};`)
    .join("\n");
  const styleBlock = `<style id="brand-vars" data-brand="${brand.slug}">\n:root {\n${cssVars}\n}\n</style>`;

  const placeholderRe = /<style[^>]*id="brand-vars"[^>]*>[\s\S]*?<\/style>/;
  if (placeholderRe.test(html)) {
    return { html: html.replace(placeholderRe, styleBlock), brand };
  }
  // No placeholder — inject before </head> as a graceful fallback.
  const headCloseRe = /<\/head>/;
  if (!headCloseRe.test(html)) {
    throw new Error(
      'render-episode: cannot inject brand vars — no <style id="brand-vars"> placeholder and no </head> in index.html.',
    );
  }
  return { html: html.replace(headCloseRe, `${styleBlock}\n  </head>`), brand };
};

const inlineCaptions = (html, captionsPath) => {
  if (!fs.existsSync(captionsPath)) return { html, count: 0 };
  const raw = fs.readFileSync(captionsPath, "utf8").trim();
  if (!raw) return { html, count: 0 };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`render-episode: ${captionsPath} is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`render-episode: ${captionsPath} must be a JSON array, got ${typeof parsed}`);
  }
  const tagRe = /(<script[^>]*id="captions-data"[^>]*>)([\s\S]*?)(<\/script>)/;
  if (!tagRe.test(html)) {
    throw new Error(
      'render-episode: <script id="captions-data"> tag not found in index.html. ' +
        "Add it (empty array as default) so captions can be auto-inlined.",
    );
  }
  // Escape `</` so a caption text containing the literal sequence `</script`
  // can't break out of the JSON island. `type="application/json"` already
  // protects us in modern HTML5 parsers, but the escape is zero-cost defense.
  const safeJson = JSON.stringify(parsed).replace(/<\//g, "<\\/");
  const inlined = html.replace(tagRe, `$1${safeJson}$3`);
  return { html: inlined, count: parsed.length };
};

const ensureSymlink = (linkPath, targetAbs) => {
  // Recreate every time so re-running with a moved repo doesn't keep a
  // stale symlink. lstatSync handles broken symlinks (existsSync wouldn't).
  // `recursive: true` covers the rare case where a real directory was
  // dropped in place of the symlink.
  try {
    fs.lstatSync(linkPath);
    fs.rmSync(linkPath, { force: true, recursive: true });
  } catch {
    // Doesn't exist — nothing to remove.
  }
  const target = path.relative(path.dirname(linkPath), targetAbs);
  fs.symlinkSync(target, linkPath, "dir");
};

const main = async () => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      format: { type: "string", default: "mp4" },
      quality: { type: "string", default: "standard" },
      output: { type: "string" },
      fps: { type: "string", default: "30" },
      crf: { type: "string" },
      upload: { type: "string" },
      "run-id": { type: "string" },
      "delete-local": { type: "boolean" },
      "local-only": { type: "boolean", default: false },
      "keep-local": { type: "boolean", default: false },
      // No default for tail: undefined means "not provided", so we can fall
      // back to meta.json's `tail` field, then to 0.3.
      tail: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const [slug] = positionals;
  if (!SLUG_RE.test(slug)) {
    console.error(`render-episode: slug must be lowercase kebab-case, got "${slug}"`);
    process.exit(1);
  }
  const episodeDir = path.resolve("src/episodes", slug);
  if (!fs.existsSync(episodeDir)) {
    console.error(`render-episode: episode not found at ${episodeDir}`);
    process.exit(1);
  }

  const indexPath = path.join(episodeDir, "index.html");
  const metaPath = path.join(episodeDir, "meta.json");
  const hfConfigPath = path.join(episodeDir, "hyperframes.json");
  const assetsDir = path.join(episodeDir, "assets");
  const audioPath = path.join(assetsDir, "voice.mp3");
  const captionsPath = path.join(assetsDir, "captions.json");

  if (!fs.existsSync(indexPath)) {
    console.error(`render-episode: missing required file ${indexPath}`);
    process.exit(1);
  }

  const catalogCheck = checkEpisode(indexPath, manifest);
  if (!catalogCheck.ok) {
    console.error(
      JSON.stringify({ error: "catalog-check-failed", failures: catalogCheck.failures }, null, 2),
    );
    process.exit(1);
  }

  for (const required of [metaPath, audioPath]) {
    if (!fs.existsSync(required)) {
      console.error(`render-episode: missing required file ${required}`);
      process.exit(1);
    }
  }

  // ── Validate all flags BEFORE any work ────────────────────────────────
  const fmt = values.format;
  if (!VALID_FORMATS.includes(fmt)) {
    console.error(`render-episode: --format must be one of ${VALID_FORMATS.join(", ")}`);
    process.exit(1);
  }
  if (values.upload !== undefined && values.upload !== "r2") {
    console.error('render-episode: --upload currently supports only "r2"');
    process.exit(1);
  }
  if (values.upload !== undefined && missingR2EnvKeys().length === 0) {
    console.warn("[render-episode] --upload=r2 is now the default; flag has no effect.");
  }

  const fpsParsed = Number.parseInt(values.fps, 10);
  if (!Number.isFinite(fpsParsed) || fpsParsed <= 0) {
    console.error(`render-episode: invalid --fps=${values.fps}`);
    process.exit(1);
  }

  // ── Resolve tail: CLI flag > meta.json "tail" > 0.3 ───────────────────
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  let tailSeconds;
  let tailSource;
  if (values.tail !== undefined) {
    tailSeconds = Number.parseFloat(values.tail);
    tailSource = "--tail flag";
  } else if (typeof meta.tail === "number") {
    tailSeconds = meta.tail;
    tailSource = "meta.json";
  } else {
    tailSeconds = 0.3;
    tailSource = "default";
  }
  if (!Number.isFinite(tailSeconds) || tailSeconds < 0) {
    console.error(`render-episode: invalid tail=${tailSeconds} (from ${tailSource})`);
    process.exit(1);
  }

  // ── Measure voice duration ────────────────────────────────────────────
  const voiceSeconds = await getAudioDurationSeconds(audioPath);
  if (!Number.isFinite(voiceSeconds) || voiceSeconds <= 0) {
    console.error(
      `render-episode: ffprobe returned invalid duration (${voiceSeconds}). Install ffmpeg or pin a duration manually.`,
    );
    process.exit(1);
  }
  const totalSeconds = Number((voiceSeconds + tailSeconds).toFixed(2));

  // ── Build working copy under out/episodes/<slug>/ ─────────────────────
  const workDir = path.resolve("out/episodes", slug);
  fs.mkdirSync(workDir, { recursive: true });

  const srcHtml = fs.readFileSync(indexPath, "utf8");
  const stamped = stampDuration(srcHtml, totalSeconds, voiceSeconds);
  const { html: brandedHtml, brand } = stampBrand(stamped, meta.brand);
  if (brand && brand.publishable === false) {
    console.warn(
      `[render-episode] WARNING: brand "${brand.slug}" is marked publishable=false. ${brand.notes || "Internal use only."}`,
    );
  }
  const { html: finalHtml, count: captionsCount } = inlineCaptions(brandedHtml, captionsPath);
  fs.writeFileSync(path.join(workDir, "index.html"), finalHtml);

  // meta.json — informational; Hyperframes reads from data-attrs.
  meta.duration = totalSeconds;
  meta.voiceSeconds = Number(voiceSeconds.toFixed(2));
  fs.writeFileSync(path.join(workDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

  // hyperframes.json — copy if present so per-episode config travels.
  if (fs.existsSync(hfConfigPath)) {
    fs.copyFileSync(hfConfigPath, path.join(workDir, "hyperframes.json"));
  }

  // Symlink lib + assets to keep the working copy tiny and avoid copying
  // voice.mp3 (~MBs) every render.
  ensureSymlink(path.join(workDir, "lib"), path.resolve("src/lib"));
  ensureSymlink(path.join(workDir, "assets"), assetsDir);

  console.log(
    `[render-episode] prepared ${workDir} (duration=${totalSeconds}s [voice=${voiceSeconds.toFixed(2)}s + tail=${tailSeconds}s from ${tailSource}], captions=${captionsCount}${brand ? `, brand=${brand.slug}` : ""})`,
  );

  // ── Run hyperframes render ────────────────────────────────────────────
  const outPath = values.output ?? `renders/${slug}.${fmt}`;
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });

  console.log(
    `[render-episode] rendering ${slug} → ${outPath} (${fmt}, ${values.quality}, ${values.fps}fps)`,
  );
  const renderArgs = [
    "hyperframes",
    "render",
    workDir,
    "--format",
    fmt,
    "--quality",
    values.quality,
    "--fps",
    values.fps,
    "--output",
    outPath,
  ];
  if (values.crf !== undefined) {
    renderArgs.push("--crf", values.crf);
  }

  const result = spawnSync("bunx", renderArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const publishOptions = resolveR2PublishOptions({
    localOnly: values["local-only"],
    keepLocal: values["keep-local"],
    deleteLocal: values["delete-local"],
  });
  if (publishOptions.warning) {
    console.warn(publishOptions.warning);
  }

  if (publishOptions.upload) {
    console.log("[render-episode] uploading verified artifacts to R2");
    const publishResult = await publishEpisodeArtifacts({
      slug,
      episodeDir,
      renderPath: path.resolve(outPath),
      runId: values["run-id"],
      deleteLocal: publishOptions.deleteLocal,
    });
    console.log(
      `[render-episode] uploaded ${publishResult.uploaded.length} artifact(s) to R2 run ${publishResult.runId}`,
    );
    console.log(`[render-episode] wrote ${path.join(episodeDir, "render.remote.json")}`);
    console.log(`[render-episode] wrote ${path.join(episodeDir, "assets.remote.json")}`);
  }

  console.log(`\n[render-episode] done — ${outPath}`);
};

main().catch((err) => {
  console.error("render-episode failed:");
  console.error(err);
  process.exit(1);
});
