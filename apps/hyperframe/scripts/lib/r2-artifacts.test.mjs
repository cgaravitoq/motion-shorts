import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertR2Config,
  collectEpisodeArtifacts,
  hydrateEpisodeArtifacts,
  loadWorkspaceEnv,
  objectKeyFor,
  publishEpisodeArtifacts,
  resolveR2PublishOptions,
} from "./r2-artifacts.mjs";

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

const keyFromUrl = (url) => {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname.replace(/^\/bucket-name\//, ""));
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const writeAssetsManifest = async ({ root, object }) => {
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

  it("builds deterministic episode run keys", () => {
    expect(
      objectKeyFor({
        slug: "demo-short",
        runId: "2026-05-10T120000Z",
        category: "renders",
        filename: "demo-short.mp4",
      }),
    ).toBe("motion-shorts/episodes/demo-short/runs/2026-05-10T120000Z/renders/demo-short.mp4");
  });

  it("fails fast when upload is requested without an R2 transport", () => {
    expect(() => assertR2Config({ R2_BUCKET: "bucket-name" })).toThrow(
      "Set either R2_UPLOAD_GATEWAY_URL + R2_UPLOAD_GATEWAY_TOKEN",
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

  it("uploads and deletes local outputs by default when R2 credentials are configured", () => {
    expect(resolveR2PublishOptions({ env })).toEqual({
      upload: true,
      deleteLocal: true,
      missing: [],
      warning: null,
    });
  });

  it("deletes local outputs when requested", () => {
    expect(resolveR2PublishOptions({ env, deleteLocal: true })).toEqual({
      upload: true,
      deleteLocal: true,
      missing: [],
      warning: null,
    });
  });

  it("falls back to local-only with a warning when R2 credentials are missing", () => {
    const options = resolveR2PublishOptions({ env: { R2_BUCKET: "bucket-name" } });

    expect(options.upload).toBe(false);
    expect(options.deleteLocal).toBe(false);
    expect(options.missing).toEqual([
      "R2_ACCOUNT_ID",
      "R2_UPLOAD_GATEWAY_URL",
      "R2_UPLOAD_GATEWAY_TOKEN",
    ]);
    expect(options.warning).toContain("WARNING: R2 credentials are missing");
    expect(options.warning).toContain("Set either R2_UPLOAD_GATEWAY_URL + R2_UPLOAD_GATEWAY_TOKEN");
  });

  it("publishes when gateway-only R2 credentials are configured", () => {
    expect(resolveR2PublishOptions({ env: gatewayEnv })).toEqual({
      upload: true,
      deleteLocal: true,
      missing: [],
      warning: null,
    });
  });

  it("keeps local outputs and skips upload for explicit local-only renders", () => {
    expect(resolveR2PublishOptions({ env, localOnly: true })).toEqual({
      upload: false,
      deleteLocal: false,
      missing: [],
      warning: null,
    });
  });

  it("preserves local render outputs after upload when requested", () => {
    expect(resolveR2PublishOptions({ env, keepLocal: true })).toEqual({
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
      runId: "run-1",
    });

    expect(artifacts.map((artifact) => artifact.key).sort()).toEqual([
      "motion-shorts/episodes/demo-short/runs/run-1/audio/captions.json",
      "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3",
      "motion-shorts/episodes/demo-short/runs/run-1/fonts/font.woff2",
      "motion-shorts/episodes/demo-short/runs/run-1/images/cover.png",
      "motion-shorts/episodes/demo-short/runs/run-1/renders/demo-short.mp4",
    ]);

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
    const store = new Map();
    const fetchImpl = async (url, init) => {
      const key = keyFromUrl(url);
      if (init.method === "PUT") {
        store.set(key, Buffer.from(await new Response(init.body).arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      return new Response(store.get(key), { status: 200 });
    };

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
    expect(assetsManifest.objects.map((object) => object.key).sort()).toEqual([
      "motion-shorts/episodes/demo-short/runs/run-1/audio/captions.json",
      "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3",
      "motion-shorts/episodes/demo-short/runs/run-1/fonts/font.woff2",
    ]);
    const fontUpload = result.uploaded.find((item) => item.localPath.endsWith("font.woff2"));
    expect(fontUpload.category).toBe("fonts");
    expect(fontUpload.contentType).toBe("font/woff2");
    expect(await readFile(renderPath, "utf8")).toBe("video-bytes");

    await rm(root, { recursive: true, force: true });
  });

  it("merges new asset uploads with an existing assets manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-merge-manifest-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const assetsDir = path.join(episodeDir, "assets");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(renderPath, "video-bytes");
    await writeFile(path.join(assetsDir, "voice.mp3"), "audio-bytes");
    const fontObject = {
      key: "motion-shorts/episodes/demo-short/runs/migration/fonts/font.woff2",
      category: "fonts",
      bytes: 10,
      sha256: sha256("font-bytes"),
      contentType: "font/woff2",
      urlStrategy: "signed-url",
      url: null,
      signedUrlTtlSeconds: 900,
    };
    await writeAssetsManifest({ root, object: fontObject });
    const store = new Map();
    const fetchImpl = async (url, init) => {
      const key = keyFromUrl(url);
      if (init.method === "PUT") {
        store.set(key, Buffer.from(await new Response(init.body).arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      return new Response(store.get(key), { status: 200 });
    };

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
    expect(assetsManifest.objects.map((object) => object.key).sort()).toEqual([
      "motion-shorts/episodes/demo-short/runs/migration/fonts/font.woff2",
      "motion-shorts/episodes/demo-short/runs/run-1/audio/voice.mp3",
    ]);

    await rm(root, { recursive: true, force: true });
  });

  it("keeps local render output after upload when deleteLocal is false", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "r2-keep-local-"));
    const episodeDir = path.join(root, "src/episodes/demo-short");
    const renderPath = path.join(root, "demo-short.mp4");
    await mkdir(path.join(episodeDir, "assets"), { recursive: true });
    await writeFile(renderPath, "video-bytes");
    const store = new Map();
    const fetchImpl = async (url, init) => {
      const key = keyFromUrl(url);
      if (init.method === "PUT") {
        store.set(key, Buffer.from(await new Response(init.body).arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      return new Response(store.get(key), { status: 200 });
    };

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
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, method: init.method, token: init.headers["x-upload-token"] });
      if (init.method === "PUT") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("gateway-video", { status: 200 });
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
    expect(result.uploaded[0].bytes).toBe(13);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain(
      "/objects/motion-shorts/episodes/demo-short/runs/gateway-run/renders/clip.mp4",
    );
    expect(calls.every((call) => call.token === "secret-token")).toBe(true);

    await rm(root, { recursive: true, force: true });
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
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, method: init.method, token: init.headers["x-upload-token"] });
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
