#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { resolveBgmPath } from "@cgaravitoq/audio";

const HELP = `Usage: bun run scripts/hydrate-bgm.ts <name> [<name>...]

Hydrate shared R2 BGM tracks from bgm/<name>.mp3 into the local cache.

Options:
  -h, --help  Show this help.
`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

for (const name of positionals) {
  try {
    const bgmPath = await resolveBgmPath(`bgm:${name}`);
    console.log(`[hydrate-bgm] cached ${name} at ${bgmPath}`);
  } catch (err) {
    console.error(`[hydrate-bgm] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
