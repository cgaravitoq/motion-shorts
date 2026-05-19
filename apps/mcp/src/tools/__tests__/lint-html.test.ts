import { describe, expect, it, mock } from "bun:test";

const lintHyperframeHtml = mock(async () => ({
  errorCount: 1,
  warningCount: 1,
  findings: [
    { code: "missing-timeline", severity: "error", message: "Missing timeline", line: 10 },
    { code: "minor", severity: "warning", message: "Minor issue", column: 4 },
    { code: "note", severity: "info", message: "Internal note" },
  ],
}));

mock.module("@hyperframes/core", () => ({
  lintHyperframeHtml,
}));

const { lintHtmlTool } = await import("../lint-html");

describe("lint_html", () => {
  it("returns the public linter response shape", async () => {
    const result = await lintHtmlTool.handler({ html: "<html></html>" });
    const content = result.content[0];
    const body = JSON.parse(content?.type === "text" ? content.text : "{}");

    expect(lintHyperframeHtml).toHaveBeenCalledWith("<html></html>");
    expect(body).toEqual({
      ok: false,
      errorCount: 1,
      warningCount: 1,
      findings: [
        { rule: "missing-timeline", severity: "error", message: "Missing timeline", line: 10 },
        { rule: "minor", severity: "warning", message: "Minor issue", column: 4 },
      ],
    });
  });
});
