import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  canonicalShortResource,
  compositionResources,
  readCanonicalShortResource,
  readCompositionResource,
} from "./resources";
import { registerTools } from "./tools";

export const createServer = (): Server => {
  const server = new Server(
    {
      name: "motion-shorts-mcp",
      version: "0.1.0",
    },
    {
      capabilities: { tools: {}, resources: {} },
    },
  );

  registerTools(server);

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [canonicalShortResource, ...compositionResources],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
    const compositionText = await readCompositionResource(params.uri);
    if (compositionText) {
      return {
        contents: [{ uri: params.uri, mimeType: "text/html", text: compositionText }],
      };
    }

    if (params.uri !== canonicalShortResource.uri) {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${params.uri}`);
    }

    const text = await readCanonicalShortResource();

    return {
      contents: [{ uri: params.uri, mimeType: "text/markdown", text }],
    };
  });

  return server;
};
