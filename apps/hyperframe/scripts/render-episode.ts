#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { getAudioDurationSeconds } from "@cgaravitoq/audio";
import { type BrandPack, brandVarsStyleBlock, loadBrandPack } from "./lib/brand-pack";
import { publishEpisodeArtifacts, resolveR2PublishOptions } from "./lib/r2-artifacts";
import {
  appendLedger,
  buildRecord,
  collectAssetInventory,
  createTimer,
  formatSummaryLine,
} from "./lib/telemetry";

const LEDGER_PATH = path.resolve(".metrics/runs.ndjson");

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(
    `render-episode: must run from ${expectedCwd}, got ${process.cwd()}.\n` +
      "Hint: cd apps/hyperframe && bun run render:episode <slug>",
  );
  process.exit(1);
}

const HELP = `Usage: bun run scripts/render-episode.ts <slug> [options]

Options:
  --format=mp4|mov|webm    Output container format. Default mp4 (h264 yuv420p).
                           mov gives ProRes 4444 + alpha; webm gives VP9 + alpha.
  --variant=short|desktop-1080p|desktop-4k|square-1080
                            Composition variant. Default short (9:16, reads
                            index.html). desktop-1080p (16:9, reads
                            index.desktop.html) renders 1920x1080 for YouTube
                            long-form, LinkedIn desktop, X landscape, Vimeo.
                            desktop-4k reuses index.desktop.html and renders
                            3840x2160. square-1080 reads index.square.html and
                            renders 1080x1080.
  --quality=draft|standard|high
                           Render quality preset. Default standard.
  --output=<path>          Output file. Default renders/<slug>.<format> for
                           short, renders/<slug>.desktop.<format> for
                            desktop-1080p, renders/<slug>.desktop-4k.<format>
                            for desktop-4k, renders/<slug>.square.<format>
                            for square-1080.
  --fps=24|30|60           Frame rate. Default 30.
  --tail=<seconds>         Padding past end-of-audio so the final frame can
                           hold for reading. Resolution order: CLI flag >
                           meta.json "tail" field > 0.3 fallback.
  --crf=<value>            Forward CRF to Hyperframes render when supported.
  --workers=<n|auto>       Parallel render workers (1-8). Forwarded to
                           hyperframes render. Default: renderer's auto.
  --browser-gpu            Force host GPU (instead of SwiftShader) for the
                           Chrome capture. Faster on machines with a real GPU.
  --gpu                    Hardware ffmpeg encoding (VAAPI/NVENC) when available.
  --upload=r2              Upload verified artifacts to R2 and write remote
                           manifests. Omit for local review renders.
  --local-only             Back-compat no-op; local-only is the default.
  --run-id=<id>            Override the R2 run folder name. Default: UTC timestamp.
  --keep-local             After verified upload, keep the local render output.
  --delete-local           Deprecated back-compat no-op; uploaded render
                           outputs are deleted by default unless --keep-local
                           is passed.
  -h, --help               Show this help.
`;

const VALID_FORMATS = ["mp4", "mov", "webm"];
const VALID_FPS_VALUES = [24, 30, 60];
const VALID_VARIANTS = ["short", "desktop-1080p", "desktop-4k", "square-1080"];
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

interface VariantRender {
  index: string;
  outputSuffix: string;
  resolution: string;
  bitrate30: string;
}

const VARIANT_RENDER: Record<string, VariantRender> = {
  short: { index: "index.html", outputSuffix: "", resolution: "portrait", bitrate30: "10M" },
  "desktop-1080p": {
    index: "index.desktop.html",
    outputSuffix: ".desktop",
    resolution: "landscape",
    bitrate30: "12M",
  },
  "desktop-4k": {
    index: "index.desktop.html",
    outputSuffix: ".desktop-4k",
    resolution: "landscape-4k",
    bitrate30: "40M",
  },
  "square-1080": {
    index: "index.square.html",
    outputSuffix: ".square",
    resolution: "square",
    bitrate30: "10M",
  },
};

const variantIndexFilename = (variant: string): string =>
  (VARIANT_RENDER[variant] as VariantRender).index;

const bitrateForFps = (bitrate30: string, fps: number): string => {
  if (fps !== 60) return bitrate30;
  const mbps = Number.parseFloat(bitrate30.replace(/m$/i, ""));
  return `${Number(mbps * 1.5).toString()}M`;
};

const stampStageFps = (html: string, fps: number): string => {
  const stageTagRe = /<div\b[^>]*\bdata-composition-id="[^"]+"[^>]*>/;
  const stageTag = html.match(stageTagRe)?.[0];
  if (!stageTag) return html;
  const stampedStage = /\bdata-fps="[^"]*"/.test(stageTag)
    ? stageTag.replace(/\bdata-fps="[^"]*"/, `data-fps="${fps}"`)
    : stageTag.replace(/>$/, ` data-fps="${fps}">`);
  return html.replace(stageTag, stampedStage);
};

