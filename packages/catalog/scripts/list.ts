import manifest from "../manifest.json";
import { filterBySafeForFormat, type CatalogSafeForFormat } from "../src";

const usage = "Usage: bun run catalog:list [--format=short|desktop-1080p]";
const formatArg = process.argv.find((arg) => arg.startsWith("--format="));
const format = (formatArg?.split("=")[1] ?? "short") as CatalogSafeForFormat;

if (format !== "short" && format !== "desktop-1080p") {
  console.error(usage);
  process.exit(1);
}

for (const entry of filterBySafeForFormat(manifest, format)) {
  console.log(`${entry.id}\t${entry.type}\t${entry.status}\t${entry.intentTags.join(",")}`);
}
