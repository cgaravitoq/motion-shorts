#!/usr/bin/env bun
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  isQuarantineCandidate,
  PUBLISHABILITY_STATUSES,
  sourceAssetsDirForSlug,
  sourcePackagePathForSlug,
  validateCaptureUrl,
  validateEpisodeSlug,
  validateSourcePackage,
} from "./lib/source-package.mjs";

const appDir = path.resolve(import.meta.dirname, "..");

const HELP = `Usage: bun run capture:source <url> --slug=<episode-slug> [options]

Captures a public HTTPS source into the episode source package contract.

Required:
  <url>                         Public HTTPS URL to capture.
  --slug=<episode-slug>         Episode slug ([a-z0-9-]+).

Options:
  --scaffold                    Create the canonical episode shell first when
                                the episode directory is missing.
  --dry-run                     Print the resolved paths and validations without
                                writing files.
  --force                       Allow replacing an existing source.json.
  -h, --help                    Show this help.

Output path:
  source.json                   src/episodes/<slug>/assets/source.json
  local assets                  src/episodes/<slug>/assets/<captured files>

Publishability statuses:
  ok                            Public source and captured assets look usable.
  review-required               Human rights/brand/license review is needed.
  blocked                       Do not publish until the listed reasons are fixed.

Notes:
  Scaffolding is opt-in via --scaffold; this command will not create an episode
  by default.
  Unsupported URLs are rejected before capture: non-HTTPS URLs and obvious
  auth-required login/account URLs.
`;

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const fail = (message) => {
  throw new Error(message);
};

export const toKebab = (value) => {
  const name =
    value.startsWith(".") && !value.slice(1).includes(".")
      ? value.slice(1)
      : value.replace(/\.[^.]+$/, "");

  return (
    name
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "asset"
  );
};

const inferKind = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  if ([".woff", ".woff2", ".ttf", ".otf"].includes(ext)) return "font";
  if (base.includes("screenshot") || base.includes("capture")) return "screenshot";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) return "image";
  return "other";
};

const walkFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
};

