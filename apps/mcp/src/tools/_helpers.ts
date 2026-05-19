import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const success = (body: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
});

export const failure = (error: unknown): CallToolResult => {
  const message = error instanceof Error ? error.message : String(error);
  const code = Number(message.match(/API (\d+)/)?.[1]);
  const details =
    error instanceof Error && "failures" in error
      ? { failures: (error as { failures: unknown }).failures }
      : {};

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { ok: false, error: message, ...(Number.isFinite(code) ? { code } : {}), ...details },
          null,
          2,
        ),
      },
    ],
  };
};
