#!/usr/bin/env bun
/**
 * Validate distribution.json files against the distribution spec and the
 * episode's rendered-mp4 pin.
 *
 *   bun run copy:check                          # all episodes with a distribution.json
 *   bun run copy:check <file> [<file> ...]      # specific files
 *
 * Exits non-zero if any file is invalid.
 */
import fs from "node:fs";
import path from "node:path";
import { validateDistribution } from "./lib/distribution-spec";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`copy-check: must run from ${expectedCwd}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const distPaths =
  args.length > 0
    ? args.map((p) => path.resolve(p))
    : fs
        .readdirSync("src/episodes", { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.resolve("src/episodes", d.name, "distribution.json"))
        .filter((p) => fs.existsSync(p));

if (distPaths.length === 0) {
  console.log("copy-check: no distribution.json files found");
  process.exit(0);
}

const renderSha256For = (episodeDir) => {
  const manifestPath = path.join(episodeDir, "render.remote.json");
  if (!fs.existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return manifest.objects?.find((o) => o.category === "renders" && o.contentType === "video/mp4")
      ?.sha256;
  } catch {
    return undefined;
  }
};

let failed = 0;
for (const distPath of distPaths) {
  const rel = path.relative(expectedCwd, distPath);
  let dist;
  try {
    dist = JSON.parse(fs.readFileSync(distPath, "utf8"));
  } catch (err) {
    console.error(`✗ ${rel}: ${err.message}`);
    failed++;
    continue;
  }

  const episodeDir = path.dirname(distPath);
  const dirSlug = path.basename(episodeDir);
  const { ok, errors, warnings } = validateDistribution(dist, {
    renderSha256: renderSha256For(episodeDir),
  });
  if (dist.slug !== dirSlug) {
    errors.push(`slug "${dist.slug}" does not match episode dir "${dirSlug}"`);
  }

  if (ok && dist.slug === dirSlug) {
    console.log(`✓ ${rel}${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
    for (const w of warnings) console.log(`    ⚠ ${w}`);
  } else {
    console.error(`✗ ${rel}`);
    for (const e of errors) console.error(`    ${e}`);
    for (const w of warnings) console.error(`    ⚠ ${w}`);
    failed++;
  }
}

console.log(`\n${distPaths.length - failed}/${distPaths.length} distribution files valid`);
process.exit(failed > 0 ? 1 : 0);
