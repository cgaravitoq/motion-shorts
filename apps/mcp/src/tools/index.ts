import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { generateAudioTool } from "./generate-audio";
import { getVisualComponentTool } from "./get-visual-component";
import { lintHtmlTool } from "./lint-html";
import { listVisualComponentsTool } from "./list-visual-components";
import { recommendVisualComponentsTool } from "./recommend-visual-components";
import { renderCompositionTool } from "./render-composition";
import { validateEpisodeCatalogContractTool } from "./validate-episode-catalog-contract";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  handler: (input: unknown) => Promise<CallToolResult>;
};

const tools = [
  lintHtmlTool,
  generateAudioTool,
  renderCompositionTool,
  listVisualComponentsTool,
  getVisualComponentTool,
  recommendVisualComponentsTool,
  validateEpisodeCatalogContractTool,
];

export const registerTools = (server: Server): void => {
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(({ name }) => name === request.params.name);

    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: false, error: `Unknown tool: ${request.params.name}` }),
          },
        ],
      };
    }

    return tool.handler(request.params.arguments ?? {});
  });
};

export {
  generateAudioTool,
  getVisualComponentTool,
  lintHtmlTool,
  listVisualComponentsTool,
  recommendVisualComponentsTool,
  renderCompositionTool,
  validateEpisodeCatalogContractTool,
};
