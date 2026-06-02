import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { assembleEpisodeTool } from "./assemble-episode";
import { generateAudioTool } from "./generate-audio";
import { getSceneTypeTool } from "./get-scene-type";
import { lintHtmlTool } from "./lint-html";
import { listSceneTypesTool } from "./list-scene-types";
import { recommendSceneTypesTool } from "./recommend-scene-types";
import { renderCompositionTool } from "./render-composition";
import { sceneQaTool } from "./scene-qa";
import { validateSceneSpecTool } from "./validate-scene-spec";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  handler: (input: unknown) => Promise<CallToolResult>;
};

const tools = [
  // scene-hub authoring surface
  listSceneTypesTool,
  getSceneTypeTool,
  recommendSceneTypesTool,
  validateSceneSpecTool,
  assembleEpisodeTool,
  sceneQaTool,
  // shared media tools
  lintHtmlTool,
  generateAudioTool,
  renderCompositionTool,
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
  assembleEpisodeTool,
  generateAudioTool,
  getSceneTypeTool,
  lintHtmlTool,
  listSceneTypesTool,
  recommendSceneTypesTool,
  renderCompositionTool,
  sceneQaTool,
  validateSceneSpecTool,
};
