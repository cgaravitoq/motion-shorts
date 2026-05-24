import manifest from "../manifest.json";
import { filterBySafeForFormat, type CatalogSafeForFormat } from "../src";

const usage = "Usage: bun run catalog:list [--format=short|desktop-1080p|desktop-4k|square-1080]";
const formatArg = process.argv.find((arg) => arg.startsWith("--format="));
const format = (formatArg?.split("=")[1] ?? "short") as CatalogSafeForFormat;

const VALID_FORMATS = ["short", "desktop-1080p", "desktop-4k", "square-1080"] as const;

if (!VALID_FORMATS.includes(format as (typeof VALID_FORMATS)[number])) {
  console.error(usage);
  process.exit(1);
}

for (const entry of filterBySafeForFormat(manifest, format)) {
  console.log(`${entry.id}\t${entry.type}\t${entry.status}\t${entry.intentTags.join(",")}`);
}
