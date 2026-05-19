#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { listEpisodeTemplates } from "./lib/template-instantiator.mjs";

for (const templateId of listEpisodeTemplates()) {
  const [family] = templateId.split("@");
  const version = templateId.split("@")[1];
  const manifestPath = path.resolve("templates", family, `v${version}`, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const recommended = manifest.recommendedCatalogIds?.length
    ? `\trecommended=${manifest.recommendedCatalogIds.join(",")}`
    : "";
  console.log(
    `${manifest.id}\t${manifest.status}\t${manifest.description}\tcatalog=${manifest.catalogIds.join(",")}${recommended}`,
  );
}
