import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

export const success = (body: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
});

const formatZodError = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      const allowed = "values" in issue && Array.isArray(issue.values) ? issue.values : undefined;
      const suffix = allowed ? ` (allowed: ${allowed.join(" | ")})` : "";
      return `${path}: ${issue.message}${suffix}`;
    })
    .join("\n");

export const failure = (error: unknown): CallToolResult => {
  const message = error instanceof ZodError ? formatZodError(error) : error instanceof Error ? error.message : String(error);
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
