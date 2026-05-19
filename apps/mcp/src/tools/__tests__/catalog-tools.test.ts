import { describe, expect, it } from "bun:test";
import { getVisualComponentTool } from "../get-visual-component";
import { listVisualComponentsTool } from "../list-visual-components";
import { recommendVisualComponentsTool } from "../recommend-visual-components";
import { validateEpisodeCatalogContractTool } from "../validate-episode-catalog-contract";
import { compliantBrandHtml } from "./catalog-fixtures";

const text = (result: Awaited<ReturnType<typeof listVisualComponentsTool.handler>>) => {
  const content = result.content[0];
  return JSON.parse(content?.type === "text" ? content.text : "{}");
};

describe("catalog MCP tools", () => {
  it("lists visual components with and without filters", async () => {
    const all = text(await listVisualComponentsTool.handler({}));
    const filtered = text(
      await listVisualComponentsTool.handler({
        status: "required",
        type: "brand",
        intentTags: ["brand"],
      }),
    );

    expect(all.length).toBeGreaterThan(filtered.length);
    expect(filtered.map((entry: { id: string }) => entry.id)).toContain("brand-logo-watermark");
    expect(
      filtered.every(
        (entry: { status: string; type: string }) =>
          entry.status === "required" && entry.type === "brand",
      ),
    ).toBe(true);
    expect(filtered[0].snippetPaths).toBeUndefined();
  });

  it("gets visual component snippets and returns 404-shaped unknown id errors", async () => {
    const known = text(await getVisualComponentTool.handler({ id: "brand-logo-watermark" }));
    const unknown = await getVisualComponentTool.handler({ id: "missing-component" });

    expect(known.id).toBe("brand-logo-watermark");
    expect(known.snippets[0].html.length).toBeGreaterThan(0);
    expect(unknown.isError).toBe(true);
    expect(text(unknown).code).toBe(404);
  });

  it("recommends data visual components through the catalog router", async () => {
    const result = text(
      await recommendVisualComponentsTool.handler({ intent: "data", tags: ["workflow"] }),
    );

    expect(result.skillPath).toBe(".agents/skills/short-data-visual");
    expect(result.requiredComponents.map((entry: { id: string }) => entry.id)).toEqual([
      "brand-logo-outro",
      "brand-logo-watermark",
    ]);
    expect(result.recommendedComponents.map((entry: { id: string }) => entry.id)).toContain(
      "data-chart",
    );
    expect(result.recommendedComponents.map((entry: { id: string }) => entry.id)).toContain(
      "flowchart",
    );
  });

  it("validates in-memory episode catalog contracts", async () => {
    const ok = text(await validateEpisodeCatalogContractTool.handler({ html: compliantBrandHtml }));
    const failed = text(
      await validateEpisodeCatalogContractTool.handler({
        html: compliantBrandHtml.replace("brand-logo-outro", ""),
      }),
    );

    expect(ok).toEqual({ ok: true, failures: [] });
    expect(failed.ok).toBe(false);
    expect(failed.failures.map((failure: { rule: string }) => failure.rule)).toContain(
      "required-component",
    );
  });
});
