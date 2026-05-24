import { createHash, createHmac } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROJECT_PREFIX = "motion-shorts";
const REGION = "auto";
const SERVICE = "s3";
const BINARY_ASSET_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".png",
  ".wav",
  ".webm",
  ".webp",
  ".woff2",
]);

const TEXT_ASSET_NAMES = new Set(["captions.json"]);

const baseR2EnvKeys = ["R2_ACCOUNT_ID", "R2_BUCKET"];
const gatewayR2EnvKeys = ["R2_UPLOAD_GATEWAY_URL", "R2_UPLOAD_GATEWAY_TOKEN"];
const directS3R2EnvKeys = ["R2_ACCESS_KEY_ID_WRITE", "R2_SECRET_ACCESS_KEY_WRITE"];

export const requiredR2EnvKeys = baseR2EnvKeys;

const missingKeys = (env, keys) => keys.filter((key) => !env[key]);

const hasGatewayR2Transport = (env) => missingKeys(env, gatewayR2EnvKeys).length === 0;

const hasDirectS3R2Transport = (env) => missingKeys(env, directS3R2EnvKeys).length === 0;

const transportErrorMessage =
  "Set either R2_UPLOAD_GATEWAY_URL + R2_UPLOAD_GATEWAY_TOKEN, or " +
  "R2_ACCESS_KEY_ID_WRITE + R2_SECRET_ACCESS_KEY_WRITE.";

const parseDotenv = (source) => {
  const entries = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
};

const findWorkspaceEnvPath = (startDir = import.meta.dirname) => {
  let current = path.resolve(startDir);
  while (true) {
    const envPath = path.join(current, ".env");
    const hasWorkspaceMarker = ["turbo.json", "bun.lockb", "bun.lock"].some((marker) =>
      fsSync.existsSync(path.join(current, marker)),
    );
    if (hasWorkspaceMarker && fsSync.existsSync(envPath)) {
      return envPath;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const loadWorkspaceEnv = ({ env = Bun.env, startDir = import.meta.dirname } = {}) => {
  const envPath = findWorkspaceEnvPath(startDir);
  if (!envPath) return false;

  const source = fsSync.readFileSync(envPath, "utf8");
  for (const [key, value] of parseDotenv(source)) {
    if (!env[key]) {
      env[key] = value;
    }
  }
  return true;
};

export const assertR2Config = (env = Bun.env) => {
  if (env === Bun.env && missingKeys(env, baseR2EnvKeys).length > 0) {
    loadWorkspaceEnv({ env });
  }
  const missingBase = missingKeys(env, baseR2EnvKeys);
  const hasTransport = hasGatewayR2Transport(env) || hasDirectS3R2Transport(env);
  if (missingBase.length > 0 || !hasTransport) {
    const parts = [];
    if (missingBase.length > 0) {
      parts.push(`missing base env vars: ${missingBase.join(", ")}`);
    }
    if (!hasTransport) {
      parts.push(`missing R2 transport credentials. ${transportErrorMessage}`);
    }
    throw new Error(
      `R2 upload requested but ${parts.join("; ")}. ` +
        "Default episode renders fall back to local-only when credentials are absent.",
    );
  }
  const endpointUrl = new URL(
    env.R2_ENDPOINT_URL || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  );
  const endpointPrefix =
    endpointUrl.pathname && endpointUrl.pathname !== "/"
      ? endpointUrl.pathname.replace(/\/$/, "")
      : `/${env.R2_BUCKET}`;

  return {
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID_WRITE,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY_WRITE,
    endpoint: endpointUrl.origin,
    endpointPrefix,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL || env.R2_PUBLIC_URL_BASE || "",
    signedUrlTtlSeconds: Number.parseInt(env.R2_SIGNED_URL_TTL_SECONDS || "3600", 10),
    requestTimeoutMs: Number.parseInt(env.R2_REQUEST_TIMEOUT_MS || "60000", 10),
    uploadGatewayUrl: env.R2_UPLOAD_GATEWAY_URL?.replace(/\/$/, "") || "",
    uploadGatewayToken: env.R2_UPLOAD_GATEWAY_TOKEN || "",
  };
};

export const missingR2EnvKeys = (env = Bun.env) => {
  if (env === Bun.env && missingKeys(env, baseR2EnvKeys).length > 0) {
    loadWorkspaceEnv({ env });
  }
  const missingBase = missingKeys(env, baseR2EnvKeys);
  if (hasGatewayR2Transport(env) || hasDirectS3R2Transport(env)) {
    return missingBase;
  }

  const missingGateway = missingKeys(env, gatewayR2EnvKeys);
  const missingDirectS3 = missingKeys(env, directS3R2EnvKeys);
  const missingTransport =
    missingGateway.length <= missingDirectS3.length ? missingGateway : missingDirectS3;
  return [...missingBase, ...missingTransport];
};

export const resolveR2PublishOptions = ({
  env = Bun.env,
  upload,
  localOnly = false,
  keepLocal = false,
  deleteLocal = true,
} = {}) => {
  if (localOnly || upload !== "r2") {
    return { upload: false, deleteLocal: false, missing: [], warning: null };
  }

  const missing = missingR2EnvKeys(env);
  if (missing.length > 0) {
    return {
      upload: false,
      deleteLocal: false,
      missing,
      warning:
        `[render-episode] WARNING: R2 credentials are missing (${missing.join(", ")}); ` +
        `keeping this render local-only. ${transportErrorMessage}`,
    };
  }

  return {
    upload: true,
    deleteLocal: Boolean(deleteLocal) && !keepLocal,
    missing: [],
    warning: null,
  };
};

export const createRunId = (date = new Date()) =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[:]/g, "")
    .replace("T", "T");

export const objectKeyFor = ({
  slug,
  runId,
  category,
  filename,
  projectPrefix = DEFAULT_PROJECT_PREFIX,
}) => `${projectPrefix}/episodes/${slug}/runs/${runId}/${category}/${filename}`;

export const sha256Hex = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
};

const sha256Buffer = (bytes) => createHash("sha256").update(bytes).digest("hex");

const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);

