#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type AssembledEpisode, assembleEpisode, type EpisodeFormat } from "./lib/assemble-episode";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(
    `assemble: must run from ${expectedCwd}. Hint: cd apps/hyperframe && bun run assemble <slug>`,
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    print: { type: "boolean", default: false },
    format: { type: "string", default: "short" },
  },
  allowPositionals: true,
});

const [slug] = positionals;
if (!slug) {
  console.error("assemble: missing <slug>");
  process.exit(1);
}

if (values.format !== "short" && values.format !== "desktop") {
  console.error(`assemble: --format must be "short" or "desktop", got "${values.format}"`);
  process.exit(1);
}
const format = values.format as EpisodeFormat;
const indexFilename = format === "desktop" ? "index.desktop.html" : "index.html";

const episodeDir = path.resolve("src/episodes", slug);
const specPath = path.join(episodeDir, "scene-spec.json");
if (!fs.existsSync(specPath)) {
  console.error(`assemble: no scene-spec.json at ${path.relative(process.cwd(), specPath)}`);
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf8")) as { slug?: string };
if (!spec.slug) spec.slug = slug;

let result: AssembledEpisode;
try {
  result = assembleEpisode(spec, { format });
} catch (err) {
  console.error(`assemble: ${(err as Error).message}`);
  process.exit(1);
}

if (values.print) {
  process.stdout.write(result.html);
  process.exit(0);
}

fs.writeFileSync(path.join(episodeDir, indexFilename), result.html);
for (const w of result.warnings) console.warn(`[assemble] WARN: ${w}`);
console.log(
  `[assemble] wrote ${path.relative(process.cwd(), path.join(episodeDir, indexFilename))} ` +
    `(${result.scenes.length} scenes, total=${result.totalDuration}s)`,
);
console.table(result.scenes);
