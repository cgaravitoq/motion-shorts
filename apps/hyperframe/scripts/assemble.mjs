#!/usr/bin/env bun
/**
 * Assemble an episode's index.html from its scene-spec.json.
 *
 *   bun run scripts/assemble.mjs <slug> [--print]
 *
 * Reads  src/episodes/<slug>/scene-spec.json
 * Writes src/episodes/<slug>/index.html   (unless --print)
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { assembleEpisode } from "./lib/assemble-episode.mjs";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`assemble: must run from ${expectedCwd}. Hint: cd apps/hyperframe && bun run assemble <slug>`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: { print: { type: "boolean", default: false } },
  allowPositionals: true,
});

const [slug] = positionals;
if (!slug) {
  console.error("assemble: missing <slug>");
  process.exit(1);
}

const episodeDir = path.resolve("src/episodes", slug);
const specPath = path.join(episodeDir, "scene-spec.json");
if (!fs.existsSync(specPath)) {
  console.error(`assemble: no scene-spec.json at ${path.relative(process.cwd(), specPath)}`);
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
if (!spec.slug) spec.slug = slug;

let result;
try {
  result = assembleEpisode(spec);
} catch (err) {
  console.error(`assemble: ${err.message}`);
  process.exit(1);
}

if (values.print) {
  process.stdout.write(result.html);
  process.exit(0);
}

fs.writeFileSync(path.join(episodeDir, "index.html"), result.html);
for (const w of result.warnings) console.warn(`[assemble] WARN: ${w}`);
console.log(
  `[assemble] wrote ${path.relative(process.cwd(), path.join(episodeDir, "index.html"))} ` +
    `(${result.scenes.length} scenes, total=${result.totalDuration}s)`,
);
console.table(result.scenes);