const signingKey = (secretAccessKey, dateStamp) => {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
};

const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

const timestamp = (date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const signedHeadersString = (headers) => Object.keys(headers).sort().join(";");

const canonicalHeaderString = (headers) =>
  `${Object.keys(headers)
    .sort()
    .map((key) => `${key}:${String(headers[key]).trim().replace(/\s+/g, " ")}`)
    .join("\n")}\n`;

export const signR2Request = ({
  config,
  method,
  key,
  payloadHash,
  headers = {},
  now = new Date(),
  expiresSeconds,
}) => {
  const host = new URL(config.endpoint).host;
  const amzDate = timestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalUri = `${config.endpointPrefix}/${encodeKey(key)}`;
  const normalizedHeaders = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
    ),
  };

  let canonicalQueryString = "";
  const requestHeaders = { ...normalizedHeaders };
  if (expiresSeconds !== undefined) {
    delete requestHeaders["x-amz-date"];
    const query = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresSeconds),
      "X-Amz-SignedHeaders": signedHeadersString(requestHeaders),
    };
    canonicalQueryString = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join("&");
  }

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaderString(requestHeaders),
    signedHeadersString(requestHeaders),
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = hmac(signingKey(config.secretAccessKey, dateStamp), stringToSign, "hex");
  const url = `${config.endpoint}${canonicalUri}${canonicalQueryString ? `?${canonicalQueryString}&X-Amz-Signature=${signature}` : ""}`;

  if (expiresSeconds !== undefined) {
    return { url, headers: requestHeaders };
  }

  return {
    url,
    headers: {
      ...requestHeaders,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeadersString(requestHeaders)}, Signature=${signature}`,
    },
  };
};

export const buildRemoteUrl = ({ config, key }) => {
  if (!config.publicBaseUrl) {
    return {
      strategy: "signed-url",
      url: null,
      signedUrlTtlSeconds: config.signedUrlTtlSeconds,
    };
  }
  return {
    strategy: "public-url",
    url: `${config.publicBaseUrl.replace(/\/$/, "")}/${encodeKey(key)}`,
    signedUrlTtlSeconds: null,
  };
};

const fetchWithTimeout = async (fetchImpl, url, init, timeoutMs) => {
  if (fetchImpl !== fetch || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetchImpl(url, init);
  }
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
};

const readRemoteManifest = async (manifestPath) => {
  let source;
  try {
    source = await fs.readFile(manifestPath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read remote manifest at ${manifestPath}: ${error.message}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    throw new Error(`Malformed remote manifest at ${manifestPath}: ${error.message}`);
  }

  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.objects)) {
    throw new Error(`Malformed remote manifest at ${manifestPath}: expected an objects array.`);
  }

  const invalid = [];
  for (const [index, object] of manifest.objects.entries()) {
    const label = object?.key ?? `objects[${index}]`;
    if (!object || typeof object !== "object") {
      invalid.push(`${label}: expected object`);
      continue;
    }
    if (typeof object.key !== "string" || object.key.length === 0) {
      invalid.push(`${label}: missing key`);
    }
    if (!Number.isSafeInteger(object.bytes) || object.bytes < 0) {
      invalid.push(`${label}: invalid bytes`);
    }
    if (typeof object.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(object.sha256)) {
      invalid.push(`${label}: invalid sha256`);
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Malformed remote manifest at ${manifestPath}: ${invalid.join("; ")}.`);
  }

  return manifest;
};

