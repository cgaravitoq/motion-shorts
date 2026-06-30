#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { validateSceneSpec } from "./lib/scene-spec";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`scene-check-all: must run from ${expectedCwd}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const specPaths =
  args.length > 0
    ? args.map((p) => path.resolve(p))
    : fs
        .readdirSync("src/episodes", { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.resolve("src/episodes", d.name, "scene-spec.json"))
        .filter((p) => fs.existsSync(p));

let failed = 0;
for (const specPath of specPaths) {
  const rel = path.relative(expectedCwd, specPath);
  let spec: unknown;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch (err) {
    console.error(`✗ ${rel}: ${(err as Error).message}`);
    failed++;
    continue;
  }
  const { ok, errors, warnings } = validateSceneSpec(spec);
  if (ok) {
    console.log(`✓ ${rel}${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
  } else {
    console.error(`✗ ${rel}`);
    for (const e of errors) console.error(`    ${e}`);
    failed++;
  }
}

console.log(`\n${specPaths.length - failed}/${specPaths.length} scene-specs valid`);
process.exit(failed > 0 ? 1 : 0);
