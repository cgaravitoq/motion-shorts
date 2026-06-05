#!/usr/bin/env bun
/**
 * Print the resolved distribution context for an episode as JSON.
 *
 *   bun run scripts/episode-context.mjs <slug>
 *
 * Consumed by the generate-distribution-copy skill: narration, scene-spec
 * text, captions duration, and the rendered-mp4 pin in one place.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveEpisodeContext } from "./lib/episode-context.mjs";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`episode-context: must run from ${expectedCwd}`);
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  console.error("usage: bun run scripts/episode-context.mjs <slug>");
  process.exit(1);
}
if (!fs.existsSync(path.join("src/episodes", slug))) {
  console.error(`episode-context: no episode at src/episodes/${slug}`);
  process.exit(1);
}

console.log(JSON.stringify(resolveEpisodeContext(slug), null, 2));
