import { createHash, createHmac } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  decodeRemoteManifest,
  type FetchLike,
  fetchWithRetryPromise,
  formatParseError,
  type RemoteManifest,
  type RemoteObject,
  runPromiseOrThrow,
} from "@cgaravitoq/spec";
import { Effect, Result } from "effect";

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

export type R2Env = Record<string, string | undefined>;

const baseR2EnvKeys = ["R2_ACCOUNT_ID", "R2_BUCKET"];
const gatewayR2EnvKeys = ["R2_UPLOAD_GATEWAY_URL", "R2_UPLOAD_GATEWAY_TOKEN"];
const directS3R2EnvKeys = ["R2_ACCESS_KEY_ID_WRITE", "R2_SECRET_ACCESS_KEY_WRITE"];

export const requiredR2EnvKeys = baseR2EnvKeys;

const missingKeys = (env: R2Env, keys: string[]): string[] => keys.filter((key) => !env[key]);

const hasGatewayR2Transport = (env: R2Env): boolean =>
  missingKeys(env, gatewayR2EnvKeys).length === 0;

const hasDirectS3R2Transport = (env: R2Env): boolean =>
  missingKeys(env, directS3R2EnvKeys).length === 0;

const hasCloudflareApiTransport = (env: R2Env): boolean => Boolean(env.CLOUDFLARE_API_TOKEN);

const transportErrorMessage =
  "Set one of: CLOUDFLARE_API_TOKEN, or R2_UPLOAD_GATEWAY_URL + R2_UPLOAD_GATEWAY_TOKEN, or " +
  "R2_ACCESS_KEY_ID_WRITE + R2_SECRET_ACCESS_KEY_WRITE.";

const parseDotenv = (source: string): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
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

