import type { FetchLike } from "./fetch-like";

const GRAPH_BASE = "https://graph.instagram.com";
const GRAPH = `${GRAPH_BASE}/v23.0`;

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

const graphJson = async <T>(response: Response, what: string): Promise<T> => {
  // Meta's edge returns HTML/empty bodies on 429/5xx — never assume JSON on failure.
  const text = await response.text();
  let json: (T & GraphError) | null = null;
  try {
    json = JSON.parse(text) as T & GraphError;
  } catch {
    json = null;
  }
  if (!response.ok || !json || json.error) {
    const detail = json?.error
      ? `${json.error.message} (code ${json.error.code}${json.error.error_subcode ? `/${json.error.error_subcode}` : ""})`
      : `${response.status} ${response.statusText} — ${text.slice(0, 200)}`;
    throw new Error(`${what} failed: ${detail}`);
  }
  return json;
};

export const instagramMe = async ({
  accessToken,
  fetchImpl = fetch,
}: {
  accessToken: string;
  fetchImpl?: FetchLike;
}): Promise<{ igUserId: string; username: string }> => {
  const params = new URLSearchParams({ fields: "user_id,username", access_token: accessToken });
  const response = await fetchImpl(`${GRAPH}/me?${params}`);
  const json = await graphJson<{ user_id: number | string; username: string }>(
    response,
    "Instagram /me",
  );
  return { igUserId: String(json.user_id), username: json.username };
};

export const refreshInstagramToken = async ({
  accessToken,
  fetchImpl = fetch,
}: {
  accessToken: string;
  fetchImpl?: FetchLike;
}): Promise<{ accessToken: string; expiresInSeconds: number }> => {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
  const response = await fetchImpl(`${GRAPH_BASE}/refresh_access_token?${params}`);
  const json = await graphJson<{ access_token: string; expires_in: number }>(
    response,
    "Instagram token refresh",
  );
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in };
};

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

export interface InstagramReelInput {
  accessToken: string;
  igUserId: string;
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

export interface InstagramReelResult {
  mediaId: string;
  permalink: string | null;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const publishInstagramReel = async ({
  accessToken,
  igUserId,
  videoUrl,
  caption,
  shareToFeed = true,
  pollIntervalMs = 5000,
  timeoutMs = 600_000,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: InstagramReelInput): Promise<InstagramReelResult> => {
  const containerResponse = await fetchImpl(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: String(shareToFeed),
      access_token: accessToken,
    }),
  });
  const container = await graphJson<{ id: string }>(
    containerResponse,
    "Instagram container create",
  );

  const deadline = timeoutMs / pollIntervalMs;
  let status: ContainerStatus = "IN_PROGRESS";
  for (let attempt = 0; attempt < deadline; attempt++) {
    const statusParams = new URLSearchParams({ fields: "status_code", access_token: accessToken });
    const statusResponse = await fetchImpl(`${GRAPH}/${container.id}?${statusParams}`);
    const statusJson = await graphJson<{ status_code: ContainerStatus }>(
      statusResponse,
      "Instagram container status",
    );
    status = statusJson.status_code;
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram container processing ended in ${status}`);
    }
    await sleep(pollIntervalMs);
  }
  if (status !== "FINISHED") {
    throw new Error(
      `Instagram container still ${status} after ${timeoutMs}ms — raise timeoutMs or check the video`,
    );
  }

  const publishResponse = await fetchImpl(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: container.id, access_token: accessToken }),
  });
  const published = await graphJson<{ id: string }>(publishResponse, "Instagram media publish");

  let permalink: string | null = null;
  try {
    const permalinkParams = new URLSearchParams({ fields: "permalink", access_token: accessToken });
    const permalinkResponse = await fetchImpl(`${GRAPH}/${published.id}?${permalinkParams}`);
    permalink =
      (await graphJson<{ permalink?: string }>(permalinkResponse, "Instagram permalink"))
        .permalink ?? null;
  } catch {
    permalink = null;
  }

  return { mediaId: published.id, permalink };
};
