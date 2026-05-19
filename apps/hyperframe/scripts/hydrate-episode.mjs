#!/usr/bin/env bun
import path from "node:path";
import { parseArgs } from "node:util";
import { hydrateEpisodeArtifacts } from "./lib/r2-artifacts.mjs";

const HELP = `Usage: bun run scripts/hydrate-episode.mjs <slug> --manifest=render|assets|<path> [--output=<dir>]

Options:
  --manifest=render|assets|<path>  Manifest to hydrate. "render" resolves to
                                  src/episodes/<slug>/render.remote.json and
                                  "assets" resolves to assets.remote.json.
  --output=<dir>                   Destination directory. Default:
                                  src/episodes/<slug>/assets for assets,
                                  renders for render manifests.
  -h, --help                       Show this help.
`;

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(
    `hydrate-episode: must run from ${expectedCwd}, got ${process.cwd()}.\n` +
      "Hint: cd apps/hyperframe && bun run hydrate:episode <slug> --manifest=assets",
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    manifest: { type: "string" },
    output: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0 || !values.manifest) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const [slug] = positionals;
const episodeDir = path.resolve("src/episodes", slug);
const manifestPath =
  values.manifest === "render"
    ? path.join(episodeDir, "render.remote.json")
    : values.manifest === "assets"
      ? path.join(episodeDir, "assets.remote.json")
      : path.resolve(values.manifest);
const destinationDir =
  values.output ??
  (values.manifest === "assets" ? path.join(episodeDir, "assets") : path.resolve("renders"));

const restored = await hydrateEpisodeArtifacts({ manifestPath, destinationDir });
for (const restoredPath of restored) {
  console.log(`[hydrate-episode] restored ${restoredPath}`);
}
