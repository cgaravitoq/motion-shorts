#!/usr/bin/env bun
/**
 * Dev wrapper. Defaults to previewing src/episodes/catalog-components-lab (the cleanest
 * baseline) but accepts any episode dir as a positional arg.
 *
 *   bun run dev                            # previews src/episodes/catalog-components-lab
 *   bun run dev src/episodes/demo-explainer-blocks      # previews a specific episode
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const arg = process.argv[2];
const dir = arg ? path.resolve(arg) : path.resolve("src/episodes/catalog-components-lab");

if (!fs.existsSync(path.join(dir, "index.html"))) {
  console.error(`dev: ${dir}/index.html not found`);
  process.exit(1);
}

const result = spawnSync("bunx", ["hyperframes", "preview", dir], {
  stdio: "inherit",
});
process.exit(result.status ?? 0);