const findWorkspaceEnvPath = (startDir: string = import.meta.dirname): string | null => {
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

export const loadWorkspaceEnv = ({
  env = Bun.env as R2Env,
  startDir = import.meta.dirname,
}: {
  env?: R2Env;
  startDir?: string;
} = {}): boolean => {
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

export interface R2ArtifactsConfig {
  accountId: string;
  bucket: string;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  endpoint: string;
  endpointPrefix: string;
  publicBaseUrl: string;
  signedUrlTtlSeconds: number;
  requestTimeoutMs: number;
  uploadGatewayUrl: string;
  uploadGatewayToken: string;
  cloudflareApiToken: string;
}

export const assertR2Config = (env: R2Env = Bun.env as R2Env): R2ArtifactsConfig => {
  if (env === Bun.env && missingKeys(env, baseR2EnvKeys).length > 0) {
    loadWorkspaceEnv({ env });
  }
  const missingBase = missingKeys(env, baseR2EnvKeys);
  const hasTransport =
    hasGatewayR2Transport(env) || hasCloudflareApiTransport(env) || hasDirectS3R2Transport(env);
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
    accountId: env.R2_ACCOUNT_ID as string,
    bucket: env.R2_BUCKET as string,
    accessKeyId: env.R2_ACCESS_KEY_ID_WRITE,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY_WRITE,
    endpoint: endpointUrl.origin,
    endpointPrefix,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL || env.R2_PUBLIC_URL_BASE || "",
    signedUrlTtlSeconds: Number.parseInt(env.R2_SIGNED_URL_TTL_SECONDS || "3600", 10),
    requestTimeoutMs: Number.parseInt(env.R2_REQUEST_TIMEOUT_MS || "60000", 10),
    uploadGatewayUrl: env.R2_UPLOAD_GATEWAY_URL?.replace(/\/$/, "") || "",
    uploadGatewayToken: env.R2_UPLOAD_GATEWAY_TOKEN || "",
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN || "",
  };
};

export const missingR2EnvKeys = (env: R2Env = Bun.env as R2Env): string[] => {
  if (env === Bun.env && missingKeys(env, baseR2EnvKeys).length > 0) {
    loadWorkspaceEnv({ env });
  }
  const missingBase = missingKeys(env, baseR2EnvKeys);
  if (hasGatewayR2Transport(env) || hasCloudflareApiTransport(env) || hasDirectS3R2Transport(env)) {
    return missingBase;
  }

  const missingGateway = missingKeys(env, gatewayR2EnvKeys);
  const missingDirectS3 = missingKeys(env, directS3R2EnvKeys);
  const missingTransport =
    missingGateway.length <= missingDirectS3.length ? missingGateway : missingDirectS3;
  return [...missingBase, ...missingTransport];
};

export interface R2PublishOptions {
  upload: boolean;
  deleteLocal: boolean;
  missing: string[];
  warning: string | null;
}

export const resolveR2PublishOptions = ({
  env = Bun.env as R2Env,
  upload,
  localOnly = false,
  keepLocal = false,
  deleteLocal = true,
}: {
  env?: R2Env;
  upload?: string;
  localOnly?: boolean;
  keepLocal?: boolean;
  deleteLocal?: boolean;
} = {}): R2PublishOptions => {
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

export const createRunId = (date: Date = new Date()): string =>
  date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[:]/g, "")
    .replace("T", "T");

export const objectKeyFor = ({
  slug,
  category,
  filename,
  projectPrefix = DEFAULT_PROJECT_PREFIX,
}: {
  slug: string;
  category: string;
  filename: string;
  projectPrefix?: string;
}): string => `${projectPrefix}/episodes/${slug}/final/${category}/${filename}`;

export const sha256Hex = async (filePath: string): Promise<string> => {
  const bytes = await fs.readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
};

const sha256Buffer = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const hmac = (key: string | Buffer, value: string): Buffer =>
  createHmac("sha256", key).update(value).digest();
const hmacHex = (key: string | Buffer, value: string): string =>
  createHmac("sha256", key).update(value).digest("hex");

const signingKey = (secretAccessKey: string, dateStamp: string): Buffer => {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
};

const encodeKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

const timestamp = (date: Date): string => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const signedHeadersString = (headers: Record<string, string>): string =>
  Object.keys(headers).sort().join(";");

const canonicalHeaderString = (headers: Record<string, string>): string =>
  `${Object.keys(headers)
    .sort()
    .map((key) => `${key}:${String(headers[key]).trim().replace(/\s+/g, " ")}`)
    .join("\n")}\n`;

export interface SignedR2Request {
  url: string;
  headers: Record<string, string>;
}

export const signR2Request = ({
  config,
  method,
  key,
  payloadHash,
  headers = {},
  now = new Date(),
  expiresSeconds,
}: {
  config: R2ArtifactsConfig;
  method: string;
  key: string;
  payloadHash: string;
  headers?: Record<string, string>;
  now?: Date;
  expiresSeconds?: number;
}): SignedR2Request => {
  const host = new URL(config.endpoint).host;
  const amzDate = timestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalUri = `${config.endpointPrefix}/${encodeKey(key)}`;
  const normalizedHeaders: Record<string, string> = {
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
  const signature = hmacHex(signingKey(config.secretAccessKey ?? "", dateStamp), stringToSign);
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

export interface RemoteUrlInfo {
  strategy: "signed-url" | "public-url";
  url: string | null;
  signedUrlTtlSeconds: number | null;
}

export const buildRemoteUrl = ({
  config,
  key,
}: {
  config: R2ArtifactsConfig;
  key: string;
}): RemoteUrlInfo => {
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

const doFetch = (
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  if (fetchImpl !== fetch || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetchImpl(url, init);
  }
  return fetchWithRetryPromise(url, init, { timeoutMs });
};

const readRemoteManifest = async (manifestPath: string): Promise<RemoteManifest> => {
  let source: string;
  try {
    source = await fs.readFile(manifestPath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read remote manifest at ${manifestPath}: ${detail}`);
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Malformed remote manifest at ${manifestPath}: ${detail}`);
  }

  const decoded = decodeRemoteManifest(manifest);
  if (Result.isFailure(decoded)) {
    throw new Error(
      `Malformed remote manifest at ${manifestPath}: ${formatParseError(decoded.failure, "manifest").join("; ")}.`,
    );
  }

  return manifest as RemoteManifest;
};

const existingAssetMatches = async (outputPath: string, object: RemoteObject): Promise<boolean> => {
  try {
    const bytes = await fs.readFile(outputPath);
    return bytes.byteLength === object.bytes && sha256Buffer(bytes) === object.sha256;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

const contentTypeFor = (filePath: string): string => {
  switch (path.extname(filePath).toLowerCase()) {
    case ".json":
      return "application/json";
    case ".md":
      return "text/markdown";
    case ".mov":
      return "video/quicktime";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain";
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

const gatewayObjectUrl = (config: R2ArtifactsConfig, key: string): string =>
  `${config.uploadGatewayUrl}/objects/${key.split("/").map(encodeURIComponent).join("/")}`;

export interface UploadedObjectInfo extends RemoteUrlInfo {
  key: string;
  bytes: number;
  sha256: string;
  contentType: string;
}

interface UploadObjectArgs {
  config: R2ArtifactsConfig;
  filePath?: string;
  key: string;
  bytes?: Buffer;
  contentType?: string;
  fetchImpl?: FetchLike;
}

const uploadAndVerifyObjectViaGateway = async ({
  config,
  filePath,
  key,
  bytes: bodyBytes,
  contentType,
  fetchImpl = fetch,
}: UploadObjectArgs): Promise<UploadedObjectInfo> => {
  if (!config.uploadGatewayToken) {
    throw new Error("R2_UPLOAD_GATEWAY_URL is set but R2_UPLOAD_GATEWAY_TOKEN is missing.");
  }
  const bytes = bodyBytes ?? (await fs.readFile(filePath as string));
  const type = contentType ?? contentTypeFor(filePath ?? key);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const url = gatewayObjectUrl(config, key);
  const putResponse = await doFetch(
    fetchImpl,
    url,
    {
      method: "PUT",
      headers: {
        "content-type": type,
        "x-content-sha256": hash,
        "x-upload-token": config.uploadGatewayToken,
      },
      body: bytes as Uint8Array<ArrayBuffer>,
    },
    config.requestTimeoutMs,
  );
  if (!putResponse.ok) {
    throw new Error(
      `R2 gateway PUT failed for ${key}: ${putResponse.status} ${putResponse.statusText}`,
    );
  }

  const getResponse = await doFetch(
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
    contentType: type,
    ...buildRemoteUrl({ config, key }),
  };
};

const downloadAndVerifyObjectViaGateway = async ({
  config,
  object,
  fetchImpl = fetch,
}: {
  config: R2ArtifactsConfig;
  object: RemoteObject;
  fetchImpl?: FetchLike;
}): Promise<Buffer> => {
  if (!config.uploadGatewayToken) {
    throw new Error("R2_UPLOAD_GATEWAY_URL is set but R2_UPLOAD_GATEWAY_TOKEN is missing.");
  }
  const response = await doFetch(
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

const uploadAndVerifyObjectViaS3 = async ({
  config,
  filePath,
  key,
  bytes: bodyBytes,
  contentType,
  fetchImpl = fetch,
}: UploadObjectArgs): Promise<UploadedObjectInfo> => {
  const bytes = bodyBytes ?? (await fs.readFile(filePath as string));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const headers = {
    "content-type": contentType ?? contentTypeFor(filePath ?? key),
    "x-amz-meta-sha256": hash,
  };
  const put = signR2Request({ config, method: "PUT", key, payloadHash: hash, headers });
  const putResponse = await doFetch(
    fetchImpl,
    put.url,
    {
      method: "PUT",
      headers: put.headers,
      body: bytes as Uint8Array<ArrayBuffer>,
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
  const getResponse = await doFetch(
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

const cloudflareApiObjectUrl = (config: R2ArtifactsConfig, key: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const uploadAndVerifyObjectViaCloudflareApi = async ({
  config,
  filePath,
  key,
  bytes: bodyBytes,
  contentType,
  fetchImpl = fetch,
}: UploadObjectArgs): Promise<UploadedObjectInfo> => {
  const bytes = bodyBytes ?? (await fs.readFile(filePath as string));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const ct = contentType ?? contentTypeFor(filePath ?? key);
  const url = cloudflareApiObjectUrl(config, key);
  const auth = `Bearer ${config.cloudflareApiToken}`;
  const putResponse = await doFetch(
    fetchImpl,
    url,
    {
      method: "PUT",
      headers: { authorization: auth, "content-type": ct },
      body: bytes as Uint8Array<ArrayBuffer>,
    },
    config.requestTimeoutMs,
  );
  if (!putResponse.ok) {
    throw new Error(
      `R2 Cloudflare-API PUT failed for ${key}: ${putResponse.status} ${putResponse.statusText}`,
    );
  }
  const getResponse = await doFetch(
    fetchImpl,
    url,
    { method: "GET", headers: { authorization: auth } },
    config.requestTimeoutMs,
  );
  if (!getResponse.ok) {
    throw new Error(
      `R2 Cloudflare-API verification GET failed for ${key}: ${getResponse.status} ${getResponse.statusText}`,
    );
  }
  const remoteBytes = Buffer.from(await getResponse.arrayBuffer());
  const remoteHash = createHash("sha256").update(remoteBytes).digest("hex");
  if (remoteBytes.byteLength !== bytes.byteLength || remoteHash !== hash) {
    throw new Error(`R2 Cloudflare-API verification mismatch for ${key}`);
  }
  return {
    key,
    bytes: bytes.byteLength,
    sha256: hash,
    contentType: ct,
    ...buildRemoteUrl({ config, key }),
  };
};

export const uploadAndVerifyObject = async (
  args: UploadObjectArgs,
): Promise<UploadedObjectInfo> => {
  const { config, key } = args;
  const attempts: Array<[string, boolean, () => Promise<UploadedObjectInfo>]> = [
    ["gateway", Boolean(config.uploadGatewayUrl), () => uploadAndVerifyObjectViaGateway(args)],
    [
      "cloudflare-api",
      Boolean(config.cloudflareApiToken),
      () => uploadAndVerifyObjectViaCloudflareApi(args),
    ],
    [
      "s3",
      Boolean(config.accessKeyId && config.secretAccessKey),
      () => uploadAndVerifyObjectViaS3(args),
    ],
  ];
  const errors: string[] = [];
  for (const [name, enabled, run] of attempts) {
    if (!enabled) continue;
    try {
      return await run();
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message}`);
    }
  }
  throw new Error(
    `R2 upload failed for ${key}. ${errors.length ? `Tried — ${errors.join(" | ")}` : "No R2 transport configured."}`,
  );
};

const categoryForExt = (ext: string): string => {
  if (ext === ".json" || ext === ".mp3" || ext === ".wav" || ext === ".m4a") return "audio";
  if (ext === ".woff2") return "fonts";
  return "images";
};

const SOURCE_EPISODE_FILES = [
  "scene-spec.json",
  "meta.json",
  "hyperframes.json",
  "distribution.json",
];

const listFilesRecursive = async (dir: string): Promise<string[]> => {
  let entries: fsSync.Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath ?? dir, entry.name)))
    .sort();
};

export interface EpisodeArtifact {
  category: string;
  localPath: string;
  manifest: "render" | "assets" | "source";
  relPath: string | undefined;
  key: string;
}

export const collectEpisodeArtifacts = async ({
  episodeDir,
  renderPath,
  slug,
}: {
  episodeDir: string;
  renderPath: string;
  slug: string;
}): Promise<EpisodeArtifact[]> => {
  const appRoot = path.resolve(episodeDir, "..", "..", "..");
  const relTo = (filePath: string): string | undefined => {
    const rel = path.relative(appRoot, path.resolve(filePath));
    return rel.startsWith("..") ? undefined : rel.split(path.sep).join("/");
  };
  const artifacts: EpisodeArtifact[] = [
    {
      category: "renders",
      localPath: path.resolve(renderPath),
      manifest: "render",
      relPath: relTo(renderPath),
      key: objectKeyFor({ slug, category: "renders", filename: path.basename(renderPath) }),
    },
  ];
  const assetsDir = path.join(episodeDir, "assets");
  let assetEntries: fsSync.Dirent[] = [];
  try {
    assetEntries = await fs.readdir(assetsDir, { withFileTypes: true });
  } catch {
    assetEntries = [];
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
      relPath: relTo(assetPath),
      key: objectKeyFor({
        slug,
        category,
        filename: entry.name,
      }),
    });
  }

  const sourceFiles: Array<{ localPath: string; filename: string }> = [];
  for (const name of SOURCE_EPISODE_FILES) {
    const filePath = path.join(episodeDir, name);
    if (fsSync.existsSync(filePath)) sourceFiles.push({ localPath: filePath, filename: name });
  }
  const scriptPath = path.join(appRoot, "examples", `${slug}.txt`);
  if (fsSync.existsSync(scriptPath)) {
    sourceFiles.push({ localPath: scriptPath, filename: `examples/${slug}.txt` });
  }
  const generatedDir = path.join(assetsDir, "generated");
  for (const rel of await listFilesRecursive(generatedDir)) {
    sourceFiles.push({
      localPath: path.join(generatedDir, rel),
      filename: `assets/generated/${rel.split(path.sep).join("/")}`,
    });
  }
  for (const file of sourceFiles) {
    artifacts.push({
      category: "source",
      localPath: file.localPath,
      manifest: "source",
      relPath: relTo(file.localPath),
      key: objectKeyFor({ slug, category: "source", filename: file.filename }),
    });
  }
  return artifacts;
};

export type UploadedArtifact = EpisodeArtifact & UploadedObjectInfo;

interface ManifestSet {
  renderManifest: Record<string, unknown>;
  assetsManifest: Record<string, unknown>;
  sourceManifest: Record<string, unknown>;
}

const buildRemoteManifests = ({
  slug,
  runId,
  uploaded,
  config,
  deleteLocal,
}: {
  slug: string;
  runId: string;
  uploaded: UploadedArtifact[];
  config: R2ArtifactsConfig;
  deleteLocal: boolean;
}): ManifestSet => {
  const generatedAt = new Date().toISOString();
  const base = {
    provider: "cloudflare-r2",
    bucket: config.bucket,
    episodeSlug: slug,
    runId,
    generatedAt,
    deleteLocal,
  };
  const toEntry = (item: UploadedArtifact) => ({
    key: item.key,
    category: item.category,
    path: item.relPath,
    bytes: item.bytes,
    sha256: item.sha256,
    contentType: item.contentType,
    urlStrategy: item.strategy,
    url: item.url,
    signedUrlTtlSeconds: item.signedUrlTtlSeconds,
  });

  return {
    renderManifest: {
      ...base,
      objects: uploaded.filter((item) => item.manifest === "render").map(toEntry),
    },
    assetsManifest: {
      ...base,
      objects: uploaded.filter((item) => item.manifest === "assets").map(toEntry),
    },
    sourceManifest: {
      ...base,
      objects: uploaded.filter((item) => item.manifest === "source").map(toEntry),
    },
  };
};

export const downloadObjectBytes = async ({
  config,
  key,
  fetchImpl = fetch,
}: {
  config: R2ArtifactsConfig;
  key: string;
  fetchImpl?: FetchLike;
}): Promise<Buffer | null> => {
  const transports: Array<{ url: string; headers: Record<string, string> }> = [];
  if (config.uploadGatewayUrl) {
    transports.push({
      url: gatewayObjectUrl(config, key),
      headers: { "x-upload-token": config.uploadGatewayToken },
    });
  }
  if (config.cloudflareApiToken) {
    transports.push({
      url: cloudflareApiObjectUrl(config, key),
      headers: { authorization: `Bearer ${config.cloudflareApiToken}` },
    });
  }
  if (config.accessKeyId && config.secretAccessKey) {
    const signed = signR2Request({
      config,
      method: "GET",
      key,
      payloadHash: "UNSIGNED-PAYLOAD",
      expiresSeconds: config.signedUrlTtlSeconds,
    });
    transports.push({ url: signed.url, headers: signed.headers });
  }

  // Try each transport in order; first 200 wins. A 404 (or transport error) is
  // not trusted as "absent" until every transport has been tried — the gateway
  // 404s when its Worker is down, which must not be read as "object missing".
  for (const t of transports) {
    let response: Response;
    try {
      response = await doFetch(
        fetchImpl,
        t.url,
        { method: "GET", headers: t.headers },
        config.requestTimeoutMs,
      );
    } catch {
      continue;
    }
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  }
  return null;
};

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

export const publishEpisodeArtifacts = async ({
  slug,
  episodeDir,
  renderPath,
  runId = createRunId(),
  deleteLocal = false,
  env = Bun.env as R2Env,
  fetchImpl = fetch,
}: {
  slug: string;
  episodeDir: string;
  renderPath: string;
  runId?: string;
  deleteLocal?: boolean;
  env?: R2Env;
  fetchImpl?: FetchLike;
}): Promise<{
  runId: string;
  uploaded: UploadedArtifact[];
  manifests: ManifestSet;
  indexKey: string;
}> => {
  const config = assertR2Config(env);
  const artifacts = await collectEpisodeArtifacts({ episodeDir, renderPath, slug });

  const uploaded = await runPromiseOrThrow(
    Effect.forEach(
      artifacts,
      (artifact) =>
        Effect.tryPromise({
          try: () =>
            uploadAndVerifyObject({
              config,
              filePath: artifact.localPath,
              key: artifact.key,
              fetchImpl,
            }),
          catch: toError,
        }).pipe(Effect.map((remote) => ({ ...artifact, ...remote }))),
      { concurrency: 4 },
    ),
  );

  const manifests = buildRemoteManifests({ slug, runId, uploaded, config, deleteLocal });
  const manifestFiles = [
    ["render.remote.json", manifests.renderManifest],
    ["assets.remote.json", manifests.assetsManifest],
    ["source.remote.json", manifests.sourceManifest],
  ] as const;

  await runPromiseOrThrow(
    Effect.forEach(
      manifestFiles,
      ([name, manifest]) =>
        Effect.tryPromise({
          try: () =>
            uploadAndVerifyObject({
              config,
              key: objectKeyFor({ slug, category: "manifests", filename: name }),
              bytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
              contentType: "application/json",
              fetchImpl,
            }),
          catch: toError,
        }),
      { concurrency: 3 },
    ),
  );

  for (const [name, manifest] of manifestFiles) {
    await fs.writeFile(path.join(episodeDir, name), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const indexKey = `${DEFAULT_PROJECT_PREFIX}/index.json`;
  const existingIndexBytes = await downloadObjectBytes({ config, key: indexKey, fetchImpl });
  let index: { episodes: Record<string, unknown>; updatedAt?: string } = { episodes: {} };
  if (existingIndexBytes) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(existingIndexBytes.toString("utf8"));
    } catch {
      parsed = null;
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("episodes" in parsed) ||
      !parsed.episodes ||
      typeof parsed.episodes !== "object"
    ) {
      throw new Error(`Malformed R2 index at ${indexKey}; refusing to overwrite it.`);
    }
    index = parsed as { episodes: Record<string, unknown>; updatedAt?: string };
  }
  const updatedAt = new Date().toISOString();
  index.episodes[slug] = { finalRunId: runId, publishedAt: updatedAt };
  index.updatedAt = updatedAt;
  await uploadAndVerifyObject({
    config,
    key: indexKey,
    bytes: Buffer.from(`${JSON.stringify(index, null, 2)}\n`),
    contentType: "application/json",
    fetchImpl,
  });
  if (deleteLocal) {
    for (const artifact of uploaded) {
      if (artifact.manifest === "render") {
        await fs.rm(artifact.localPath, { force: true });
      }
    }
  }
  return { runId, uploaded, manifests, indexKey };
};

export const hydrateEpisodeArtifacts = async ({
  manifestPath,
  destinationDir,
  appRoot,
  protectExisting = false,
  env = Bun.env as R2Env,
  fetchImpl = fetch,
}: {
  manifestPath: string;
  destinationDir: string;
  appRoot?: string;
  protectExisting?: boolean;
  env?: R2Env;
  fetchImpl?: FetchLike;
}): Promise<string[]> => {
  const config = assertR2Config(env);
  const manifest = await readRemoteManifest(manifestPath);
  const outputPathFor = (object: RemoteObject): string => {
    if (appRoot && typeof object.path === "string" && object.path) {
      const resolvedRoot = path.resolve(appRoot);
      const outputPath = path.resolve(resolvedRoot, object.path);
      if (!outputPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error(`Refusing to hydrate ${object.key}: path escapes ${resolvedRoot}.`);
      }
      return outputPath;
    }
    return path.resolve(destinationDir, path.basename(object.key));
  };

  if (protectExisting) {
    const conflicts = [];
    for (const object of manifest.objects ?? []) {
      const outputPath = outputPathFor(object);
      if (fsSync.existsSync(outputPath) && !(await existingAssetMatches(outputPath, object))) {
        conflicts.push(outputPath);
      }
    }
    if (conflicts.length > 0) {
      throw new Error(
        `Local files differ from the published final:\n  ${conflicts.join("\n  ")}\n` +
          "Re-run with --force to overwrite them.",
      );
    }
  }

  const restored = [];
  for (const object of manifest.objects ?? []) {
    const outputPath = outputPathFor(object);
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
          const response = await doFetch(
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

export const hydrateEpisodeFinal = async ({
  slug,
  appRoot = process.cwd(),
  force = false,
  env = Bun.env as R2Env,
  fetchImpl = fetch,
}: {
  slug: string;
  appRoot?: string;
  force?: boolean;
  env?: R2Env;
  fetchImpl?: FetchLike;
}): Promise<{ runId: string | null; restored: string[] }> => {
  const config = assertR2Config(env);
  const episodeDir = path.resolve(appRoot, "src", "episodes", slug);
  await fs.mkdir(episodeDir, { recursive: true });
  try {
    await fs.symlink(path.join("..", "..", "lib"), path.join(episodeDir, "lib"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const restored = [];
  let runId: string | null = null;
  let manifestsFound = 0;
  for (const name of ["source.remote.json", "assets.remote.json", "render.remote.json"]) {
    const key = objectKeyFor({ slug, category: "manifests", filename: name });
    const bytes = await downloadObjectBytes({ config, key, fetchImpl });
    if (!bytes) continue;
    manifestsFound += 1;
    const manifestPath = path.join(episodeDir, name);
    await fs.writeFile(manifestPath, bytes);
    restored.push(manifestPath);
    runId ??= (JSON.parse(bytes.toString("utf8")) as { runId?: string }).runId ?? null;
    const destinationDir =
      name === "render.remote.json"
        ? path.resolve(appRoot, "renders")
        : path.join(episodeDir, "assets");
    restored.push(
      ...(await hydrateEpisodeArtifacts({
        manifestPath,
        destinationDir,
        appRoot,
        protectExisting: name === "source.remote.json" && !force,
        env,
        fetchImpl,
      })),
    );
  }
  if (manifestsFound === 0) {
    throw new Error(
      `No published final found in R2 for episode "${slug}". ` +
        "Publish it first with `bun run render:episode <slug> --upload=r2`.",
    );
  }
  return { runId, restored };
};
