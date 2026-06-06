import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Schema, SchemaIssue } from "effect";

export const success = (body: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
});

const standardFormatter = SchemaIssue.makeFormatterStandardSchemaV1();

const formatSchemaError = (error: Schema.SchemaError): string =>
  standardFormatter(error.issue)
    .issues.map((issue) => {
      const path = issue.path?.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("\n");

export const failure = (error: unknown): CallToolResult => {
  const message = Schema.isSchemaError(error)
    ? formatSchemaError(error)
    : error instanceof Error
      ? error.message
      : String(error);
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
