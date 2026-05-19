import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEpisode, manifest } from "@cgaravitoq/catalog";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";

const inputSchema = z.object({
  html: z.string().min(1),
});

const jsonSchema = {
  type: "object" as const,
  properties: { html: { type: "string", minLength: 1 } },
  required: ["html"],
};

export const validateEpisodeCatalogContract = async (html: string) => {
  const dir = await mkdtemp(join(tmpdir(), "catalog-contract-"));
  const path = join(dir, "index.html");

  try {
    await writeFile(path, html, "utf8");
    const result = checkEpisode(path, manifest);
    return {
      ok: result.ok,
      failures: result.failures.map(({ rule, fix }) => ({
        rule,
        severity: "error" as const,
        message: fix,
        fix,
      })),
    };
  } finally {
    await unlink(path).catch(() => undefined);
    await rmdir(dir).catch(() => undefined);
  }
};

export const validateEpisodeCatalogContractTool: ToolDefinition = {
  name: "validate_episode_catalog_contract",
  description: "Validate an in-memory episode HTML string against the visual catalog contract.",
  inputSchema: jsonSchema,
  async handler(input) {
    try {
      const { html } = inputSchema.parse(input);
      return success(await validateEpisodeCatalogContract(html));
    } catch (error) {
      return failure(error);
    }
  },
};