export const findCapturedFiles = (captureOutputDir, captureJson) => {
  const root = path.resolve(captureOutputDir);
  const files = new Set(walkFiles(root));
  const visit = (value) => {
    if (typeof value === "string") {
      const candidate = path.resolve(root, value);
      const relative = path.relative(root, candidate);
      if (
        !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        files.add(candidate);
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    if (isRecord(value)) Object.values(value).forEach(visit);
  };
  visit(captureJson);
  return [...files].filter((file) => path.basename(file) !== "capture.json").sort();
};

const fileSha256 = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const firstString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();

const arrayOfStrings = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const reviewReasonForMissing = (field) =>
  `${field} could not be inferred from the page; manual review recommended`;

const markedFallback = (field, fallback) =>
  firstString(fallback)
    ? `[auto-${field} unavailable] ${fallback.trim()}`
    : `[auto-${field} unavailable]`;

const requiredStringWithFallback = ({ field, candidates, fallback, reasons }) => {
  const value = firstString(...candidates);
  if (value) return value;

  reasons.push(reviewReasonForMissing(field));
  return markedFallback(field, fallback);
};

const textFromCapture = (captureJson) => {
  const candidates = [
    captureJson.text,
    captureJson.content,
    captureJson.markdown,
    captureJson.bodyText,
  ];
  return firstString(...candidates) ?? "";
};

const inferPublisher = (sourceUrl, captureJson) => {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  return firstString(
    captureJson.publisher,
    captureJson.siteName,
    captureJson.metadata?.publisher,
    captureJson.metadata?.siteName,
    host,
  );
};

const inferLogoPath = (assets) =>
  assets.find((asset) => /logo|brand/i.test(asset.localPath))?.localPath;

const publishabilityFor = (sourceUrl, captureJson, assets, missingReasons) => {
  const url = new URL(sourceUrl);
  const reasons = [...missingReasons];
  const text =
    `${sourceUrl} ${JSON.stringify(captureJson)} ${assets.map((asset) => asset.localPath).join(" ")}`.toLowerCase();

  // Rules of thumb: customer stories usually include named third-party brands,
  // logos/screenshots imply external rights, and those should default to review.
  if (
    /\/customers?\//i.test(url.pathname) ||
    /customer[-_ ]?(story|stories)|case[-_ ]?study/i.test(text)
  ) {
    reasons.push("Customer-story-like URL; verify brand/customer rights before publishing.");
  }
  if (assets.some((asset) => /logo|brand/i.test(asset.localPath))) {
    reasons.push("Captured logo or brand asset; verify trademark usage before publishing.");
  }
  if (assets.some((asset) => asset.kind === "screenshot")) {
    reasons.push("Captured external screenshot; verify source-page usage before publishing.");
  }
  if (/third[-_ ]?party|partner|customer logo|brand assets/i.test(text)) {
    reasons.push("Capture indicates third-party brand assets may be present.");
  }
  const quarantinedCount = assets.filter((asset) => asset.quarantined === true).length;
  if (quarantinedCount > 0) {
    reasons.push(
      `Quarantined ${quarantinedCount} captured file(s) with agent-instruction-like filenames (see assets/captured-raw/); review before treating any as authoritative.`,
    );
  }

  return {
    status: reasons.length > 0 ? "review-required" : "ok",
    reasons: [...new Set(reasons)],
  };
};

const copyCapturedAssets = ({ captureOutputDir, captureJson, assetsDirAbs }) => {
  fs.mkdirSync(assetsDirAbs, { recursive: true });
  const used = new Map();
  return findCapturedFiles(captureOutputDir, captureJson).map((sourcePath) => {
    const kind = inferKind(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();
    const originalFilename = path.basename(sourcePath);
    const quarantined = isQuarantineCandidate(originalFilename);
    const base = toKebab(originalFilename);
    const filenameKey = quarantined ? `quarantined-${base}.txt` : `${base}${ext}`;
    const count = used.get(filenameKey) ?? 0;
    used.set(filenameKey, count + 1);
    const filename = quarantined
      ? `quarantined-${base}${count === 0 ? "" : `-${count + 1}`}.txt`
      : count === 0
        ? `${base}${ext}`
        : `${base}-${count + 1}${ext}`;
    const relativePath = quarantined ? path.posix.join("captured-raw", filename) : filename;
    const targetPath = path.join(assetsDirAbs, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    const stat = fs.statSync(targetPath);
    const asset = {
      kind,
      localPath: path.posix.join("assets", relativePath),
      sourceUrl: sourcePath.startsWith(captureOutputDir)
        ? path.relative(captureOutputDir, sourcePath)
        : sourcePath,
      bytes: stat.size,
      sha256: fileSha256(targetPath),
    };
    if (quarantined) {
      asset.quarantined = true;
      asset.originalFilename = originalFilename;
      console.log(`[capture:source] quarantined: ${originalFilename} -> ${asset.localPath}`);
    }
    return asset;
  });
};

const removePreviousCapturedAssets = (sourcePackageAbs) => {
  if (!fs.existsSync(sourcePackageAbs)) return;
  const previous = JSON.parse(fs.readFileSync(sourcePackageAbs, "utf8"));
  const root = path.dirname(path.dirname(sourcePackageAbs));
  for (const asset of previous.assets ?? []) {
    if (
      !isRecord(asset) ||
      typeof asset.localPath !== "string" ||
      !asset.localPath.startsWith("assets/")
    )
      continue;
    const target = path.resolve(root, asset.localPath);
    if (target.startsWith(path.resolve(root, "assets")) && fs.existsSync(target))
      fs.unlinkSync(target);
  }
};

const parseCaptureStdout = (stdout) => {
  const trimmed = stdout.trim();
  if (!trimmed) fail("hyperframes capture produced no JSON output");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    fail("hyperframes capture output was not valid JSON");
  }
};

const runHyperframesCapture = ({ sourceUrl, captureOutputDir, spawnImpl = spawn }) =>
  new Promise((resolve, reject) => {
    const child = spawnImpl(
      "bunx",
      ["hyperframes", "capture", sourceUrl, `--output=${captureOutputDir}`, "--json"],
      {
        cwd: appDir,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(parseCaptureStdout(stdout));
      else reject(new Error(`hyperframes capture failed with exit code ${code}`));
    });
  });

const runNewEpisode = ({ slug, spawnImpl = spawn }) =>
  new Promise((resolve, reject) => {
    const child = spawnImpl("bun", ["run", "new-episode", slug], {
      cwd: appDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`new-episode failed with exit code ${code}`));
    });
  });

export const buildSourcePackage = ({ sourceUrl, capturedAt, captureJson, assets }) => {
  const text = textFromCapture(captureJson);
  const metadata = isRecord(captureJson.metadata) ? captureJson.metadata : {};
  const keyPoints = arrayOfStrings(captureJson.keyPoints).length
    ? arrayOfStrings(captureJson.keyPoints)
    : text
        .split(/(?<=[.!?])\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
  const missingReasons = [];
  const title = requiredStringWithFallback({
    field: "title",
    candidates: [captureJson.title, metadata.title],
    fallback: new URL(sourceUrl).hostname.replace(/^www\./, ""),
    reasons: missingReasons,
  });
  const summary = requiredStringWithFallback({
    field: "summary",
    candidates: [captureJson.summary, captureJson.description, metadata.description, keyPoints[0]],
    fallback: title,
    reasons: missingReasons,
  });
  const publisher = requiredStringWithFallback({
    field: "publisher",
    candidates: [inferPublisher(sourceUrl, captureJson)],
    fallback: new URL(sourceUrl).hostname.replace(/^www\./, ""),
    reasons: missingReasons,
  });
  const subject = requiredStringWithFallback({
    field: "subject",
    candidates: [captureJson.subject, metadata.subject],
    fallback: title,
    reasons: missingReasons,
  });
  const fonts = arrayOfStrings(captureJson.fonts).concat(
    Array.isArray(captureJson.assets?.fonts)
      ? captureJson.assets.fonts.map((font) => font.name).filter(Boolean)
      : [],
  );
  if (keyPoints.length === 0)
    missingReasons.push("No key points were inferred from capture output.");

  const sourcePackage = {
    sourceUrl,
    capturedAt,
    title,
    summary,
    publisher,
    subject,
    keyPoints,
    brandSystem: {
      dominantColors: arrayOfStrings(captureJson.colors ?? captureJson.brandSystem?.dominantColors),
      fonts: [...new Set(fonts)],
      logoPath: inferLogoPath(assets),
    },
    assets,
    attribution: {
      author: firstString(captureJson.author, metadata.author, publisher) ?? "",
      license:
        firstString(captureJson.license, metadata.license) ??
        "Review source rights before publishing.",
    },
    publishability: publishabilityFor(sourceUrl, captureJson, assets, missingReasons),
  };

  const validation = validateSourcePackage(sourcePackage);
  if (!validation.ok) fail(`normalized source package is invalid: ${validation.errors.join("; ")}`);
  return sourcePackage;
};

export const runCaptureSource = async ({
  sourceUrl,
  slug,
  force = false,
  dryRun = false,
  scaffold = false,
  spawnImpl = spawn,
}) => {
  const slugCheck = validateEpisodeSlug(slug);
  if (!slugCheck.ok) fail(slugCheck.errors.join("; "));

  const urlCheck = validateCaptureUrl(sourceUrl);
  if (!urlCheck.ok) fail(urlCheck.errors.join("; "));

  const episodeDirAbs = path.resolve(appDir, "src/episodes", slug);
  const assetsDir = sourceAssetsDirForSlug(slug);
  const sourcePackagePath = sourcePackagePathForSlug(slug);
  const assetsDirAbs = path.resolve(appDir, assetsDir);
  const sourcePackageAbs = path.resolve(appDir, sourcePackagePath);

  if (dryRun) {
    return {
      sourcePackagePath,
      assetsDir,
      dryRun: true,
      scaffolded: scaffold && !fs.existsSync(episodeDirAbs),
    };
  }

  if (!fs.existsSync(episodeDirAbs)) {
    if (scaffold) {
      await runNewEpisode({ slug, spawnImpl });
    } else {
      fail(
        `Episode ${slug} does not exist. Create it first with bun run new-episode ${slug}, or pass --scaffold.`,
      );
    }
  } else if (scaffold) {
    console.log(`episode ${slug} already exists; skipping scaffold, running capture only.`);
  }

  if (!fs.existsSync(episodeDirAbs)) {
    fail(
      `Episode ${slug} does not exist. Create it first with bun run new-episode ${slug}, or pass --scaffold.`,
    );
  }

  if (fs.existsSync(sourcePackageAbs) && !force) {
    fail(`${sourcePackagePath} already exists; pass --force to replace it`);
  }

  const captureOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), `hyperframes-capture-${slug}-`));
  try {
    const capturedAt = new Date().toISOString();
    const captureJson = await runHyperframesCapture({ sourceUrl, captureOutputDir, spawnImpl });
    removePreviousCapturedAssets(sourcePackageAbs);
    const assets = copyCapturedAssets({ captureOutputDir, captureJson, assetsDirAbs });
    const sourcePackage = buildSourcePackage({ sourceUrl, capturedAt, captureJson, assets });
    fs.writeFileSync(sourcePackageAbs, `${JSON.stringify(sourcePackage, null, 2)}\n`);
    return { sourcePackagePath, assetsDir, sourcePackage, dryRun: false };
  } finally {
    fs.rmSync(captureOutputDir, { recursive: true, force: true });
  }
};

