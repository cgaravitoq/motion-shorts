import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import manifestJson from "../manifest.json";
import { type CatalogEntry, CatalogManifestSchema } from "../src/schema";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const defaultOutputPath = join(
  repoRoot,
  ".agents",
  "skills",
  "canonical-short",
  "references",
  "inline-components-catalog.md",
);

const statusOrder = [
  "required",
  "first-class",
  "copy-paste",
  "experimental",
  "deprecated",
] as const;

function formatValue(value: string): string {
  return value.length > 0 ? `\`${value}\`` : "—";
}

function formatList(values: readonly string[]): string {
  return values.length > 0
    ? [...values]
        .sort()
        .map((value) => `\`${value}\``)
        .join(", ")
    : "—";
}

function entryLine(entry: CatalogEntry): string {
  const usageRule = entry.usageRules[0] ?? entry.timingGuidance;

  return [
    `- **${entry.id}**`,
    `type: \`${entry.type}\``,
    `intentTags: ${formatList(entry.intentTags)}`,
    `sourceDemo: ${formatValue(entry.sourceDemo)}`,
    `snippet: ${formatList(entry.snippetPaths)}`,
    `usage: ${usageRule}`,
  ].join("; ");
}

export function generateReferenceMarkdown(entries: readonly CatalogEntry[]): string {
  const lines = [
    "<!-- AUTO-GENERATED FROM packages/catalog/manifest.json — DO NOT EDIT -->",
    "# Inline components catalog",
    "",
    "Catalog-first reference generated from `packages/catalog/manifest.json`. Run `bun run --cwd packages/catalog build` to refresh it.",
    "",
  ];

  for (const status of statusOrder) {
    lines.push(`## ${status}`, "");
    const group = entries
      .filter((entry) => entry.status === status)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    if (group.length === 0) {
      lines.push("_No entries._", "");
      continue;
    }

    for (const entry of group) {
      lines.push(entryLine(entry));
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function writeReferenceMarkdown(outputPath = defaultOutputPath): Promise<void> {
  const manifest = CatalogManifestSchema.parse(manifestJson);
  await writeFile(outputPath, generateReferenceMarkdown(manifest));
}

if (import.meta.main) {
  await writeReferenceMarkdown(process.argv[2]);
}
