import { route, type CatalogIntent } from "../src/route";

const validIntents = new Set<CatalogIntent>(["informative", "data", "workflow", "social", "brand", "vfx"]);

function readValue(flag: string): string | undefined {
  const exactIndex = process.argv.indexOf(flag);
  if (exactIndex !== -1) {
    const next = process.argv[exactIndex + 1];
    if (next !== undefined && !next.startsWith("--")) {
      return next;
    }
    return undefined;
  }

  const prefix = `${flag}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const intentRaw = readValue("--intent");
if (intentRaw === undefined || !validIntents.has(intentRaw as CatalogIntent)) {
  throw new Error(`catalog route: --intent must be one of ${Array.from(validIntents).join(", ")}`);
}
const intent = intentRaw as CatalogIntent;

const tags = readValue("--tags")
  ?.split(",")
  .map((tag) => tag.trim())
  .filter(Boolean);
const source = readValue("--source");
const platform = readValue("--platform");
const density = readValue("--density");
const format = readValue("--format");
const assetKinds = readValue("--asset-kinds")
  ?.split(",")
  .map((tag) => tag.trim())
  .filter(Boolean);
const motionRoles = readValue("--motion-roles")
  ?.split(",")
  .map((tag) => tag.trim())
  .filter(Boolean);

console.log(
  JSON.stringify(
    route({
      intent,
      tags,
      source,
      platform: platform as never,
      density: density as never,
      format: format as never,
      assetKinds: assetKinds as never,
      motionRoles: motionRoles as never,
    }),
    null,
    2,
  ),
);