const existingAssetMatches = async (outputPath, object) => {
  try {
    const bytes = await fs.readFile(outputPath);
    return bytes.byteLength === object.bytes && sha256Buffer(bytes) === object.sha256;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};

const contentTypeFor = (filePath) => {
  switch (path.extname(filePath).toLowerCase()) {
    case ".json":
      return "application/json";
    case ".mov":
      return "video/quicktime";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    case ".woff2":
      return "font/woff2";
    case ".png":
      return "image/png";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
};

const gatewayObjectUrl = (config, key) =>
  `${config.uploadGatewayUrl}/objects/${key.split("/").map(encodeURIComponent).join("/")}`;

const uploadAndVerifyObjectViaGateway = async ({ config, filePath, key, fetchImpl }) => {
  if (!config.uploadGatewayToken) {
    throw new Error("R2_UPLOAD_GATEWAY_URL is set but R2_UPLOAD_GATEWAY_TOKEN is missing.");
  }
  const bytes = await fs.readFile(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const url = gatewayObjectUrl(config, key);
  const putResponse = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: "PUT",
      headers: {
        "content-type": contentTypeFor(filePath),
        "x-content-sha256": hash,
        "x-upload-token": config.uploadGatewayToken,
      },
      body: bytes,
    },
    config.requestTimeoutMs,
  );
  if (!putResponse.ok) {
    throw new Error(
      `R2 gateway PUT failed for ${key}: ${putResponse.status} ${putResponse.statusText}`,
    );
  }

  const getResponse = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: "GET",
      headers: { "x-upload-token": config.uploadGatewayToken },
    },
    config.requestTimeoutMs,
  );
  if (!getResponse.ok) {
    throw new Error(
      `R2 gateway verification GET failed for ${key}: ${getResponse.status} ${getResponse.statusText}`,
    );
  }
  const remoteBytes = Buffer.from(await getResponse.arrayBuffer());
  const remoteHash = createHash("sha256").update(remoteBytes).digest("hex");
  if (remoteBytes.byteLength !== bytes.byteLength || remoteHash !== hash) {
    throw new Error(
      `R2 gateway verification mismatch for ${key}: local=${bytes.byteLength}/${hash} remote=${remoteBytes.byteLength}/${remoteHash}`,
    );
  }

  return {
    key,
    bytes: bytes.byteLength,
    sha256: hash,
    contentType: contentTypeFor(filePath),
    ...buildRemoteUrl({ config, key }),
  };
};

