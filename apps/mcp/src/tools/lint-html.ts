import { lintHyperframeHtml } from "@hyperframes/core";
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

type HyperframeFinding = Awaited<ReturnType<typeof lintHyperframeHtml>>["findings"][number];
type PublicHyperframeFinding = HyperframeFinding & {
  severity: "error" | "warning";
  line?: number;
  column?: number;
};

const isPublicFinding = (finding: HyperframeFinding): finding is PublicHyperframeFinding =>
  finding.severity !== "info";

const toFinding = (finding: PublicHyperframeFinding) => ({
  rule: finding.code,
  severity: finding.severity,
  message: finding.message,
  ...(finding.line !== undefined ? { line: finding.line } : {}),
  ...(finding.column !== undefined ? { column: finding.column } : {}),
});

export const lintHtmlTool: ToolDefinition = {
  name: "lint_html",
  description:
    "Validate Hyperframes HTML syntax and rules synchronously. Use this before calling render_composition to catch issues like missing window.__timelines registry, non-deterministic timeouts, or unsupported tracker syntax. Returns `{ ok, errorCount, warningCount, findings }`. `findings[]` includes rule name, severity, message, and optional line/column.",
  inputSchema: jsonSchema,
  async handler(input) {
    try {
      const { html } = inputSchema.parse(input);
      const result = await lintHyperframeHtml(html);
      return success({
        ok: result.errorCount === 0,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        findings: result.findings.filter(isPublicFinding).map(toFinding),
      });
    } catch (error) {
      return failure(error);
    }
  },
};
