#!/usr/bin/env bun
/**
 * Bootstrap publishing credentials into the gitignored .secrets/ store.
 *
 *   bun run publish:auth youtube
 *     Loopback OAuth: opens a consent URL, catches the redirect on
 *     127.0.0.1, exchanges the code, stores the refresh token.
 *     Requires YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET in .env.
 *
 *   bun run publish:auth instagram --token=<long-lived-token>
 *     Paste the long-lived token generated in the Meta dashboard
 *     (Instagram API with Instagram Login > generate token for your own
 *     professional account). Resolves and stores the IG user id.
 *
 *   bun run publish:auth tiktok [--code=<code>]
 *     Paste-code OAuth (TikTok only accepts registered HTTPS redirect
 *     URIs): without --code it prints the consent URL; authorize, copy
 *     the `code` query param from the redirect URL, and re-run with
 *     --code. Requires TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET /
 *     TIKTOK_REDIRECT_URI in .env.
 *
 * See docs/publishing.md for the one-time platform setup.
 */
import crypto from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  exchangeTiktokCode,
  exchangeYoutubeCode,
  instagramMe,
  tiktokAuthUrl,
  writeStoredToken,
  youtubeAuthUrl,
} from "@cgaravitoq/publish";
import { loadWorkspaceEnv } from "./lib/r2-artifacts";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`publish-auth: must run from ${expectedCwd}`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { token: { type: "string" }, code: { type: "string" } },
});

const platform = positionals[0];
const SECRETS_DIR = path.join(expectedCwd, ".secrets");
loadWorkspaceEnv();

if (platform === "youtube") {
  const clientId = Bun.env.YOUTUBE_CLIENT_ID;
  const clientSecret = Bun.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "publish-auth: set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env (docs/publishing.md)",
    );
    process.exit(1);
  }
  const state = crypto.randomBytes(16).toString("hex");
  const { promise: codePromise, resolve, reject } = Promise.withResolvers<string>();

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.searchParams.get("state") !== state) {
        return new Response("State mismatch", { status: 400 });
      }
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (error || !authCode) {
        reject(new Error(`OAuth denied: ${error ?? "no code"}`));
        return new Response("Authorization failed — back to the terminal.", { status: 400 });
      }
      resolve(authCode);
      return new Response("Authorized. You can close this tab.", { status: 200 });
    },
  });
  const redirectUri = `http://127.0.0.1:${server.port}`;
  console.log("\nOpen this URL to authorize the YouTube upload scope:\n");
  console.log(youtubeAuthUrl({ clientId, redirectUri, state }));
  console.log(`\nWaiting for the redirect on ${redirectUri} …`);
  const code = await codePromise;
  server.stop();

  const tokens = await exchangeYoutubeCode({
    config: { clientId, clientSecret },
    code,
    redirectUri,
  });
  if (!tokens.refreshToken) {
    console.error(
      "publish-auth: Google returned no refresh token — remove the app's prior grant and retry",
    );
    process.exit(1);
  }
  const file = writeStoredToken(SECRETS_DIR, {
    platform: "youtube",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    obtainedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString(),
  });
  console.log(`✓ YouTube refresh token stored at ${path.relative(expectedCwd, file)}`);
} else if (platform === "instagram") {
  if (!values.token) {
    console.error(
      "usage: bun run publish:auth instagram --token=<long-lived-token>  (docs/publishing.md)",
    );
    process.exit(1);
  }
  const me = await instagramMe({ accessToken: values.token });
  const file = writeStoredToken(SECRETS_DIR, {
    platform: "instagram",
    accessToken: values.token,
    igUserId: me.igUserId,
    username: me.username,
    obtainedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
  });
  console.log(
    `✓ Instagram token for @${me.username} (user ${me.igUserId}) stored at ${path.relative(expectedCwd, file)}`,
  );
} else if (platform === "tiktok") {
  const clientKey = Bun.env.TIKTOK_CLIENT_KEY;
  const clientSecret = Bun.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = Bun.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) {
    console.error(
      "publish-auth: set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI in .env (docs/publishing.md)",
    );
    process.exit(1);
  }
  if (!values.code) {
    const state = crypto.randomBytes(8).toString("hex");
    console.log("\n1. Open this URL and authorize the video.upload scope:\n");
    console.log(tiktokAuthUrl({ clientKey, redirectUri, state }));
    console.log(
      `\n2. After authorizing you land on ${redirectUri}?code=...&state=... — copy the \`code\` value (URL-decode it if it contains %).\n3. Re-run: bun run publish:auth tiktok --code=<that code>`,
    );
    process.exit(0);
  }
  const tokens = await exchangeTiktokCode({
    config: { clientKey, clientSecret },
    code: values.code,
    redirectUri,
  });
  const file = writeStoredToken(SECRETS_DIR, {
    platform: "tiktok",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    openId: tokens.openId,
    obtainedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + tokens.refreshExpiresInSeconds * 1000).toISOString(),
  });
  console.log(
    `✓ TikTok tokens for open_id ${tokens.openId} stored at ${path.relative(expectedCwd, file)}`,
  );
} else {
  console.error(
    "usage: bun run publish:auth <youtube|instagram|tiktok> [--token=...] [--code=...]",
  );
  process.exit(1);
}
