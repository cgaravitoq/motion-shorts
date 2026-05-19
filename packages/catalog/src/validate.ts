import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CatalogEntry, CatalogEntrySchema } from "./schema";

const defaultRepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPackageRoot = join(defaultRepoRoot, "packages/catalog");
const defaultComponentsRoot = join(defaultPackageRoot, "components");

async function assertExists(repoRoot: string, path: string): Promise<void> {
  await access(join(repoRoot, path));
}

async function loadEntry(componentsRoot: string, dirName: string): Promise<CatalogEntry> {
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

export async function validateCatalog({
  repoRoot = defaultRepoRoot,
  componentsRoot = defaultComponentsRoot,
}: {
  repoRoot?: string;
  componentsRoot?: string;
} = {}): Promise<void> {
  const componentDirs = await readdir(componentsRoot, { withFileTypes: true });

  await Promise.all(
    componentDirs
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const catalogEntry = await loadEntry(componentsRoot, entry.name);

        if (catalogEntry.sourceDemo !== "") {
          await assertExists(repoRoot, catalogEntry.sourceDemo);
        }

        await Promise.all(catalogEntry.snippetPaths.map((path) => assertExists(repoRoot, path)));
      }),
  );
}