const stampDuration = (html: string, totalSeconds: number, voiceSeconds: number): string => {
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

const readStageDurationSeconds = (htmlPath: string): number => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const stageTag = html.match(/<div\b[^>]*\bdata-composition-id="[^"]+"[^>]*>/)?.[0];
  if (!stageTag) return Number.NaN;
  const raw = stageTag.match(/\bdata-duration="([^"]+)"/)?.[1];
  return raw === undefined ? Number.NaN : Number.parseFloat(raw);
};

const stripVoiceoverTag = (html: string): string =>
  html.replace(/\s*<audio\b[^>]*\bid="voiceover"[^>]*>\s*<\/audio>\s*/g, "\n      ");

const stampBrand = (
  html: string,
  brandSlug: string | undefined,
): { html: string; brand: BrandPack | null } => {
  if (!brandSlug) return { html, brand: null };
  const brand = loadBrandPack(process.cwd(), brandSlug, "render-episode");
  const styleBlock = brandVarsStyleBlock(brand);

  const placeholderRe = /<style[^>]*id="brand-vars"[^>]*>[\s\S]*?<\/style>/;
  if (placeholderRe.test(html)) {
    return { html: html.replace(placeholderRe, styleBlock), brand };
  }
  const headCloseRe = /<\/head>/;
  if (!headCloseRe.test(html)) {
    throw new Error(
      'render-episode: cannot inject brand vars — no <style id="brand-vars"> placeholder and no </head> in index.html.',
    );
  }
  return { html: html.replace(headCloseRe, `${styleBlock}\n  </head>`), brand };
};

