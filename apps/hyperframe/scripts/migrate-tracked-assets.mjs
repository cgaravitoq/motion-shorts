#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { assertR2Config, objectKeyFor, uploadAndVerifyObject } from "./lib/r2-artifacts";

const EPISODES_ROOT = path.resolve("src/episodes");
const ASSET_RE =
  /\/assets\/.*\.(?:mp4|mov|webm|mp3|wav|m4a|png|jpe?g|gif|webp|avif|woff2)$|\/assets\/captions\.json$/i;

const gitLs = spawnSync("git", ["ls-files", "src/episodes"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (gitLs.status !== 0) {
  console.error(gitLs.stderr);
  process.exit(gitLs.status ?? 1);
}

const trackedAssets = gitLs.stdout
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((file) => ASSET_RE.test(file))
  .sort();

if (trackedAssets.length === 0) {
  console.log("migrate-tracked-assets: no tracked episode assets found");
  process.exit(0);
}

const categoryFor = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (filename === "captions.json" || [".mp3", ".wav", ".m4a"].includes(ext)) return "audio";
  if ([".mp4", ".mov", ".webm"].includes(ext)) return "renders";
  if (ext === ".woff2") return "fonts";
  return "images";
};

const contentTypeFor = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (filename === "captions.json") return "application/json";
  if (ext === ".woff2") return "font/woff2";
  return null;
};

const runId =
  process.argv.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) ??
  "tracked-assets-migration";
const env = {
  ...Bun.env,
  ...(Bun.env.R2_UPLOAD_GATEWAY_URL && Bun.env.R2_UPLOAD_GATEWAY_TOKEN
    ? {
        R2_ACCESS_KEY_ID_WRITE: Bun.env.R2_ACCESS_KEY_ID_WRITE || "gateway-upload",
        R2_SECRET_ACCESS_KEY_WRITE: Bun.env.R2_SECRET_ACCESS_KEY_WRITE || "gateway-upload",
      }
    : {}),
};
const config = assertR2Config(env);
const byEpisode = new Map();

for (const relativePath of trackedAssets) {
  const parts = relativePath.split(path.sep);
  const slug = parts[2];
  if (!byEpisode.has(slug)) byEpisode.set(slug, []);
  byEpisode.get(slug).push(relativePath);
}

const generatedAt = new Date().toISOString();

for (const [slug, files] of [...byEpisode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const episodeDir = path.join(EPISODES_ROOT, slug);
  const uploaded = [];

  for (const relativePath of files) {
    const filename = path.basename(relativePath);
    const localPath = path.resolve(relativePath);
    const category = categoryFor(filename);
    const key = objectKeyFor({ slug, runId, category, filename });
    const remote = await uploadAndVerifyObject({ config, filePath: localPath, key });
    uploaded.push({
      key: remote.key,
      category,
      bytes: remote.bytes,
      sha256: remote.sha256,
      contentType: contentTypeFor(filename) ?? remote.contentType,
      urlStrategy: remote.strategy,
      url: remote.url,
      signedUrlTtlSeconds: remote.signedUrlTtlSeconds,
    });
  }

  const manifest = {
    provider: "cloudflare-r2",
    bucket: config.bucket,
    episodeSlug: slug,
    runId,
    generatedAt,
    deleteLocal: false,
    objects: uploaded,
  };

  const manifestPath = path.join(episodeDir, "assets.remote.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`migrate-tracked-assets: wrote ${manifestPath} (${uploaded.length} objects)`);
}
