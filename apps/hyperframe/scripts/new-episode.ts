#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { assembleEpisode } from "./lib/assemble-episode";
import { env } from "./lib/env";
import { INTENTS, routeIntent } from "./lib/scene-router";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(
    `new-episode: must run from ${expectedCwd}, got ${process.cwd()}.\n` +
      "Hint: cd apps/hyperframe && bun run new:episode <slug>",
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    intent: { type: "string" },
    width: { type: "string", default: "1080" },
    height: { type: "string", default: "1920" },
    slug: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || (positionals.length === 0 && !values.slug)) {
  console.log(`Usage: bun run scripts/new-episode.ts <slug> [options]

Options:
  --intent=<intent>  Seed the scene-spec from an intent skeleton.
                     One of: ${INTENTS.join(", ")}. Default: a generic
                     hook -> title-cards -> outro starter.
  --width=<px>       Stage width.  Default 1080.
  --height=<px>      Stage height. Default 1920.
  --slug=<slug>      Episode slug (alternative to the positional).

After scaffold:
  1. Edit src/episodes/<slug>/scene-spec.json (fill slots; pick scene-types).
  2. bun run assemble <slug>        # regenerate index.html
  3. bun run scripts/scene-qa.ts <slug>   # per-scene snapshot + inspect
  4. Drop assets/voice.mp3 + assets/captions.json, then render:episode <slug>.
`);
  process.exit(values.help ? 0 : 1);
}

const slug = (values.slug ?? positionals[0]) as string;
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(`new-episode: slug must be lowercase kebab-case, got "${slug}"`);
  process.exit(1);
}
if (values.intent && !INTENTS.includes(values.intent)) {
  console.error(`new-episode: --intent must be one of ${INTENTS.join(", ")}`);
  process.exit(1);
}

const epDir = path.resolve("src/episodes", slug);
if (fs.existsSync(epDir) && fs.readdirSync(epDir).length > 0) {
  console.error(`new-episode: ${epDir} already exists and is non-empty`);
  process.exit(1);
}
fs.mkdirSync(path.join(epDir, "assets"), { recursive: true });

const width = Number.parseInt(values.width, 10);
const height = Number.parseInt(values.height, 10);

const skeleton: ReadonlyArray<string> = values.intent
  ? routeIntent(values.intent).skeleton
  : ["hook", "title-cards", "outro"];
const sampleFor = (type: string): Record<string, unknown> => {
  const samplePath = path.resolve("templates/scenes", type, "v1", "sample.json");
  return fs.existsSync(samplePath)
    ? (JSON.parse(fs.readFileSync(samplePath, "utf8")) as Record<string, unknown>)
    : {};
};
const brandSlots: Record<string, string> = {};
if (env.BRAND_NAME) brandSlots.wordmark = env.BRAND_NAME;
if (env.BRAND_TAGLINE) brandSlots.tagline = env.BRAND_TAGLINE;

const counts: Record<string, number> = {};
const scenes = skeleton.map((type) => {
  counts[type] = (counts[type] ?? 0) + 1;
  const id = (counts[type] as number) > 1 ? `${type}-${counts[type]}` : type;
  const slots = type === "outro" ? { ...sampleFor(type), ...brandSlots } : sampleFor(type);
  return { id, type, slots };
});

const spec = {
  slug,
  lang: "es",
  width,
  height,
  palette: { accent: "#5b6cff", accent2: "#e9ff00" },
  scenes,
};

const built = assembleEpisode(spec);

fs.writeFileSync(path.join(epDir, "scene-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
fs.writeFileSync(path.join(epDir, "index.html"), built.html);
fs.writeFileSync(
  path.join(epDir, "meta.json"),
  `${JSON.stringify({ id: slug, name: slug, description: "", tail: 3 }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(epDir, "hyperframes.json"),
  `${JSON.stringify(
    {
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      paths: { assets: "assets" },
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(path.join(epDir, "assets", ".gitkeep"), "");

const libLink = path.join(epDir, "lib");
try {
  fs.lstatSync(libLink);
  fs.rmSync(libLink, { force: true, recursive: true });
} catch {}
fs.symlinkSync(path.relative(epDir, path.resolve("src/lib")), libLink, "dir");

console.log(`Created ${epDir}/  (${width}x${height}, intent=${values.intent ?? "generic"})`);
console.log(
  `  scene-spec.json  (${scenes.length} scenes: ${scenes.map((s) => s.type).join(" -> ")})`,
);
console.log(`  index.html       (generated, total=${built.totalDuration}s)`);
console.log("  meta.json, hyperframes.json, assets/, lib -> ../../lib");
console.log("\nNext steps:");
console.log(
  `  1. Edit ${path.relative(process.cwd(), path.join(epDir, "scene-spec.json"))} (slots + scene-types)`,
);
console.log(`  2. bun run assemble ${slug}`);
console.log(`  3. bun run scripts/scene-qa.ts ${slug}   # per-scene review`);
console.log(`  4. add assets/voice.mp3 + captions.json, then bun run render:episode ${slug}`);