const main = async () => {
  if (path.resolve(process.cwd()) !== appDir) {
    console.error(
      `capture-source: must run from ${appDir}, got ${process.cwd()}.\n` +
        "Hint: cd apps/hyperframe && bun run capture:source <url> --slug=<episode-slug>",
    );
    process.exit(1);
  }

  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      slug: { type: "string" },
      scaffold: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0 || !values.slug) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const [sourceUrl] = positionals;
  console.log(`[capture-source] sourceUrl: ${sourceUrl}`);
  console.log(`[capture-source] slug: ${values.slug}`);
  console.log(`[capture-source] output: ${sourcePackagePathForSlug(values.slug)}`);
  console.log(`[capture-source] assets: ${sourceAssetsDirForSlug(values.slug)}/`);
  console.log(`[capture-source] publishability: ${PUBLISHABILITY_STATUSES.join(" | ")}`);
  console.log(
    `[capture-source] scaffold: ${values.scaffold ? "enabled (creates missing episode shell)" : "disabled (pass --scaffold to opt in)"}`,
  );

  const result = await runCaptureSource({
    sourceUrl,
    slug: values.slug,
    dryRun: values["dry-run"],
    force: values.force,
    scaffold: values.scaffold,
  });

  if (result.dryRun) {
    if (result.scaffolded)
      console.log(`[capture-source] dry-run: would scaffold episode ${values.slug}`);
    console.log("[capture-source] dry-run: no files written");
  } else console.log(`[capture-source] wrote ${result.sourcePackagePath}`);
};

if (import.meta.path === Bun.main) {
  main().catch((error) => {
    console.error(`capture-source: ${error.message}`);
    process.exit(1);
  });
}
