import { env as defaultEnv } from "./env";
import { encodeKey, sha256Hex, signRequest } from "./sign";

export interface R2ClientEnv {
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT_URL?: string;
  R2_REQUEST_TIMEOUT_MS?: string;
  R2_UPLOAD_GATEWAY_URL?: string;
  R2_UPLOAD_GATEWAY_TOKEN?: string;
  R2_ACCESS_KEY_ID_WRITE?: string;
  R2_SECRET_ACCESS_KEY_WRITE?: string;
}

export interface R2Config {
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint: string;
  endpointPrefix: string;
  requestTimeoutMs: number;
  uploadGatewayUrl?: string;
  uploadGatewayToken?: string;
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface ObjectArgs {
  bucket: string;
  key: string;
  fetchImpl?: FetchImpl;
  env?: R2ClientEnv;
}

export interface PutObjectArgs extends ObjectArgs {
  body: Buffer | Uint8Array | string;
  contentType: string;
}

export interface GetObjectResult {
  body: Buffer;
  contentType: string | null;
}

export interface HeadObjectResult {
  contentLength: number | null;
  contentType: string | null;
}

const resolveConfig = (bucket: string, runtimeEnv: R2ClientEnv = defaultEnv): R2Config | null => {
  if (!runtimeEnv.R2_ACCOUNT_ID || !runtimeEnv.R2_BUCKET || runtimeEnv.R2_BUCKET !== bucket)
    return null;
  const endpointUrl = new URL(
    runtimeEnv.R2_ENDPOINT_URL || `https://${runtimeEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  );
  const endpointPrefix =
    endpointUrl.pathname && endpointUrl.pathname !== "/"
      ? endpointUrl.pathname.replace(/\/$/, "")
      : `/${runtimeEnv.R2_BUCKET}`;
  return {
    bucket,
    accessKeyId: runtimeEnv.R2_ACCESS_KEY_ID_WRITE,
    secretAccessKey: runtimeEnv.R2_SECRET_ACCESS_KEY_WRITE,
    endpoint: endpointUrl.origin,
    endpointPrefix,
    requestTimeoutMs: Number.parseInt(runtimeEnv.R2_REQUEST_TIMEOUT_MS || "60000", 10),
    uploadGatewayUrl: runtimeEnv.R2_UPLOAD_GATEWAY_URL?.replace(/\/$/, ""),
    uploadGatewayToken: runtimeEnv.R2_UPLOAD_GATEWAY_TOKEN,
  };
};

const hasGatewayTransport = (config: R2Config): boolean =>
  Boolean(config.uploadGatewayUrl && config.uploadGatewayToken);
const hasDirectTransport = (
  config: R2Config,
): config is R2Config & { accessKeyId: string; secretAccessKey: string } =>
  Boolean(config.accessKeyId && config.secretAccessKey);

const requireConfig = (bucket: string, runtimeEnv?: R2ClientEnv): R2Config => {
  const config = resolveConfig(bucket, runtimeEnv);
  if (!config || (!hasGatewayTransport(config) && !hasDirectTransport(config))) {
    throw new Error("R2 transport is not configured.");
  }
  return config;
};

const fetchWithTimeout = (
  fetchImpl: FetchImpl,
  url: string,
  init: RequestInit,
  timeoutMs: number,
) => {
  if (fetchImpl !== fetch || !Number.isFinite(timeoutMs) || timeoutMs <= 0)
    return fetchImpl(url, init);
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
};

const gatewayObjectUrl = (config: R2Config, key: string) =>
  `${config.uploadGatewayUrl}/objects/${key.split("/").map(encodeURIComponent).join("/")}`;

const toBuffer = async (response: Response): Promise<Buffer> =>
  Buffer.from(await response.arrayBuffer());

export const isR2Configured = ({ bucket, env }: { bucket: string; env?: R2ClientEnv }): boolean => {
  const config = resolveConfig(bucket, env);
  return Boolean(config && (hasGatewayTransport(config) || hasDirectTransport(config)));
};

export const putObject = async ({
  bucket,
  key,
  body,
  contentType,
  fetchImpl = fetch,
  env,
}: PutObjectArgs): Promise<void> => {
  const config = requireConfig(bucket, env);
  const bytes = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
  const hash = sha256Hex(bytes);
  if (hasGatewayTransport(config)) {
    const response = await fetchWithTimeout(
      fetchImpl,
      gatewayObjectUrl(config, key),
      {
        method: "PUT",
        headers: {
          "content-type": contentType,
          "x-content-sha256": hash,
          "x-upload-token": config.uploadGatewayToken ?? "",
        },
        body: bytes,
      },
      config.requestTimeoutMs,
    );
    if (!response.ok)
      throw new Error(
        `R2 gateway PUT failed for ${key}: ${response.status} ${response.statusText}`,
      );
    return;
  }

  if (!hasDirectTransport(config)) throw new Error("R2 direct-S3 transport is not configured.");
  const signed = signRequest({
    config: { ...config, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    method: "PUT",
    key,
    payloadHash: hash,
    headers: { "content-type": contentType, "x-amz-meta-sha256": hash },
  });
  const response = await fetchWithTimeout(
    fetchImpl,
    signed.url,
    { method: "PUT", headers: signed.headers, body: bytes },
    config.requestTimeoutMs,
  );
  if (!response.ok)
    throw new Error(`R2 PUT failed for ${key}: ${response.status} ${response.statusText}`);
};

export const getObject = async ({
  bucket,
  key,
  fetchImpl = fetch,
  env,
}: ObjectArgs): Promise<GetObjectResult | null> => {
  const config = requireConfig(bucket, env);
  const response = hasGatewayTransport(config)
    ? await fetchWithTimeout(
        fetchImpl,
        gatewayObjectUrl(config, key),
        { method: "GET", headers: { "x-upload-token": config.uploadGatewayToken ?? "" } },
        config.requestTimeoutMs,
      )
    : await (async () => {
        if (!hasDirectTransport(config))
          throw new Error("R2 direct-S3 transport is not configured.");
        const signed = signRequest({
          config: {
            ...config,
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          method: "GET",
          key,
          payloadHash: "UNSIGNED-PAYLOAD",
        });
        return fetchWithTimeout(
          fetchImpl,
          signed.url,
          { method: "GET", headers: signed.headers },
          config.requestTimeoutMs,
        );
      })();
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`R2 GET failed for ${key}: ${response.status} ${response.statusText}`);
  return { body: await toBuffer(response), contentType: response.headers.get("content-type") };
};

export const headObject = async ({
  bucket,
  key,
  fetchImpl = fetch,
  env,
}: ObjectArgs): Promise<HeadObjectResult | null> => {
  const config = requireConfig(bucket, env);
  const response = hasGatewayTransport(config)
    ? await fetchWithTimeout(
        fetchImpl,
        gatewayObjectUrl(config, key),
        { method: "HEAD", headers: { "x-upload-token": config.uploadGatewayToken ?? "" } },
        config.requestTimeoutMs,
      )
    : await (async () => {
        if (!hasDirectTransport(config))
          throw new Error("R2 direct-S3 transport is not configured.");
        const signed = signRequest({
          config: {
            ...config,
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          method: "HEAD",
          key,
          payloadHash: "UNSIGNED-PAYLOAD",
        });
        return fetchWithTimeout(
          fetchImpl,
          signed.url,
          { method: "HEAD", headers: signed.headers },
          config.requestTimeoutMs,
        );
      })();
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`R2 HEAD failed for ${key}: ${response.status} ${response.statusText}`);
  const contentLength = response.headers.get("content-length");
  return {
    contentLength: contentLength ? Number.parseInt(contentLength, 10) : null,
    contentType: response.headers.get("content-type"),
  };
};

export { encodeKey };
