import { createHash, createHmac } from "node:crypto";

const REGION = "auto";
const SERVICE = "s3";

export interface SignConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  endpointPrefix: string;
}

export interface SignRequestArgs {
  config: SignConfig;
  method: string;
  key: string;
  payloadHash: string;
  headers?: Record<string, string>;
  now?: Date;
}

const hmac = (key: string | Buffer, value: string): Buffer => createHmac("sha256", key).update(value).digest();

const hmacHex = (key: string | Buffer, value: string): string =>
  createHmac("sha256", key).update(value).digest("hex");

const signingKey = (secretAccessKey: string, dateStamp: string) => {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
};

export const sha256Hex = (value: string | Buffer | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

export const encodeKey = (key: string): string => key.split("/").map(encodeURIComponent).join("/");

export const timestamp = (date: Date): string => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const signedHeadersString = (headers: Record<string, string>): string => Object.keys(headers).sort().join(";");

const canonicalHeaderString = (headers: Record<string, string>): string =>
  `${Object.keys(headers)
    .sort()
    .map((key) => `${key}:${String(headers[key]).trim().replace(/\s+/g, " ")}`)
    .join("\n")}\n`;

export const createCanonicalRequest = ({
  config,
  method,
  key,
  payloadHash,
  headers = {},
  now = new Date(),
}: SignRequestArgs): { canonicalRequest: string; signedHeaders: string; amzDate: string } => {
  const host = new URL(config.endpoint).host;
  const amzDate = timestamp(now);
  const canonicalUri = `${config.endpointPrefix}/${encodeKey(key)}`;
  const normalizedHeaders = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])),
  };
  const signedHeaders = signedHeadersString(normalizedHeaders);
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaderString(normalizedHeaders),
    signedHeaders,
    payloadHash,
  ].join("\n");
  return { canonicalRequest, signedHeaders, amzDate };
};

export const createStringToSign = (canonicalRequest: string, amzDate: string): string => {
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  return ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
};

export const signRequest = (args: SignRequestArgs): { url: string; headers: Record<string, string> } => {
  const { canonicalRequest, signedHeaders, amzDate } = createCanonicalRequest(args);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = createStringToSign(canonicalRequest, amzDate);
  const signature = hmacHex(signingKey(args.config.secretAccessKey, dateStamp), stringToSign);
  return {
    url: `${args.config.endpoint}${args.config.endpointPrefix}/${encodeKey(args.key)}`,
    headers: {
      host: new URL(args.config.endpoint).host,
      "x-amz-content-sha256": args.payloadHash,
      "x-amz-date": amzDate,
      ...Object.fromEntries(Object.entries(args.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])),
      authorization:
        `AWS4-HMAC-SHA256 Credential=${args.config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
};

export interface PresignRequestArgs extends SignRequestArgs {
  expiresSeconds: number;
}

export const presignRequest = ({
  config,
  method,
  key,
  payloadHash,
  headers = {},
  now = new Date(),
  expiresSeconds,
}: PresignRequestArgs): { url: string; headers: Record<string, string> } => {
  const host = new URL(config.endpoint).host;
  const amzDate = timestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalUri = `${config.endpointPrefix}/${encodeKey(key)}`;
  const requestHeaders: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])),
  };
  const signedHeaders = signedHeadersString(requestHeaders);
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQueryString = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaderString(requestHeaders),
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmacHex(signingKey(config.secretAccessKey, dateStamp), stringToSign);

  return {
    url: `${config.endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`,
    headers: requestHeaders,
  };
};
