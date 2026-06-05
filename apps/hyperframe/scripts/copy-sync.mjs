#!/usr/bin/env bun
/**
 * Push an episode's distribution.json to R2 and update the source manifest.
 *
 *   bun run copy:sync <slug>
 *
 * Copy approvals happen after the render was published, so the sidecar
 * drifts from the R2 final until re-synced. This uploads ONLY
 * distribution.json (PUT-overwrite) and patches source.remote.json locally
 * and in R2 — no re-render, no full re-publish.
 */
import fs from "node:fs";
import path from "node:path";
import {
  assertR2Config,
  loadWorkspaceEnv,
  objectKeyFor,
  uploadAndVerifyObject,
} from "./lib/r2-artifacts";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`copy-sync: must run from ${expectedCwd}`);
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  console.error("usage: bun run copy:sync <slug>");
  process.exit(1);
}

const episodeDir = path.join("src/episodes", slug);
const distPath = path.join(episodeDir, "distribution.json");
const manifestPath = path.join(episodeDir, "source.remote.json");
if (!fs.existsSync(distPath)) {
  console.error(`copy-sync: no distribution.json at ${distPath}`);
  process.exit(1);
}
if (!fs.existsSync(manifestPath)) {
  console.error(
    `copy-sync: no source.remote.json at ${manifestPath} — publish the episode first (render:episode --upload=r2)`,
  );
  process.exit(1);
}

loadWorkspaceEnv();
const config = assertR2Config(Bun.env);

const key = objectKeyFor({ slug, category: "source", filename: "distribution.json" });
const remote = await uploadAndVerifyObject({ config, filePath: distPath, key });

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entry = {
  key,
  category: "source",
  path: `src/episodes/${slug}/distribution.json`,
  bytes: remote.bytes,
  sha256: remote.sha256,
  contentType: remote.contentType,
  urlStrategy: remote.strategy,
  url: remote.url,
  signedUrlTtlSeconds: remote.signedUrlTtlSeconds,
};
const objects = manifest.objects ?? [];
const existing = objects.findIndex((o) => o.key === key);
if (existing >= 0) objects[existing] = entry;
else objects.push(entry);
manifest.objects = objects;
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

await uploadAndVerifyObject({
  config,
  filePath: manifestPath,
  key: objectKeyFor({ slug, category: "manifests", filename: "source.remote.json" }),
});

console.log(
  `✓ synced ${distPath} → ${key} (${remote.bytes} bytes, sha256 ${remote.sha256.slice(0, 12)}…)`,
);
