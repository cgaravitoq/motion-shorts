import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CatalogEntry, CatalogEntrySchema, type CatalogManifest } from "./schema";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const componentsRoot = join(packageRoot, "components");
const manifestPath = join(packageRoot, "manifest.json");
const manifestTypesPath = join(packageRoot, "dist", "manifest.d.ts");

async function loadEntry(dirName: string): Promise<CatalogEntry> {
  const entryPath = join(componentsRoot, dirName, "entry.json");
  let raw: string;
  try {
    raw = await readFile(entryPath, "utf8");
  } catch (cause) {
    throw new Error(`catalog: failed to read ${entryPath}`, { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`catalog: invalid JSON in ${entryPath}`, { cause });
  }

  try {
    return CatalogEntrySchema.parse(parsed);
  } catch (cause) {
    throw new Error(`catalog: schema validation failed for ${entryPath}`, { cause });
  }
}

export async function buildManifest(): Promise<CatalogManifest> {
  const componentDirs = await readdir(componentsRoot, { withFileTypes: true });
  const manifest = (
    await Promise.all(
      componentDirs.filter((entry) => entry.isDirectory()).map((entry) => loadEntry(entry.name)),
    )
  ).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  await mkdir(dirname(manifestTypesPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    manifestTypesPath,
    'import type { CatalogManifest } from "../src/schema";\ndeclare const manifest: CatalogManifest;\nexport default manifest;\n',
  );

  return manifest;
}

if (import.meta.main) {
  await buildManifest();
}
