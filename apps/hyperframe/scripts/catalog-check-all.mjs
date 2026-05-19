#!/usr/bin/env bun
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { CatalogManifestSchema, checkEpisode } from "@cgaravitoq/catalog";
import manifestJson from "../../../packages/catalog/manifest.json";

const episodesDir = path.resolve("src/episodes");
let failed = false;
const manifest = CatalogManifestSchema.parse(manifestJson);

for (const name of readdirSync(episodesDir).sort()) {
  if (name.startsWith("_")) continue;

  const episodeDir = path.join(episodesDir, name);
  if (!statSync(episodeDir).isDirectory()) continue;

  const htmlPath = path.join(episodeDir, "index.html");
  if (!existsSync(htmlPath)) continue;

  const result = checkEpisode(htmlPath, manifest);
  if (result.ok) {
    console.log(`${htmlPath}: catalog check passed`);
    continue;
  }

  failed = true;
  for (const item of result.failures) {
    console.error(`${item.episode}: ${item.rule}: ${item.fix}`);
  }
}

if (failed) process.exit(1);
