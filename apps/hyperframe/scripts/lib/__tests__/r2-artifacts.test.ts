import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FetchLike } from "@cgaravitoq/spec";
import {
  assertR2Config,
  collectEpisodeArtifacts,
  hydrateEpisodeArtifacts,
  hydrateEpisodeFinal,
  loadWorkspaceEnv,
  objectKeyFor,
  publishEpisodeArtifacts,
  resolveR2PublishOptions,
} from "../r2-artifacts";

const env = {
  R2_ACCOUNT_ID: "account-id",
  R2_BUCKET: "bucket-name",
  R2_ACCESS_KEY_ID_WRITE: "write-key",
  R2_SECRET_ACCESS_KEY_WRITE: "write-secret",
  R2_SIGNED_URL_TTL_SECONDS: "900",
};

const gatewayEnv = {
  R2_ACCOUNT_ID: "account-id",
  R2_BUCKET: "bucket-name",
  R2_UPLOAD_GATEWAY_URL: "https://upload.example.com/",
  R2_UPLOAD_GATEWAY_TOKEN: "secret-token",
  R2_SIGNED_URL_TTL_SECONDS: "900",
};

const keyFromUrl = (url: string) => {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname.replace(/^\/bucket-name\//, ""));
};

const createS3Store = () => {
  const store = new Map<string, Buffer>();
  const fetchImpl: FetchLike = async (url, init = {}) => {
    const key = keyFromUrl(url);
    if (init.method === "PUT") {
      store.set(key, Buffer.from(await new Response(init.body).arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    const body = store.get(key);
    return body === undefined
      ? new Response(null, { status: 404 })
      : new Response(body as Uint8Array<ArrayBuffer>, { status: 200 });
  };
  return { store, fetchImpl };
};

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const writeAssetsManifest = async ({ root, object }: { root: string; object: unknown }) => {
  const manifestPath = path.join(root, "src/episodes/demo-short/assets.remote.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        provider: "cloudflare-r2",
        bucket: "bucket-name",
        episodeSlug: "demo-short",
        runId: "run-1",
        generatedAt: "2026-05-14T00:00:00.000Z",
        deleteLocal: true,
        objects: [object],
      },
      null,
      2,
    )}\n`,
  );
  return manifestPath;
};

describe("r2 artifact publishing", () => {
  it("loads missing env values from the workspace .env", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-workspace-env-"));
    await writeFile(path.join(root, "turbo.json"), "{}");
    await mkdir(path.join(root, "apps/hyperframe/scripts/lib"), { recursive: true });
    await writeFile(
      path.join(root, ".env"),
      [
        "# R2 defaults",
        "R2_ACCOUNT_ID=workspace-account",
        "R2_BUCKET=workspace-bucket",
        'R2_UPLOAD_GATEWAY_URL="https://upload.example.com/"',
        "R2_UPLOAD_GATEWAY_TOKEN=workspace-token",
      ].join("\n"),
    );
    const isolatedEnv = {};

    expect(
      loadWorkspaceEnv({
        env: isolatedEnv,
        startDir: path.join(root, "apps/hyperframe/scripts/lib"),
      }),
    ).toBe(true);

    expect(isolatedEnv).toMatchObject({
      R2_ACCOUNT_ID: "workspace-account",
      R2_BUCKET: "workspace-bucket",
      R2_UPLOAD_GATEWAY_URL: "https://upload.example.com/",
      R2_UPLOAD_GATEWAY_TOKEN: "workspace-token",
    });

    await rm(root, { recursive: true, force: true });
  });

  it("does not clobber pre-set env values when loading the workspace .env", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-workspace-env-preserve-"));
    await writeFile(path.join(root, "bun.lockb"), "");
    await mkdir(path.join(root, "apps/hyperframe/scripts/lib"), { recursive: true });
    await writeFile(
      path.join(root, ".env"),
      [
        "R2_ACCOUNT_ID=workspace-account",
        "R2_BUCKET=workspace-bucket",
        "R2_UPLOAD_GATEWAY_URL=https://upload.example.com",
        "R2_UPLOAD_GATEWAY_TOKEN=workspace-token",
      ].join("\n"),
    );
    const isolatedEnv = {
      R2_ACCOUNT_ID: "shell-account",
      R2_UPLOAD_GATEWAY_TOKEN: "shell-token",
    };

    loadWorkspaceEnv({
      env: isolatedEnv,
      startDir: path.join(root, "apps/hyperframe/scripts/lib"),
    });

    expect(isolatedEnv).toMatchObject({
      R2_ACCOUNT_ID: "shell-account",
      R2_BUCKET: "workspace-bucket",
      R2_UPLOAD_GATEWAY_URL: "https://upload.example.com",
      R2_UPLOAD_GATEWAY_TOKEN: "shell-token",
    });

    await rm(root, { recursive: true, force: true });
  });

  it("builds deterministic episode final keys", () => {
    expect(
      objectKeyFor({
        slug: "demo-short",
        category: "renders",
        filename: "demo-short.mp4",
      }),
    ).toBe("motion-shorts/episodes/demo-short/final/renders/demo-short.mp4");
  });

  it("fails fast when upload is requested without an R2 transport", () => {
    expect(() => assertR2Config({ R2_BUCKET: "bucket-name" })).toThrow(
      "Set one of: CLOUDFLARE_API_TOKEN, or R2_UPLOAD_GATEWAY_URL + R2_UPLOAD_GATEWAY_TOKEN",
    );
  });

  it("accepts gateway-only R2 credentials", () => {
    const config = assertR2Config(gatewayEnv);

    expect(config.uploadGatewayUrl).toBe("https://upload.example.com");
    expect(config.uploadGatewayToken).toBe("secret-token");
    expect(config.accessKeyId).toBeUndefined();
    expect(config.secretAccessKey).toBeUndefined();
  });

  it("accepts direct-S3-only R2 credentials", () => {
    const config = assertR2Config(env);

    expect(config.uploadGatewayUrl).toBe("");
    expect(config.accessKeyId).toBe("write-key");
    expect(config.secretAccessKey).toBe("write-secret");
  });

  it("keeps local outputs and skips upload by default when R2 credentials are configured", () => {
    expect(resolveR2PublishOptions({ env })).toEqual({
      upload: false,
      deleteLocal: false,
      missing: [],
      warning: null,
    });
  });

  it("deletes local outputs after opt-in upload when requested", () => {
    expect(resolveR2PublishOptions({ env, upload: "r2", deleteLocal: true })).toEqual({
      upload: true,
      deleteLocal: true,
      missing: [],
      warning: null,
    });
  });

  it("falls back to local-only with a warning when R2 credentials are missing", () => {
    const options = resolveR2PublishOptions({
      env: { R2_BUCKET: "bucket-name" },
      upload: "r2",
    });

    expect(options.upload).toBe(false);
    expect(options.deleteLocal).toBe(false);
    expect(options.missing).toEqual([
      "R2_ACCOUNT_ID",
      "R2_UPLOAD_GATEWAY_URL",
      "R2_UPLOAD_GATEWAY_TOKEN",
    ]);
    expect(options.warning).toContain("WARNING: R2 credentials are missing");
    expect(options.warning).toContain("Set one of: CLOUDFLARE_API_TOKEN, or R2_UPLOAD_GATEWAY_URL + R2_UPLOAD_GATEWAY_TOKEN");
  });

  it("publishes when gateway-only R2 credentials are configured", () => {
    expect(resolveR2PublishOptions({ env: gatewayEnv, upload: "r2" })).toEqual({
      upload: true,
      deleteLocal: true,
      missing: [],
      warning: null,
    });
  });

  it("keeps local outputs and skips upload for explicit local-only renders", () => {
    expect(resolveR2PublishOptions({ env, upload: "r2", localOnly: true })).toEqual({
      upload: false,
      deleteLocal: false,
      missing: [],
      warning: null,
    });
  });

  it("preserves local render outputs after upload when requested", () => {
    expect(resolveR2PublishOptions({ env, upload: "r2", keepLocal: true })).toEqual({
      upload: true,
      deleteLocal: false,
      missing: [],
      warning: null,
    });
  });

  it("treats an endpoint path as the bucket prefix", () => {
    const config = assertR2Config({
      ...env,
      R2_ENDPOINT_URL: "https://account-id.r2.cloudflarestorage.com/bucket-name",
    });

    expect(config.endpoint).toBe("https://account-id.r2.cloudflarestorage.com");
    expect(config.endpointPrefix).toBe("/bucket-name");
  });

  it("collects render, audio, captions, image, and font artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-artifacts-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const assetsDir = path.join(episodeDir, "assets");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(path.join(root, "demo-short.mp4"), "video");
    await writeFile(path.join(assetsDir, "voice.mp3"), "audio");
    await writeFile(path.join(assetsDir, "captions.json"), "[]");
    await writeFile(path.join(assetsDir, "cover.png"), "image");
    await writeFile(path.join(assetsDir, "font.woff2"), "font");
    await writeFile(path.join(assetsDir, "notes.txt"), "ignored");

    const artifacts = await collectEpisodeArtifacts({
      episodeDir,
      renderPath: path.join(root, "demo-short.mp4"),
      slug: "demo-short",
    });

    expect(artifacts.map((artifact) => artifact.key).sort()).toEqual([
      "motion-shorts/episodes/demo-short/final/audio/captions.json",
      "motion-shorts/episodes/demo-short/final/audio/voice.mp3",
      "motion-shorts/episodes/demo-short/final/fonts/font.woff2",
      "motion-shorts/episodes/demo-short/final/images/cover.png",
      "motion-shorts/episodes/demo-short/final/renders/demo-short.mp4",
    ]);

    await rm(root, { recursive: true, force: true });
  });

  it("collects episode source files with app-root-relative paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-source-artifacts-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    await mkdir(path.join(episodeDir, "assets/generated"), { recursive: true });
    await mkdir(path.join(root, "examples"), { recursive: true });
    await writeFile(path.join(root, "demo-short.mp4"), "video");
    await writeFile(path.join(episodeDir, "scene-spec.json"), "{}");
    await writeFile(path.join(episodeDir, "meta.json"), "{}");
    await writeFile(path.join(root, "examples/demo-short.txt"), "script");
    await writeFile(path.join(episodeDir, "assets/generated/hook.svg"), "<svg/>");

    const artifacts = await collectEpisodeArtifacts({
      episodeDir,
      renderPath: path.join(root, "demo-short.mp4"),
      slug: "demo-short",
    });

    const source = artifacts.filter((artifact) => artifact.manifest === "source");
    expect(source.map((artifact) => artifact.key).sort()).toEqual([
      "motion-shorts/episodes/demo-short/final/source/assets/generated/hook.svg",
      "motion-shorts/episodes/demo-short/final/source/examples/demo-short.txt",
      "motion-shorts/episodes/demo-short/final/source/meta.json",
      "motion-shorts/episodes/demo-short/final/source/scene-spec.json",
    ]);
    const spec = source.find((artifact) => artifact.localPath.endsWith("scene-spec.json"));
    expect(spec?.relPath).toBe("src/episodes/demo-short/scene-spec.json");
    const script = source.find((artifact) => artifact.localPath.endsWith("demo-short.txt"));
    expect(script?.relPath).toBe("examples/demo-short.txt");

    await rm(root, { recursive: true, force: true });
  });

  it("uploads, verifies, and writes text manifests", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-publish-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const assetsDir = path.join(episodeDir, "assets");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(renderPath, "video-bytes");
    await writeFile(path.join(assetsDir, "voice.mp3"), "audio-bytes");
    await writeFile(path.join(assetsDir, "captions.json"), "[]");
    await writeFile(path.join(assetsDir, "font.woff2"), "font-bytes");
    const { store, fetchImpl } = createS3Store();

    const result = await publishEpisodeArtifacts({
      slug: "demo-short",
      episodeDir,
      renderPath,
      runId: "run-1",
      env,
      fetchImpl,
    });

    expect(result.uploaded).toHaveLength(4);
    const renderManifest = JSON.parse(
      await readFile(path.join(episodeDir, "render.remote.json"), "utf8"),
    );
    const assetsManifest = JSON.parse(
      await readFile(path.join(episodeDir, "assets.remote.json"), "utf8"),
    );
    expect(renderManifest.provider).toBe("cloudflare-r2");
    expect(renderManifest.objects[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(assetsManifest.objects.map((object: { key: string }) => object.key).sort()).toEqual([
      "motion-shorts/episodes/demo-short/final/audio/captions.json",
      "motion-shorts/episodes/demo-short/final/audio/voice.mp3",
      "motion-shorts/episodes/demo-short/final/fonts/font.woff2",
    ]);
    const fontUpload = result.uploaded.find((item) => item.localPath.endsWith("font.woff2"));
    expect(fontUpload?.category).toBe("fonts");
    expect(fontUpload?.contentType).toBe("font/woff2");
    expect(await readFile(renderPath, "utf8")).toBe("video-bytes");
    expect(store.has("motion-shorts/episodes/demo-short/final/manifests/render.remote.json")).toBe(
      true,
    );
    expect(store.has("motion-shorts/episodes/demo-short/final/manifests/source.remote.json")).toBe(
      true,
    );
    const index = JSON.parse(store.get("motion-shorts/index.json")?.toString("utf8") ?? "{}");
    expect(index.episodes["demo-short"].finalRunId).toBe("run-1");

    await rm(root, { recursive: true, force: true });
  });

  it("writes no manifests, local or remote, when an object upload fails mid-batch", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-txn-objects-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const assetsDir = path.join(episodeDir, "assets");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(renderPath, "video-bytes");
    await writeFile(path.join(assetsDir, "voice.mp3"), "audio-bytes");
    await writeFile(path.join(assetsDir, "captions.json"), "[]");
    const { store, fetchImpl: s3Fetch } = createS3Store();
    const fetchImpl: FetchLike = async (url, init) => {
      if (init?.method === "PUT" && url.includes("voice.mp3")) {
        return new Response(null, { status: 500, statusText: "Internal Server Error" });
      }
      return s3Fetch(url, init);
    };

    await expect(
      publishEpisodeArtifacts({
        slug: "demo-short",
        episodeDir,
        renderPath,
        runId: "run-1",
        env,
        fetchImpl,
      }),
    ).rejects.toThrow("R2 PUT failed");

    for (const name of ["render.remote.json", "assets.remote.json", "source.remote.json"]) {
      await expect(readFile(path.join(episodeDir, name), "utf8")).rejects.toThrow();
      expect(store.has(`motion-shorts/episodes/demo-short/final/manifests/${name}`)).toBe(false);
    }
    expect(store.has("motion-shorts/index.json")).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it("writes no local manifests when a remote manifest upload fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-txn-manifests-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(path.join(episodeDir, "assets"), { recursive: true });
    await writeFile(renderPath, "video-bytes");
    const { store, fetchImpl: s3Fetch } = createS3Store();
    const fetchImpl: FetchLike = async (url, init) => {
      if (init?.method === "PUT" && url.includes("/manifests/assets.remote.json")) {
        return new Response(null, { status: 503, statusText: "Service Unavailable" });
      }
      return s3Fetch(url, init);
    };

    await expect(
      publishEpisodeArtifacts({
        slug: "demo-short",
        episodeDir,
        renderPath,
        runId: "run-1",
        env,
        fetchImpl,
      }),
    ).rejects.toThrow("R2 PUT failed");

    for (const name of ["render.remote.json", "assets.remote.json", "source.remote.json"]) {
      await expect(readFile(path.join(episodeDir, name), "utf8")).rejects.toThrow();
    }
    expect(store.has("motion-shorts/index.json")).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it("rejects a malformed remote manifest via the shared schema", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-schema-manifest-"));
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key: "motion-shorts/episodes/demo-short/final/audio/voice.mp3",
        bytes: -5,
        sha256: "not-hex",
      },
    });

    await expect(
      hydrateEpisodeArtifacts({
        manifestPath,
        destinationDir: path.join(root, "out"),
        env,
        fetchImpl: async () => new Response("x", { status: 200 }),
      }),
    ).rejects.toThrow(`Malformed remote manifest at ${manifestPath}`);

    await rm(root, { recursive: true, force: true });
  });

  it("keeps sibling episodes in the bucket index across publishes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-index-upsert-"));
    const { store, fetchImpl } = createS3Store();
    for (const slug of ["short-a", "short-b"]) {
      const episodeDir = path.join(root, "src/episodes", slug);
      await mkdir(path.join(episodeDir, "assets"), { recursive: true });
      const renderPath = path.join(root, `${slug}.mp4`);
      await writeFile(renderPath, `video-${slug}`);
      await publishEpisodeArtifacts({
        slug,
        episodeDir,
        renderPath,
        runId: `run-${slug}`,
        env,
        fetchImpl,
      });
    }

    const index = JSON.parse(store.get("motion-shorts/index.json")?.toString("utf8") ?? "{}");
    expect(Object.keys(index.episodes).sort()).toEqual(["short-a", "short-b"]);
    expect(index.episodes["short-a"].finalRunId).toBe("run-short-a");
    expect(index.episodes["short-b"].finalRunId).toBe("run-short-b");

    await rm(root, { recursive: true, force: true });
  });

  it("replaces the assets manifest with the published final set", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-replace-manifest-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const assetsDir = path.join(episodeDir, "assets");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(renderPath, "video-bytes");
    await writeFile(path.join(assetsDir, "voice.mp3"), "audio-bytes");
    const staleObject = {
      key: "motion-shorts/episodes/demo-short/final/fonts/font.woff2",
      category: "fonts",
      bytes: 10,
      sha256: sha256("font-bytes"),
      contentType: "font/woff2",
      urlStrategy: "signed-url",
      url: null,
      signedUrlTtlSeconds: 900,
    };
    await writeAssetsManifest({ root, object: staleObject });
    const { fetchImpl } = createS3Store();

    await publishEpisodeArtifacts({
      slug: "demo-short",
      episodeDir,
      renderPath,
      runId: "run-1",
      env,
      fetchImpl,
    });

    const assetsManifest = JSON.parse(
      await readFile(path.join(episodeDir, "assets.remote.json"), "utf8"),
    );
    expect(assetsManifest.objects.map((object: { key: string }) => object.key)).toEqual([
      "motion-shorts/episodes/demo-short/final/audio/voice.mp3",
    ]);

    await rm(root, { recursive: true, force: true });
  });

  it("keeps local render output after upload when deleteLocal is false", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-keep-local-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(path.join(episodeDir, "assets"), { recursive: true });
    await writeFile(renderPath, "video-bytes");
    const { fetchImpl } = createS3Store();

    await publishEpisodeArtifacts({
      slug: "demo-short",
      episodeDir,
      renderPath,
      runId: "run-1",
      deleteLocal: false,
      env,
      fetchImpl,
    });

    expect(await readFile(renderPath, "utf8")).toBe("video-bytes");

    await rm(root, { recursive: true, force: true });
  });

  it("uses the upload gateway when configured", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-gateway-"));
    const filePath = path.join(root, "clip.mp4");
    await writeFile(filePath, "gateway-video");
    const store = new Map<string, Buffer>();
    const calls: Array<{ url: string; method: string | undefined; token: string | undefined }> = [];
    const fetchImpl: FetchLike = async (url, init = {}) => {
      const headers = init.headers as Record<string, string> | undefined;
      calls.push({ url, method: init.method, token: headers?.["x-upload-token"] });
      const key = decodeURIComponent(new URL(url).pathname.replace(/^\/objects\//, ""));
      if (init.method === "PUT") {
        store.set(key, Buffer.from(await new Response(init.body).arrayBuffer()));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      const body = store.get(key);
      return body === undefined
        ? new Response(null, { status: 404 })
        : new Response(body as Uint8Array<ArrayBuffer>, { status: 200 });
    };

    const config = assertR2Config({
      ...env,
      R2_UPLOAD_GATEWAY_URL: "https://upload.example.com/",
      R2_UPLOAD_GATEWAY_TOKEN: "secret-token",
    });
    const result = await publishEpisodeArtifacts({
      slug: "demo-short",
      episodeDir: root,
      renderPath: filePath,
      runId: "gateway-run",
      env: {
        ...env,
        R2_UPLOAD_GATEWAY_URL: "https://upload.example.com/",
        R2_UPLOAD_GATEWAY_TOKEN: "secret-token",
      },
      fetchImpl,
    });

    expect(config.uploadGatewayUrl).toBe("https://upload.example.com");
    expect(result.uploaded[0]?.bytes).toBe(13);
    expect(calls[0]?.url).toContain(
      "/objects/motion-shorts/episodes/demo-short/final/renders/clip.mp4",
    );
    expect(
      calls.filter((call) => call.method === "PUT").every((call) => call.token === "secret-token"),
    ).toBe(true);
    expect(store.has("motion-shorts/index.json")).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it("hydrates the published final onto a clean tree", async () => {
    const rootA = await mkdtemp(path.join(tmpdir(), "r2-final-publish-"));
    const episodeDir = path.join(rootA, "src/episodes/demo-short");
    await mkdir(path.join(episodeDir, "assets/generated"), { recursive: true });
    await mkdir(path.join(rootA, "examples"), { recursive: true });
    await mkdir(path.join(rootA, "renders"), { recursive: true });
    const renderPath = path.join(rootA, "renders/demo-short.mp4");
    await writeFile(renderPath, "video-bytes");
    await writeFile(path.join(episodeDir, "scene-spec.json"), '{"slug":"demo-short"}');
    await writeFile(path.join(episodeDir, "meta.json"), '{"tail":3}');
    await writeFile(path.join(rootA, "examples/demo-short.txt"), "script-text");
    await writeFile(path.join(episodeDir, "assets/generated/hook.svg"), "<svg/>");
    await writeFile(path.join(episodeDir, "assets/voice.mp3"), "audio-bytes");
    const { fetchImpl } = createS3Store();
    await publishEpisodeArtifacts({
      slug: "demo-short",
      episodeDir,
      renderPath,
      runId: "run-1",
      env,
      fetchImpl,
    });

    const rootB = await mkdtemp(path.join(tmpdir(), "r2-final-hydrate-"));
    const { runId, restored } = await hydrateEpisodeFinal({
      slug: "demo-short",
      appRoot: rootB,
      env,
      fetchImpl,
    });

    expect(runId).toBe("run-1");
    expect(restored.length).toBeGreaterThan(0);
    expect(
      await readFile(path.join(rootB, "src/episodes/demo-short/scene-spec.json"), "utf8"),
    ).toBe('{"slug":"demo-short"}');
    expect(await readFile(path.join(rootB, "examples/demo-short.txt"), "utf8")).toBe("script-text");
    expect(
      await readFile(path.join(rootB, "src/episodes/demo-short/assets/generated/hook.svg"), "utf8"),
    ).toBe("<svg/>");
    expect(
      await readFile(path.join(rootB, "src/episodes/demo-short/assets/voice.mp3"), "utf8"),
    ).toBe("audio-bytes");
    expect(await readFile(path.join(rootB, "renders/demo-short.mp4"), "utf8")).toBe("video-bytes");

    await rm(rootA, { recursive: true, force: true });
    await rm(rootB, { recursive: true, force: true });
  });

  it("refuses to overwrite differing local source files unless forced", async () => {
    const rootA = await mkdtemp(path.join(tmpdir(), "r2-final-guard-pub-"));
    const episodeDir = path.join(rootA, "src/episodes/demo-short");
    await mkdir(path.join(episodeDir, "assets"), { recursive: true });
    const renderPath = path.join(rootA, "demo-short.mp4");
    await writeFile(renderPath, "video-bytes");
    await writeFile(path.join(episodeDir, "scene-spec.json"), '{"v":"published"}');
    const { fetchImpl } = createS3Store();
    await publishEpisodeArtifacts({
      slug: "demo-short",
      episodeDir,
      renderPath,
      runId: "run-1",
      env,
      fetchImpl,
    });

    const rootB = await mkdtemp(path.join(tmpdir(), "r2-final-guard-hyd-"));
    const localSpec = path.join(rootB, "src/episodes/demo-short/scene-spec.json");
    await mkdir(path.dirname(localSpec), { recursive: true });
    await writeFile(localSpec, '{"v":"local-newer"}');

    await expect(
      hydrateEpisodeFinal({ slug: "demo-short", appRoot: rootB, env, fetchImpl }),
    ).rejects.toThrow("Re-run with --force");
    expect(await readFile(localSpec, "utf8")).toBe('{"v":"local-newer"}');

    await hydrateEpisodeFinal({ slug: "demo-short", appRoot: rootB, force: true, env, fetchImpl });
    expect(await readFile(localSpec, "utf8")).toBe('{"v":"published"}');

    await rm(rootA, { recursive: true, force: true });
    await rm(rootB, { recursive: true, force: true });
  });

  it("hydrates remote assets into their expected episode asset paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-hydrate-"));
    const bytes = Buffer.from("audio-bytes");
    const key = "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3";
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key,
        category: "audio",
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        contentType: "audio/mpeg",
        urlStrategy: "signed-url",
        url: null,
        signedUrlTtlSeconds: 900,
      },
    });
    const fetchImpl = async () => new Response(bytes, { status: 200 });

    const restored = await hydrateEpisodeArtifacts({
      manifestPath,
      destinationDir: path.join(root, "src/episodes/demo-short/assets"),
      env,
      fetchImpl,
    });

    expect(restored).toEqual([path.join(root, "src/episodes/demo-short/assets/voice.mp3")]);
    expect(
      await readFile(path.join(root, "src/episodes/demo-short/assets/voice.mp3"), "utf8"),
    ).toBe("audio-bytes");

    await rm(root, { recursive: true, force: true });
  });

  it("hydrates remote assets through the upload gateway when configured", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-hydrate-gateway-"));
    const bytes = Buffer.from("audio-bytes");
    const key = "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3";
    const outputPath = path.join(root, "src/episodes/demo-short/assets/voice.mp3");
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key,
        category: "audio",
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        contentType: "audio/mpeg",
        urlStrategy: "signed-url",
        url: null,
        signedUrlTtlSeconds: 900,
      },
    });
    const calls: Array<{ url: string; method: string | undefined; token: string | undefined }> = [];
    const fetchImpl: FetchLike = async (url, init = {}) => {
      const headers = init.headers as Record<string, string> | undefined;
      calls.push({ url, method: init.method, token: headers?.["x-upload-token"] });
      return new Response(bytes, { status: 200 });
    };

    const restored = await hydrateEpisodeArtifacts({
      manifestPath,
      destinationDir: path.dirname(outputPath),
      env: gatewayEnv,
      fetchImpl,
    });

    expect(restored).toEqual([outputPath]);
    expect(calls).toEqual([
      {
        url: "https://upload.example.com/objects/motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3",
        method: "GET",
        token: "secret-token",
      },
    ]);
    expect(await readFile(outputPath, "utf8")).toBe("audio-bytes");

    await rm(root, { recursive: true, force: true });
  });

  it("rejects gateway-hydrated assets with hash mismatches without writing files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-hydrate-gateway-hash-mismatch-"));
    const key = "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3";
    const outputPath = path.join(root, "src/episodes/demo-short/assets/voice.mp3");
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key,
        category: "audio",
        bytes: 11,
        sha256: sha256("expected-ok"),
        contentType: "audio/mpeg",
        urlStrategy: "signed-url",
        url: null,
        signedUrlTtlSeconds: 900,
      },
    });
    const fetchImpl = async () => new Response("received-no", { status: 200 });

    await expect(
      hydrateEpisodeArtifacts({
        manifestPath,
        destinationDir: path.dirname(outputPath),
        env: gatewayEnv,
        fetchImpl,
      }),
    ).rejects.toThrow(`R2 hydrate verification mismatch for ${key}`);
    await expect(readFile(outputPath, "utf8")).rejects.toThrow();

    await rm(root, { recursive: true, force: true });
  });

  it("rejects hydrated assets with hash mismatches without writing files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-hash-mismatch-"));
    const key = "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3";
    const outputPath = path.join(root, "src/episodes/demo-short/assets/voice.mp3");
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key,
        category: "audio",
        bytes: 11,
        sha256: sha256("expected-ok"),
        contentType: "audio/mpeg",
        urlStrategy: "signed-url",
        url: null,
        signedUrlTtlSeconds: 900,
      },
    });
    const fetchImpl = async () => new Response("received-no", { status: 200 });

    await expect(
      hydrateEpisodeArtifacts({
        manifestPath,
        destinationDir: path.dirname(outputPath),
        env,
        fetchImpl,
      }),
    ).rejects.toThrow(`R2 hydrate verification mismatch for ${key}`);
    await expect(readFile(outputPath, "utf8")).rejects.toThrow();

    await rm(root, { recursive: true, force: true });
  });

  it("rejects hydrated assets with size mismatches without writing files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-size-mismatch-"));
    const key = "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3";
    const outputPath = path.join(root, "src/episodes/demo-short/assets/voice.mp3");
    const bytes = Buffer.from("audio-bytes");
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key,
        category: "audio",
        bytes: bytes.byteLength + 1,
        sha256: sha256(bytes),
        contentType: "audio/mpeg",
        urlStrategy: "signed-url",
        url: null,
        signedUrlTtlSeconds: 900,
      },
    });
    const fetchImpl = async () => new Response(bytes, { status: 200 });

    await expect(
      hydrateEpisodeArtifacts({
        manifestPath,
        destinationDir: path.dirname(outputPath),
        env,
        fetchImpl,
      }),
    ).rejects.toThrow(`R2 hydrate verification mismatch for ${key}`);
    await expect(readFile(outputPath, "utf8")).rejects.toThrow();

    await rm(root, { recursive: true, force: true });
  });

  it("skips downloads when local hydrated assets already match", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-hydrate-idempotent-"));
    const outputPath = path.join(root, "src/episodes/demo-short/assets/voice.mp3");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "audio-bytes");
    const bytes = Buffer.from("audio-bytes");
    const manifestPath = await writeAssetsManifest({
      root,
      object: {
        key: "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3",
        category: "audio",
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
        contentType: "audio/mpeg",
        urlStrategy: "signed-url",
        url: null,
        signedUrlTtlSeconds: 900,
      },
    });
    let fetchCount = 0;
    const fetchImpl = async () => {
      fetchCount += 1;
      return new Response("should-not-fetch", { status: 200 });
    };

    const restored = await hydrateEpisodeArtifacts({
      manifestPath,
      destinationDir: path.dirname(outputPath),
      env,
      fetchImpl,
    });

    expect(restored).toEqual([]);
    expect(fetchCount).toBe(0);
    expect(await readFile(outputPath, "utf8")).toBe("audio-bytes");

    await rm(root, { recursive: true, force: true });
  });

  it("fails clearly when the remote manifest is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-missing-manifest-"));
    const manifestPath = path.join(root, "src/episodes/demo-short/assets.remote.json");
    const outputPath = path.join(root, "src/episodes/demo-short/assets/voice.mp3");

    await expect(
      hydrateEpisodeArtifacts({
        manifestPath,
        destinationDir: path.dirname(outputPath),
        env,
        fetchImpl: async () => new Response("audio-bytes", { status: 200 }),
      }),
    ).rejects.toThrow(`Unable to read remote manifest at ${manifestPath}`);
    await expect(readFile(outputPath, "utf8")).rejects.toThrow();

    await rm(root, { recursive: true, force: true });
  });
});
