import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { manifest as catalogManifest, checkEpisode } from "@cgaravitoq/catalog";

type ProducerRenderStatus =
  | "queued"
  | "preprocessing"
  | "rendering"
  | "encoding"
  | "assembling"
  | "complete"
  | "failed"
  | "cancelled";

type ProducerRenderJob = {
  status: ProducerRenderStatus;
  progress: number;
};

type ProducerModule = {
  createRenderJob(config: {
    fps: 24 | 30 | 60;
    quality: "draft" | "standard" | "high";
    format: "mp4" | "mov" | "webm";
  }): ProducerRenderJob;
  executeRenderJob(
    job: ProducerRenderJob,
    projectDir: string,
    outputPath: string,
    onProgress?: (job: ProducerRenderJob, message: string) => void,
    abortSignal?: AbortSignal,
  ): Promise<void>;
};

export type RenderAsset = {
  name: string;
  data: string;
};

export class CatalogCheckError extends Error {
  readonly failures: ReturnType<typeof checkEpisode>["failures"];

  constructor(failures: ReturnType<typeof checkEpisode>["failures"]) {
    super(
      `catalog-check-failed: ${failures.map((item) => `${item.rule}: ${item.fix}`).join("; ")}`,
    );
    this.name = "CatalogCheckError";
    this.failures = failures;
  }
}

const importProducer = new Function("specifier", "return import(specifier)") as (
  specifier: "@hyperframes/producer",
) => Promise<ProducerModule>;

const expandHome = (path: string): string =>
  path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;

export const getMcpOutputDir = (): string =>
  resolve(expandHome(Bun.env.MCP_OUTPUT_DIR || "~/.motion-shorts/out"));

export const createJobId = (): string => `job_${crypto.randomUUID()}`;

export const ensureOutputDir = async (): Promise<string> => {
  const outputDir = getMcpOutputDir();
  await mkdir(outputDir, { recursive: true });
  return outputDir;
};

const materialiseProject = async (jobId: string, html: string, assets: RenderAsset[]) => {
  const projectDir = join(tmpdir(), "motion-shorts-mcp", jobId);

  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, "index.html"), html);

  for (const asset of assets) {
    const assetPath = normalize(asset.name);

    if (isAbsolute(assetPath) || assetPath.startsWith("..")) {
      throw new Error(`Invalid asset path: ${asset.name}`);
    }

    const outputPath = join(projectDir, assetPath);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, asset.data, "base64");
  }

  return projectDir;
};

export const renderCompositionToFile = async ({
  jobId,
  html,
  assets,
  format,
  fps,
  quality,
  outputPath,
}: {
  jobId: string;
  html: string;
  assets: RenderAsset[];
  format: "mp4" | "mov" | "webm";
  fps: 24 | 30 | 60;
  quality: "draft" | "standard" | "high";
  outputPath: string;
}): Promise<void> => {
  const projectDir = await materialiseProject(jobId, html, assets);

  try {
    const catalogCheck = checkEpisode(join(projectDir, "index.html"), catalogManifest);
    if (!catalogCheck.ok) {
      throw new CatalogCheckError(catalogCheck.failures);
    }

    const { createRenderJob, executeRenderJob } = await importProducer("@hyperframes/producer");
    const renderJob = createRenderJob({ fps, quality, format });

    await executeRenderJob(renderJob, projectDir, outputPath);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
};
