import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compliantBrandHtml } from "./catalog-fixtures";

const executeRenderJob = mock(async (_job: unknown, _projectDir: string, outputPath: string) => {
  await writeFile(outputPath, "video-bytes");
});

mock.module("@hyperframes/producer", () => ({
  createRenderJob: mock(() => ({ status: "queued", progress: 0 })),
  executeRenderJob,
}));

mock.module("@cgaravitoq/audio", () => ({
  getAudioDurationSeconds: mock(async () => 1),
}));

const { renderCompositionTool } = await import("../render-composition");

const text = (result: Awaited<ReturnType<typeof renderCompositionTool.handler>>) => {
  const content = result.content[0];
  return JSON.parse(content?.type === "text" ? content.text : "{}");
};

describe("render_composition", () => {
  let outputDir: string;

  beforeEach(async () => {
    executeRenderJob.mockClear();
    outputDir = await mkdtemp(join(tmpdir(), "mcp-render-test-"));
    Bun.env.MCP_OUTPUT_DIR = outputDir;
  });

  it("renders to a local output file", async () => {
    const result = await renderCompositionTool.handler({
      html: compliantBrandHtml,
      format: "mp4",
      fps: 30,
      quality: "standard",
    });

    expect(result.isError).toBeUndefined();
    const body = text(result);
    expect(body.jobId).toStartWith("job_");
    expect(body.outputPath).toStartWith(outputDir);
    expect(body.outputPath).toEndWith(".mp4");
    expect(body.outputBytes).toBe(11);
    expect(body.outputDurationSec).toBe(1);
    expect(executeRenderJob).toHaveBeenCalledTimes(1);

    await rm(outputDir, { recursive: true, force: true });
  });

  it("returns catalog check failures before rendering", async () => {
    const result = await renderCompositionTool.handler({
      html: compliantBrandHtml.replace("brand-logo-outro", ""),
    });

    expect(result.isError).toBe(true);
    expect(text(result).error).toContain("catalog-check-failed");
    expect(executeRenderJob).not.toHaveBeenCalled();

    await rm(outputDir, { recursive: true, force: true });
  });
});
