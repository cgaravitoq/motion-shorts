import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type CatalogEntry, manifest, repoRoot } from "@cgaravitoq/catalog";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";

const inputSchema = z.object({
  id: z.string().min(1),
});

const jsonSchema = {
  type: "object" as const,
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
};

const notFound = (id: string): CallToolResult => ({
  isError: true,
  content: [
    {
      type: "text",
      text: JSON.stringify(
        { ok: false, code: 404, error: `Unknown catalog component: ${id}` },
        null,
        2,
      ),
    },
  ],
});

export const getVisualComponent = async (id: string) => {
  const entry = manifest.find((candidate: CatalogEntry) => candidate.id === id);
  if (!entry) return undefined;

  const snippets = await Promise.all(
    entry.snippetPaths.map(async (path) => ({
      path,
      html: await readFile(resolve(repoRoot(), path), "utf8"),
    })),
  );

  return { ...entry, snippets };
};

export const getVisualComponentTool: ToolDefinition = {
  name: "get_visual_component",
  description: "Get a full visual catalog component by id with all snippet HTML inlined.",
  inputSchema: jsonSchema,
  async handler(input) {
    try {
      const { id } = inputSchema.parse(input);
      const component = await getVisualComponent(id);
      return component ? success(component) : notFound(id);
    } catch (error) {
      return failure(error);
    }
  },
};
