import { createHash, createHmac } from "node:crypto";

const REGION = "auto";
const SERVICE = "s3";

export interface PresignConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  endpointPrefix: string;
}

export interface PresignGetArgs {
  config: PresignConfig;
  key: string;
  expiresSeconds: number;
  now?: Date;
}

const hmac = (key: string | Buffer, value: string): Buffer =>
  createHmac("sha256", key).update(value).digest();

const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

const encodeKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

const timestamp = (date: Date): string => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const signingKey = (secretAccessKey: string, dateStamp: string): Buffer => {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
};

/**
 * Browser-style presigned GET URL: signature lives entirely in the query
 * string and only `host` is a signed header, so any plain HTTP client
 * (Instagram's video fetcher included) can use the URL without extra
 * headers. r2-client's signRequest signs x-amz-content-sha256 and is NOT
 * usable for third-party fetchers.
 */
export const presignGetUrl = ({
  config,
  key,
  expiresSeconds,
  now = new Date(),
}: PresignGetArgs): string => {
  const host = new URL(config.endpoint).host;
  const amzDate = timestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalUri = `${config.endpointPrefix}/${encodeKey(key)}`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQueryString = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex");

  return `${config.endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
};
