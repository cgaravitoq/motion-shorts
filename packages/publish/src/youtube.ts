import type { FetchLike } from "./fetch-like";
import { assertOkJson, postTokenForm } from "./oauth";
export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

export interface YoutubeOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface YoutubeTokens {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}

const assertOk = async (response: Response, what: string): Promise<void> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${what} failed: ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
    );
  }
};

export const youtubeAuthUrl = ({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_UPLOAD_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params}`;
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export const exchangeYoutubeCode = async ({
  config,
  code,
  redirectUri,
  fetchImpl = fetch,
}: {
  config: YoutubeOAuthConfig;
  code: string;
  redirectUri: string;
  fetchImpl?: FetchLike;
}): Promise<YoutubeTokens> => {
  const json = await postTokenForm({
    endpoint: TOKEN_ENDPOINT,
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    fetchImpl,
    parse: (response) => assertOkJson<TokenResponse>(response, "YouTube code exchange"),
  });
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
  };
};

export const refreshYoutubeAccessToken = async ({
  config,
  refreshToken,
  fetchImpl = fetch,
}: {
  config: YoutubeOAuthConfig;
  refreshToken: string;
  fetchImpl?: FetchLike;
}): Promise<YoutubeTokens> => {
  const json = await postTokenForm({
    endpoint: TOKEN_ENDPOINT,
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    fetchImpl,
    parse: (response) => assertOkJson<TokenResponse>(response, "YouTube token refresh"),
  });
  return { accessToken: json.access_token, refreshToken, expiresInSeconds: json.expires_in };
};

export interface YoutubeUploadInput {
  accessToken: string;
  video: Uint8Array<ArrayBuffer>;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: "private" | "unlisted" | "public";
  publishAt?: string;
  fetchImpl?: FetchLike;
}

export interface YoutubeUploadResult {
  videoId: string;
  url: string;
  privacyStatus: string;
}

export const uploadYoutubeVideo = async ({
  accessToken,
  video,
  title,
  description,
  tags,
  categoryId = "28",
  privacyStatus = "private",
  publishAt,
  fetchImpl = fetch,
}: YoutubeUploadInput): Promise<YoutubeUploadResult> => {
  const init = await fetchImpl(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4",
      "x-upload-content-length": String(video.byteLength),
    },
    body: JSON.stringify({
      snippet: { title, description, ...(tags?.length ? { tags } : {}), categoryId },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
        ...(publishAt ? { publishAt } : {}),
      },
    }),
  });
  await assertOk(init, "YouTube resumable session init");
  const location = init.headers.get("location");
  if (!location) throw new Error("YouTube resumable session init returned no Location header");

  const upload = await fetchImpl(location, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "video/mp4",
      "content-length": String(video.byteLength),
    },
    body: video,
  });
  await assertOk(upload, "YouTube video upload");
  const json = (await upload.json()) as { id: string; status?: { privacyStatus?: string } };
  return {
    videoId: json.id,
    url: `https://www.youtube.com/shorts/${json.id}`,
    privacyStatus: json.status?.privacyStatus ?? privacyStatus,
  };
};
