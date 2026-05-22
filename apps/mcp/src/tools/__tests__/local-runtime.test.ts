import { describe, expect, it, mock } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compliantBrandHtml } from "./catalog-fixtures";

const executeRenderJob = mock(async () => {
  throw new Error("simulated render failure");
});

mock.module("@hyperframes/producer", () => ({
  createRenderJob: mock(() => ({ status: "queued", progress: 0 })),
  executeRenderJob,
}));

const { renderCompositionToFile } = await import("../local-runtime");

const projectDirFor = (jobId: string) => join(tmpdir(), "motion-shorts-mcp", jobId);

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

describe("renderCompositionToFile temp dir cleanup", () => {
  it("removes the project dir when the render step throws", async () => {
    const jobId = `job_test_${crypto.randomUUID()}`;
    const outputDir = await mkdtemp(join(tmpdir(), "mcp-runtime-test-"));
    const outputPath = join(outputDir, "out.mp4");

    await expect(
      renderCompositionToFile({
        jobId,
        html: compliantBrandHtml,
        assets: [],
        format: "mp4",
        fps: 30,
        quality: "standard",
        outputPath,
      }),
    ).rejects.toThrow("simulated render failure");

    expect(await exists(projectDirFor(jobId))).toBe(false);

    await rm(outputDir, { recursive: true, force: true });
  });

  it("removes the project dir when materialiseProject throws on an invalid asset", async () => {
    const jobId = `job_test_${crypto.randomUUID()}`;
    const outputDir = await mkdtemp(join(tmpdir(), "mcp-runtime-test-"));
    const outputPath = join(outputDir, "out.mp4");

    await expect(
      renderCompositionToFile({
        jobId,
        html: compliantBrandHtml,
        assets: [{ name: "../escape.txt", data: "" }],
        format: "mp4",
        fps: 30,
        quality: "standard",
        outputPath,
      }),
    ).rejects.toThrow("Invalid asset path");

    expect(await exists(projectDirFor(jobId))).toBe(false);

    await rm(outputDir, { recursive: true, force: true });
  });
});