const downloadAndVerifyObjectViaGateway = async ({ config, object, fetchImpl }) => {
  if (!config.uploadGatewayToken) {
    throw new Error("R2_UPLOAD_GATEWAY_URL is set but R2_UPLOAD_GATEWAY_TOKEN is missing.");
  }
  const response = await fetchWithTimeout(
    fetchImpl,
    gatewayObjectUrl(config, object.key),
    {
      method: "GET",
      headers: { "x-upload-token": config.uploadGatewayToken },
    },
    config.requestTimeoutMs,
  );
  if (!response.ok) {
    throw new Error(
      `R2 gateway hydrate GET failed for ${object.key}: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = sha256Buffer(bytes);
  if (bytes.byteLength !== object.bytes || hash !== object.sha256) {
    throw new Error(
      `R2 hydrate verification mismatch for ${object.key}: expected=${object.bytes}/${object.sha256} received=${bytes.byteLength}/${hash}`,
    );
  }
  return bytes;
};

export const uploadAndVerifyObject = async ({ config, filePath, key, fetchImpl = fetch }) => {
  if (config.uploadGatewayUrl) {
    return uploadAndVerifyObjectViaGateway({ config, filePath, key, fetchImpl });
  }

  const bytes = await fs.readFile(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const headers = {
    "content-type": contentTypeFor(filePath),
    "x-amz-meta-sha256": hash,
  };
  const put = signR2Request({ config, method: "PUT", key, payloadHash: hash, headers });
  const putResponse = await fetchWithTimeout(
    fetchImpl,
    put.url,
    {
      method: "PUT",
      headers: put.headers,
      body: bytes,
    },
    config.requestTimeoutMs,
  );
  if (!putResponse.ok) {
    throw new Error(`R2 PUT failed for ${key}: ${putResponse.status} ${putResponse.statusText}`);
  }

  const get = signR2Request({
    config,
    method: "GET",
    key,
    payloadHash: "UNSIGNED-PAYLOAD",
    expiresSeconds: config.signedUrlTtlSeconds,
  });
  const getResponse = await fetchWithTimeout(
    fetchImpl,
    get.url,
    { method: "GET", headers: get.headers },
    config.requestTimeoutMs,
  );
  if (!getResponse.ok) {
    throw new Error(
      `R2 verification GET failed for ${key}: ${getResponse.status} ${getResponse.statusText}`,
    );
  }
  const remoteBytes = Buffer.from(await getResponse.arrayBuffer());
  const remoteHash = createHash("sha256").update(remoteBytes).digest("hex");
  if (remoteBytes.byteLength !== bytes.byteLength || remoteHash !== hash) {
    throw new Error(
      `R2 verification mismatch for ${key}: local=${bytes.byteLength}/${hash} remote=${remoteBytes.byteLength}/${remoteHash}`,
    );
  }

  return {
    key,
    bytes: bytes.byteLength,
    sha256: hash,
    contentType: headers["content-type"],
    ...buildRemoteUrl({ config, key }),
  };
};

const categoryForExt = (ext) => {
  if (ext === ".json" || ext === ".mp3" || ext === ".wav" || ext === ".m4a") return "audio";
  if (ext === ".woff2") return "fonts";
  return "images";
};

export const collectEpisodeArtifacts = async ({ episodeDir, renderPath, slug, runId }) => {
  const artifacts = [
    {
      category: "renders",
      localPath: path.resolve(renderPath),
      manifest: "render",
      key: objectKeyFor({ slug, runId, category: "renders", filename: path.basename(renderPath) }),
    },
  ];
  const assetsDir = path.join(episodeDir, "assets");
  let assetEntries = [];
  try {
    assetEntries = await fs.readdir(assetsDir, { withFileTypes: true });
  } catch {
    return artifacts;
  }
  for (const entry of assetEntries) {
    if (!entry.isFile()) continue;
    const assetPath = path.join(assetsDir, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    if (!BINARY_ASSET_EXTENSIONS.has(ext) && !TEXT_ASSET_NAMES.has(entry.name)) continue;
    const category = categoryForExt(ext);
    artifacts.push({
      category,
      localPath: assetPath,
      manifest: "assets",
      key: objectKeyFor({
        slug,
        runId,
        category,
        filename: entry.name,
      }),
    });
  }
  return artifacts;
};

export const writeRemoteManifests = async ({
  episodeDir,
  slug,
  runId,
  uploaded,
  config,
  deleteLocal,
}) => {
  const generatedAt = new Date().toISOString();
  const base = {
    provider: "cloudflare-r2",
    bucket: config.bucket,
    episodeSlug: slug,
    runId,
    generatedAt,
    deleteLocal,
  };
  const toEntry = (item) => ({
    key: item.key,
    category: item.category,
    bytes: item.bytes,
    sha256: item.sha256,
    contentType: item.contentType,
    urlStrategy: item.strategy,
    url: item.url,
    signedUrlTtlSeconds: item.signedUrlTtlSeconds,
  });

  const renderManifest = {
    ...base,
    objects: uploaded.filter((item) => item.manifest === "render").map(toEntry),
  };
  const assetsManifestPath = path.join(episodeDir, "assets.remote.json");
  const newAssetEntries = uploaded.filter((item) => item.manifest === "assets").map(toEntry);
  let existingAssetEntries = [];
  try {
    const existing = JSON.parse(await fs.readFile(assetsManifestPath, "utf8"));
    if (Array.isArray(existing?.objects)) {
      existingAssetEntries = existing.objects;
    }
  } catch {
    existingAssetEntries = [];
  }
  const mergedAssetsByKey = new Map(existingAssetEntries.map((entry) => [entry.key, entry]));
  for (const entry of newAssetEntries) {
    mergedAssetsByKey.set(entry.key, entry);
  }
  const assetsManifest = {
    ...base,
    objects: [...mergedAssetsByKey.values()],
  };

  await fs.writeFile(
    path.join(episodeDir, "render.remote.json"),
    `${JSON.stringify(renderManifest, null, 2)}\n`,
  );
  await fs.writeFile(assetsManifestPath, `${JSON.stringify(assetsManifest, null, 2)}\n`);

  return { renderManifest, assetsManifest };
};

export const publishEpisodeArtifacts = async ({
  slug,
  episodeDir,
  renderPath,
  runId = createRunId(),
  deleteLocal = false,
  env = Bun.env,
  fetchImpl = fetch,
}) => {
  const config = assertR2Config(env);
  const artifacts = await collectEpisodeArtifacts({ episodeDir, renderPath, slug, runId });
  const uploaded = [];
  for (const artifact of artifacts) {
    const remote = await uploadAndVerifyObject({
      config,
      filePath: artifact.localPath,
      key: artifact.key,
      fetchImpl,
    });
    uploaded.push({ ...artifact, ...remote });
  }
  const manifests = await writeRemoteManifests({
    episodeDir,
    slug,
    runId,
    uploaded,
    config,
    deleteLocal,
  });
  if (deleteLocal) {
    for (const artifact of uploaded) {
      if (artifact.manifest === "render") {
        await fs.rm(artifact.localPath, { force: true });
      }
    }
  }
  return { runId, uploaded, manifests };
};

export const hydrateEpisodeArtifacts = async ({
  manifestPath,
  destinationDir,
  env = Bun.env,
  fetchImpl = fetch,
}) => {
  const config = assertR2Config(env);
  const manifest = await readRemoteManifest(manifestPath);
  const restored = [];
  for (const object of manifest.objects ?? []) {
    const outputPath = path.resolve(destinationDir, path.basename(object.key));
    if (await existingAssetMatches(outputPath, object)) {
      continue;
    }
    const bytes = config.uploadGatewayUrl
      ? await downloadAndVerifyObjectViaGateway({ config, object, fetchImpl })
      : await (async () => {
          const signed = signR2Request({
            config,
            method: "GET",
            key: object.key,
            payloadHash: "UNSIGNED-PAYLOAD",
            expiresSeconds: config.signedUrlTtlSeconds,
          });
          const response = await fetchWithTimeout(
            fetchImpl,
            signed.url,
            { method: "GET", headers: signed.headers },
            config.requestTimeoutMs,
          );
          if (!response.ok) {
            throw new Error(
              `R2 hydrate GET failed for ${object.key}: ${response.status} ${response.statusText}`,
            );
          }
          const downloadedBytes = Buffer.from(await response.arrayBuffer());
          const hash = sha256Buffer(downloadedBytes);
          if (downloadedBytes.byteLength !== object.bytes || hash !== object.sha256) {
            throw new Error(
              `R2 hydrate verification mismatch for ${object.key}: expected=${object.bytes}/${object.sha256} received=${downloadedBytes.byteLength}/${hash}`,
            );
          }
          return downloadedBytes;
        })();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes);
    restored.push(outputPath);
  }
  return restored;
};