const inlineCaptions = (html: string, captionsPath: string): { html: string; count: number } => {
  if (!fs.existsSync(captionsPath)) return { html, count: 0 };
  const raw = fs.readFileSync(captionsPath, "utf8").trim();
  if (!raw) return { html, count: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`render-episode: ${captionsPath} is not valid JSON: ${(err as Error).message}`);
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
  const safeJson = JSON.stringify(parsed).replace(/<\//g, "<\\/");
  const inlined = html.replace(tagRe, `$1${safeJson}$3`);
  return { html: inlined, count: parsed.length };
};

const ensureSymlink = (linkPath: string, targetAbs: string): void => {
  try {
    fs.lstatSync(linkPath);
    fs.rmSync(linkPath, { force: true, recursive: true });
  } catch {}
  const target = path.relative(path.dirname(linkPath), targetAbs);
  fs.symlinkSync(target, linkPath, "dir");
};

interface EpisodeMeta {
  brand?: string;
  tail?: number;
  duration?: number;
  voiceSeconds?: number;
  [key: string]: unknown;
}

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      format: { type: "string", default: "mp4" },
      variant: { type: "string", default: "short" },
      quality: { type: "string", default: "standard" },
      output: { type: "string" },
      fps: { type: "string", default: "30" },
      crf: { type: "string" },
      upload: { type: "string" },
      "run-id": { type: "string" },
      workers: { type: "string" },
      "browser-gpu": { type: "boolean", default: false },
      gpu: { type: "boolean", default: false },
      "delete-local": { type: "boolean" },
      "local-only": { type: "boolean", default: false },
      "keep-local": { type: "boolean", default: false },
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
  if (slug === undefined || !SLUG_RE.test(slug)) {
    console.error(`render-episode: slug must be lowercase kebab-case, got "${slug}"`);
    process.exit(1);
  }
  const episodeDir = path.resolve("src/episodes", slug);
  if (!fs.existsSync(episodeDir)) {
    console.error(`render-episode: episode not found at ${episodeDir}`);
    process.exit(1);
  }

  const variant = values.variant as string;
  if (!VALID_VARIANTS.includes(variant)) {
    console.error(`render-episode: --variant must be one of ${VALID_VARIANTS.join(", ")}`);
    process.exit(1);
  }

  const timer = createTimer();
  timer.start("materialise");

  const indexFilename = variantIndexFilename(variant);
  const indexPath = path.join(episodeDir, indexFilename);
  const metaPath = path.join(episodeDir, "meta.json");
  const hfConfigPath = path.join(episodeDir, "hyperframes.json");
  const assetsDir = path.join(episodeDir, "assets");
  const audioPath = path.join(assetsDir, "voice.mp3");
  const captionsPath = path.join(assetsDir, "captions.json");

  if (!fs.existsSync(indexPath)) {
    const hint =
      variant === "desktop-1080p" || variant === "desktop-4k"
        ? " Generate it with `bun run assemble <slug> --format=desktop` (see docs/formats.md)."
        : variant === "square-1080"
          ? " The square variant has no assembler support yet (see docs/formats.md)."
          : "";
    console.error(
      `render-episode: missing required file ${indexPath} for variant=${variant}.${hint}`,
    );
    process.exit(1);
  }

  if (!fs.existsSync(metaPath)) {
    console.error(`render-episode: missing required file ${metaPath}`);
    process.exit(1);
  }
  const hasVoice = fs.existsSync(audioPath);

  const fmt = values.format as string;
  if (!VALID_FORMATS.includes(fmt)) {
    console.error(`render-episode: --format must be one of ${VALID_FORMATS.join(", ")}`);
    process.exit(1);
  }
  if (values.upload !== undefined && values.upload !== "r2") {
    console.error('render-episode: --upload currently supports only "r2"');
    process.exit(1);
  }

  const fpsParsed = Number.parseInt(values.fps as string, 10);
  if (!Number.isFinite(fpsParsed) || fpsParsed <= 0) {
    console.error(`render-episode: invalid --fps=${values.fps}`);
    process.exit(1);
  }
  if (!VALID_FPS_VALUES.includes(fpsParsed)) {
    console.error(
      `render-episode: --fps must be one of ${VALID_FPS_VALUES.join(", ")}, got ${values.fps}`,
    );
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as EpisodeMeta;
  let tailSeconds: number;
  let tailSource: string;
  if (values.tail !== undefined) {
    tailSeconds = Number.parseFloat(values.tail as string);
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

  let voiceSeconds: number;
  let totalSeconds: number;
  if (hasVoice) {
    voiceSeconds = await getAudioDurationSeconds(audioPath);
    if (!Number.isFinite(voiceSeconds) || voiceSeconds <= 0) {
      console.error(
        `render-episode: ffprobe returned invalid duration (${voiceSeconds}). Install ffmpeg or pin a duration manually.`,
      );
      process.exit(1);
    }
    totalSeconds = Number((voiceSeconds + tailSeconds).toFixed(2));
  } else {
    voiceSeconds = 0;
    totalSeconds = readStageDurationSeconds(indexPath);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      console.error(
        `render-episode: ${audioPath} missing and could not read a positive data-duration from the stage <div>. ` +
          "Generate voice with `bun run audio` or pin data-duration on <div data-composition-id=...>.",
      );
      process.exit(1);
    }
    console.warn(
      `[render-episode] ${audioPath} not found — rendering silent. Stage data-duration=${totalSeconds}s drives the timeline. ` +
        "Run `bun run audio <script.txt> --out=public/voice/<slug>` to add narration.",
    );
  }

  const workDir =
    variant === "short"
      ? path.resolve("out/episodes", slug)
      : path.resolve("out/episodes", slug, variant);
  fs.mkdirSync(workDir, { recursive: true });

  const srcHtml = fs.readFileSync(indexPath, "utf8");
  const stampedDuration = hasVoice
    ? stampDuration(srcHtml, totalSeconds, voiceSeconds)
    : stripVoiceoverTag(srcHtml);
  const stamped = stampStageFps(stampedDuration, fpsParsed);
  const sniffedBrand = stamped.match(/<style[^>]*id="brand-vars"[^>]*data-brand="([^"]+)"/)?.[1];
  const { html: brandedHtml, brand } = stampBrand(stamped, meta.brand ?? sniffedBrand);
  if (brand && brand.publishable === false) {
    console.warn(
      `[render-episode] WARNING: brand "${brand.slug}" is marked publishable=false. ${brand.notes || "Internal use only."}`,
    );
  }
  const { html: finalHtml, count: captionsCount } = inlineCaptions(brandedHtml, captionsPath);
  fs.writeFileSync(path.join(workDir, "index.html"), finalHtml);

  meta.duration = totalSeconds;
  meta.voiceSeconds = Number(voiceSeconds.toFixed(2));
  fs.writeFileSync(path.join(workDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

  if (fs.existsSync(hfConfigPath)) {
    fs.copyFileSync(hfConfigPath, path.join(workDir, "hyperframes.json"));
  }

  if (path.resolve(workDir) === path.resolve(episodeDir)) {
    console.error(
      `render-episode: refusing to render — workDir resolves to the source dir (${workDir}). This would risk overwriting src/.`,
    );
    process.exit(1);
  }
  if (!path.resolve(workDir).startsWith(`${path.resolve("out")}${path.sep}`)) {
    console.error(
      `render-episode: refusing to render — workDir (${workDir}) is outside ./out/. Aborting.`,
    );
    process.exit(1);
  }

  ensureSymlink(path.join(workDir, "lib"), path.resolve("src/lib"));
  ensureSymlink(path.join(workDir, "assets"), assetsDir);

  fs.writeFileSync(
    path.join(workDir, "favicon.ico"),
    Buffer.from(
      "47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b",
      "hex",
    ),
  );

  const durationLog = hasVoice
    ? `${totalSeconds}s [voice=${voiceSeconds.toFixed(2)}s + tail=${tailSeconds}s from ${tailSource}]`
    : `${totalSeconds}s [silent, stage data-duration]`;
  console.log(
    `[render-episode] prepared ${workDir} (duration=${durationLog}, captions=${captionsCount}${brand ? `, brand=${brand.slug}` : ""})`,
  );

  const inventory = collectAssetInventory(assetsDir);
  timer.end("materialise");

  const defaultOut = `renders/${slug}${(VARIANT_RENDER[variant] as VariantRender).outputSuffix}.${fmt}`;
  const outPath = (values.output as string | undefined) ?? defaultOut;
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });

  console.log(
    `[render-episode] rendering ${slug} → ${outPath} (${fmt}, ${values.quality}, ${values.fps}fps, ${(VARIANT_RENDER[variant] as VariantRender).resolution}, ${bitrateForFps((VARIANT_RENDER[variant] as VariantRender).bitrate30, fpsParsed)})`,
  );
  const renderArgs = [
    "hyperframes",
    "render",
    workDir,
    "--format",
    fmt,
    "--quality",
    values.quality as string,
    "--fps",
    values.fps as string,
    "--resolution",
    (VARIANT_RENDER[variant] as VariantRender).resolution,
    "--output",
    outPath,
  ];
  if (values.crf !== undefined) {
    renderArgs.push("--crf", values.crf as string);
  } else {
    renderArgs.push(
      "--video-bitrate",
      bitrateForFps((VARIANT_RENDER[variant] as VariantRender).bitrate30, fpsParsed),
    );
  }
  if (values.workers !== undefined) {
    renderArgs.push("--workers", values.workers as string);
  }
  if (values["browser-gpu"]) {
    renderArgs.push("--browser-gpu");
  }
  if (values.gpu) {
    renderArgs.push("--gpu");
  }

  timer.start("render");
  const result = spawnSync("bunx", renderArgs, { stdio: "inherit" });
  timer.end("render");
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const publishOptions = resolveR2PublishOptions({
    upload: values.upload as string | undefined,
    localOnly: values["local-only"],
    keepLocal: values["keep-local"],
    deleteLocal: values["delete-local"],
  });
  if (publishOptions.warning) {
    console.warn(publishOptions.warning);
  }

  let localDeleted = false;
  let uploaded = false;
  if (publishOptions.upload) {
    console.log("[render-episode] uploading verified artifacts to R2");
    timer.start("upload");
    const publishResult = await publishEpisodeArtifacts({
      slug,
      episodeDir,
      renderPath: path.resolve(outPath),
      runId: values["run-id"] as string | undefined,
      deleteLocal: publishOptions.deleteLocal,
    });
    timer.end("upload");
    uploaded = true;
    console.log(
      `[render-episode] published ${publishResult.uploaded.length} artifact(s) as the R2 final (run ${publishResult.runId})`,
    );
    console.log(`[render-episode] wrote ${path.join(episodeDir, "render.remote.json")}`);
    console.log(`[render-episode] wrote ${path.join(episodeDir, "assets.remote.json")}`);
    console.log(`[render-episode] wrote ${path.join(episodeDir, "source.remote.json")}`);
    console.log(`[render-episode] updated R2 index ${publishResult.indexKey}`);
    localDeleted = publishOptions.deleteLocal === true;
  }

  if (localDeleted) {
    console.log(
      `\n[render-episode] done — local ${outPath} deleted after verified R2 upload. Re-run with --keep-local to inspect the mp4 locally.`,
    );
  } else {
    console.log(`\n[render-episode] done — ${outPath}`);
  }

  const durations = timer.durations();
  const totalMs = timer.totalMs();
  try {
    appendLedger(
      LEDGER_PATH,
      buildRecord({
        slug,
        format: fmt,
        variant,
        quality: values.quality as string,
        fps: fpsParsed,
        durations,
        totalMs,
        inventory,
        uploaded,
      }) as unknown as Record<string, unknown>,
    );
  } catch (err) {
    console.warn(`[render-episode] telemetry ledger write failed: ${(err as Error).message}`);
  }
  console.log(formatSummaryLine({ slug, durations, totalMs, totalBytes: inventory.totalBytes }));
};

main().catch((err) => {
  console.error("render-episode failed:");
  console.error(err);
  process.exit(1);
});
