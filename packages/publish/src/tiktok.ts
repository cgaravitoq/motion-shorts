import type { FetchLike } from "./fetch-like";
import { postTokenForm } from "./oauth";

const AUTH_ENDPOINT = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
const INBOX_INIT_ENDPOINT = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const STATUS_ENDPOINT = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

export const TIKTOK_UPLOAD_SCOPE = "video.upload";

// Content Posting chunk rules: 5-64MB per chunk, final chunk may reach 128MB;
// files up to 64MB go as a single whole-file chunk.
const CHUNK_SIZE = 64 * 1024 * 1024;

export interface TiktokOAuthConfig {
  clientKey: string;
  clientSecret: string;
}

export interface TiktokTokens {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
}

// Two error shapes coexist in the v2 API: Content Posting endpoints wrap an
// envelope {error:{code,message,log_id}} (code "ok" on success), while
// oauth/token uses the flat OAuth2 shape {error:"invalid_grant",
// error_description, log_id} with no error field at all on success.
interface TiktokError {
  error?: { code?: string; message?: string; log_id?: string } | string;
  error_description?: string;
  log_id?: string;
}

const tiktokJson = async <T>(response: Response, what: string): Promise<T> => {
  const text = await response.text();
  let json: (T & TiktokError) | null = null;
  try {
    json = JSON.parse(text) as T & TiktokError;
  } catch {
    json = null;
  }
  const err = json?.error;
  const envelopeFailed = typeof err === "object" && err !== null && err.code && err.code !== "ok";
  const flatFailed = typeof err === "string" && err !== "" && err !== "ok";
  if (!response.ok || !json || envelopeFailed || flatFailed) {
    let detail: string;
    if (typeof err === "object" && err !== null && err.code) {
      detail = `${err.message} (code ${err.code}, log_id ${err.log_id})`;
    } else if (typeof err === "string" && err !== "") {
      detail = `${err}${json?.error_description ? `: ${json.error_description}` : ""}${json?.log_id ? ` (log_id ${json.log_id})` : ""}`;
    } else {
      detail = `${response.status} ${response.statusText} — ${text.slice(0, 200)}`;
    }
    throw new Error(`${what} failed: ${detail}`);
  }
  return json;
};

export const tiktokAuthUrl = ({
  clientKey,
  redirectUri,
  state,
}: {
  clientKey: string;
  redirectUri: string;
  state: string;
}): string => {
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: TIKTOK_UPLOAD_SCOPE,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_ENDPOINT}?${params}`;
};

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_in: number;
  refresh_expires_in: number;
}

const tokenRequest = async (
  body: URLSearchParams,
  what: string,
  fetchImpl: FetchLike,
): Promise<TiktokTokens> => {
  const json = await postTokenForm({
    endpoint: TOKEN_ENDPOINT,
    body,
    fetchImpl,
    parse: (response) => tiktokJson<TokenResponse>(response, what),
  });
  if (!json.access_token) throw new Error(`${what} failed: no access_token in response`);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    openId: json.open_id,
    expiresInSeconds: json.expires_in,
    refreshExpiresInSeconds: json.refresh_expires_in,
  };
};

export const exchangeTiktokCode = async ({
  config,
  code,
  redirectUri,
  fetchImpl = fetch,
}: {
  config: TiktokOAuthConfig;
  code: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
}): Promise<TiktokTokens> =>
  tokenRequest(
    new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    "TikTok code exchange",
    fetchImpl,
  );

export const refreshTiktokToken = async ({
  config,
  refreshToken,
  fetchImpl = fetch,
}: {
  config: TiktokOAuthConfig;
  refreshToken: string;
  fetchImpl?: FetchLike;
}): Promise<TiktokTokens> =>
  tokenRequest(
    new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    "TikTok token refresh",
    fetchImpl,
  );

export const tiktokChunkPlan = (
  videoSize: number,
): { chunkSize: number; totalChunkCount: number } => {
  if (videoSize <= CHUNK_SIZE) return { chunkSize: videoSize, totalChunkCount: 1 };
  // The final chunk absorbs the remainder (it may reach 128MB per the API contract).
  const totalChunkCount = Math.floor(videoSize / CHUNK_SIZE);
  return { chunkSize: CHUNK_SIZE, totalChunkCount };
};

export type InboxUploadStatus =
  | "PROCESSING_UPLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

export interface TiktokInboxUploadInput {
  accessToken: string;
  video: Uint8Array<ArrayBuffer>;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

export interface TiktokInboxUploadResult {
  publishId: string;
  status: InboxUploadStatus;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Upload-as-Draft (inbox) flow: the video lands in the creator's TikTok
 * inbox and they finish the post manually in the app. No caption can be
 * set via this API — surface the approved caption to the operator so they
 * paste it in-app. Requires only the video.upload scope (no content audit).
 */
export const uploadTiktokDraft = async ({
  accessToken,
  video,
  pollIntervalMs = 3000,
  timeoutMs = 300_000,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: TiktokInboxUploadInput): Promise<TiktokInboxUploadResult> => {
  const { chunkSize, totalChunkCount } = tiktokChunkPlan(video.byteLength);
  const initResponse = await fetchImpl(INBOX_INIT_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: video.byteLength,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const init = await tiktokJson<{ data: { publish_id: string; upload_url: string } }>(
    initResponse,
    "TikTok inbox init",
  );

  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const end = i === totalChunkCount - 1 ? video.byteLength : start + chunkSize;
    const chunk = video.slice(start, end);
    const put = await fetchImpl(init.data.upload_url, {
      method: "PUT",
      headers: {
        "content-type": "video/mp4",
        "content-length": String(chunk.byteLength),
        "content-range": `bytes ${start}-${end - 1}/${video.byteLength}`,
      },
      body: chunk,
    });
    if (!put.ok) {
      const body = await put.text();
      throw new Error(
        `TikTok chunk upload failed: ${put.status} ${put.statusText} — ${body.slice(0, 200)}`,
      );
    }
  }

  let status: InboxUploadStatus = "PROCESSING_UPLOAD";
  const attempts = timeoutMs / pollIntervalMs;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const statusResponse = await fetchImpl(STATUS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: init.data.publish_id }),
    });
    const statusJson = await tiktokJson<{
      data: { status: InboxUploadStatus; fail_reason?: string };
    }>(statusResponse, "TikTok status fetch");
    status = statusJson.data.status;
    if (status === "SEND_TO_USER_INBOX" || status === "PUBLISH_COMPLETE") {
      return { publishId: init.data.publish_id, status };
    }
    if (status === "FAILED") {
      throw new Error(
        `TikTok inbox upload failed: ${statusJson.data.fail_reason ?? "unknown reason"}`,
      );
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `TikTok upload still ${status} after ${timeoutMs}ms — check the inbox or raise timeoutMs`,
  );
};
