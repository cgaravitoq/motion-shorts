/**
 * Per-platform publish handlers + the Gate-2 orchestrator.
 *
 * Each handler (`publishToYoutube` / `publishToInstagram` / `publishToTiktok`)
 * owns only the platform's upload call and returns a uniform
 * `{ id, url? }` (plus an optional `ledgerStatus` for TikTok's inbox flow).
 * The cross-cutting concerns — token refresh + rotation persistence, the
 * mp4-pin verification, the publish-ledger write, and error redaction — live
 * once in `runPublish`. The CLI (`publish-episode.ts`) keeps the explicit
 * Gate-2 human-confirm; this module never decides to publish, it only makes
 * the platform handlers cleanly callable behind a shared orchestrator.
 */
import {
  type PublishRecord,
  type StoredToken,
  presignGetUrl,
  publishInstagramReel,
  refreshInstagramToken,
  refreshTiktokToken,
  refreshYoutubeAccessToken,
  uploadTiktokDraft,
  uploadYoutubeVideo,
  writeStoredToken,
} from "@cgaravitoq/publish";
import type { EpisodeRenderRef } from "./episode-context";
import { assertR2Config, type R2ArtifactsConfig } from "./r2-artifacts";

export interface PublishCopy {
  title: string;
  description: string;
  caption: string;
}

export interface PublishResult {
  id: string;
  url?: string;
  privacy?: string;
  ledgerStatus?: "inbox";
}

interface HandlerContext {
  token: StoredToken;
  copy: PublishCopy;
  renderRef: EpisodeRenderRef;
  secretsDir: string;
  /** Reads + sha256-verifies the local mp4 against the pinned render, returns its path. */
  verifiedLocalMp4: () => Promise<string>;
  env: Record<string, string | undefined>;
  /** Side-channel for the orchestrator/CLI to surface refresh notices, identical to the prior inline console.log. */
  log: (message: string) => void;
}

const loadVideo = async (path: string): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await Bun.file(path).arrayBuffer());

export const publishToYoutube = async (
  ctx: HandlerContext & { privacy: "private" | "unlisted" | "public" },
): Promise<PublishResult> => {
  const { token, copy, env, privacy } = ctx;
  const clientId = env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("set YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET in .env");
  if (!token.refreshToken)
    throw new Error("stored YouTube token has no refresh token — re-run publish:auth youtube");

  const localMp4 = await ctx.verifiedLocalMp4();
  const refreshed = await refreshYoutubeAccessToken({
    config: { clientId, clientSecret },
    refreshToken: token.refreshToken,
  });
  const video = await loadVideo(localMp4);
  const result = await uploadYoutubeVideo({
    accessToken: refreshed.accessToken,
    video,
    title: copy.title,
    description: copy.description,
    privacyStatus: privacy,
  });
  return { id: result.videoId, url: result.url, privacy: result.privacyStatus };
};

export const publishToTiktok = async (ctx: HandlerContext): Promise<PublishResult> => {
  const { token, env, secretsDir } = ctx;
  const clientKey = env.TIKTOK_CLIENT_KEY;
  const clientSecret = env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error("set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET in .env");
  if (!token.refreshToken)
    throw new Error("stored TikTok token has no refresh token — re-run publish:auth tiktok");

  const localMp4 = await ctx.verifiedLocalMp4();
  // Access tokens last 24h; refresh every run and persist the rotated pair.
  const refreshed = await refreshTiktokToken({
    config: { clientKey, clientSecret },
    refreshToken: token.refreshToken,
  });
  writeStoredToken(secretsDir, {
    ...token,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    obtainedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + refreshed.refreshExpiresInSeconds * 1000).toISOString(),
  });
  const video = await loadVideo(localMp4);
  const result = await uploadTiktokDraft({ accessToken: refreshed.accessToken, video });
  return { id: result.publishId, ledgerStatus: "inbox" };
};

export const publishToInstagram = async (ctx: HandlerContext): Promise<PublishResult> => {
  const { token, copy, renderRef, env, secretsDir, log } = ctx;
  // instagram: feed the container a presigned R2 GET URL (signed-headers-free)
  const config = assertR2Config(env);
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error(
      "Instagram publishing needs direct S3 R2 credentials (R2_ACCESS_KEY_ID_WRITE / R2_SECRET_ACCESS_KEY_WRITE) to presign the video URL",
    );
  }
  let accessToken = token.accessToken;
  const remainingDays = token.expiresAt
    ? (new Date(token.expiresAt).getTime() - Date.now()) / 86_400_000
    : 0;
  const ageHours = (Date.now() - new Date(token.obtainedAt).getTime()) / 3_600_000;
  if (remainingDays < 10 && ageHours > 24) {
    const refreshed = await refreshInstagramToken({ accessToken });
    accessToken = refreshed.accessToken;
    writeStoredToken(secretsDir, {
      ...token,
      accessToken,
      obtainedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + refreshed.expiresInSeconds * 1000).toISOString(),
    });
    log("  (refreshed the long-lived Instagram token)");
  }
  const videoUrl = presignGetUrl({
    config: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
      endpointPrefix: config.endpointPrefix,
    },
    key: renderRef.key,
    expiresSeconds: 7200,
  });
  const result = await publishInstagramReel({
    accessToken,
    igUserId: token.igUserId ?? "",
    videoUrl,
    caption: copy.caption,
  });
  return { id: result.mediaId, url: result.permalink ?? undefined };
};

// Graph errors can echo the presigned video_url (credential + signature in
// the query string) — redact every query string before persisting/printing.
export const redactPublishError = (err: unknown): string =>
  String((err as { message?: unknown })?.message ?? err)
    .replace(/\?[^\s"')]+/g, "?<redacted-query>")
    .slice(0, 500);

export type PublishPlatform = "youtube" | "instagram" | "tiktok";

/**
 * Gate-2 orchestrator. Dispatches to the platform handler, then centralises
 * the ledger write (success or redacted failure). The CLI must have already
 * passed Gate 2 (explicit --confirm) before calling this — this function does
 * not gate; it executes a confirmed publish and records the outcome.
 */
export const runPublish = async ({
  platform,
  handlerCtx,
  privacy,
  lang,
  writeLedger,
}: {
  platform: PublishPlatform;
  handlerCtx: HandlerContext;
  privacy: "private" | "unlisted" | "public";
  lang: string;
  writeLedger: (record: PublishRecord) => unknown;
}): Promise<PublishResult> => {
  let outcome: PublishResult;
  try {
    if (platform === "youtube") {
      outcome = await publishToYoutube({ ...handlerCtx, privacy });
    } else if (platform === "tiktok") {
      outcome = await publishToTiktok(handlerCtx);
    } else {
      outcome = await publishToInstagram(handlerCtx);
    }
  } catch (err) {
    const redacted = redactPublishError(err);
    writeLedger({
      status: "failed",
      error: redacted,
      renderSha256: handlerCtx.renderRef.sha256,
      lang,
    });
    throw new Error(redacted);
  }

  // The video is live from here on: the local ledger records it immediately and
  // is never reverted — only the R2 sync (CLI side) may be pending.
  const { ledgerStatus, ...result } = outcome;
  writeLedger({
    status: ledgerStatus ?? "published",
    ...result,
    publishedAt: new Date().toISOString(),
    renderSha256: handlerCtx.renderRef.sha256,
    lang,
  });
  return outcome;
};

export type { R2ArtifactsConfig };
