#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateReferenceMarkdown } from "../packages/catalog/scripts/generate-reference-md.ts";
import { catalogManifest } from "../packages/catalog/src/manifest.ts";

const outputPath =
  process.argv[2] ??
  join(
    import.meta.dirname,
    "..",
    ".agents",
    "skills",
    "canonical-short",
    "references",
    "inline-components-catalog.md",
  );

await writeFile(outputPath, generateReferenceMarkdown(catalogManifest));
