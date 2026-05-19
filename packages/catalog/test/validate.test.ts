import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogEntrySchema } from "../src/schema";
import { validateCatalog } from "../src/validate";

const tempDirs: string[] = [];

const validEntry = {
  id: "fixture-card",
  type: "reference",
  status: "copy-paste",
  intentTags: ["informative"],
  sourceDemo: "",
  snippetPaths: [],
  requiredTracks: [],
  timingGuidance: "Fixture entry.",
  dependencies: [],
  usageRules: ["Use in tests."],
  validationRules: ["sourceDemo empty allowed only for reference entries"],
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("validateCatalog", () => {
  it("validates the checked-in catalog paths", async () => {
    await expect(validateCatalog()).resolves.toBeUndefined();
  });

  it("passes when fixture paths exist", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "catalog-validate-"));
    tempDirs.push(repoRoot);
    const componentsRoot = join(repoRoot, "components");
    const componentRoot = join(componentsRoot, "fixture-card");
    mkdirSync(componentRoot, { recursive: true });
    mkdirSync(join(repoRoot, "snippets"), { recursive: true });
    writeFileSync(join(repoRoot, "snippets", "fixture.html"), "<div></div>");
    writeFileSync(
      join(componentRoot, "entry.json"),
      JSON.stringify({
        ...validEntry,
        snippetPaths: ["snippets/fixture.html"],
      }),
    );

    await expect(validateCatalog({ repoRoot, componentsRoot })).resolves.toBeUndefined();
  });

  it("fails when fixture paths are missing", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "catalog-validate-"));
    tempDirs.push(repoRoot);
    const componentsRoot = join(repoRoot, "components");
    const componentRoot = join(componentsRoot, "fixture-card");
    mkdirSync(componentRoot, { recursive: true });
    writeFileSync(
      join(componentRoot, "entry.json"),
      JSON.stringify({
        ...validEntry,
        snippetPaths: ["snippets/missing.html"],
      }),
    );

    await expect(validateCatalog({ repoRoot, componentsRoot })).rejects.toThrow();
  });

  it("keeps fixture entries compatible with the catalog schema", () => {
    expect(CatalogEntrySchema.parse(validEntry)).toEqual(validEntry);
  });
});
