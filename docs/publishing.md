# Publishing — direct YouTube + Instagram, semi-auto TikTok

Automated publishing for approved episodes. TikTok uses the **Upload-as-Draft inbox flow** (semi-auto: the video lands in your TikTok inbox; you paste the caption and publish in the app — TikTok's Direct Post audit prohibits personal-use apps, but the draft flow only needs the `video.upload` scope). LinkedIn stays manual (its self-serve `w_member_social` tier issues no refresh token — gated to approved MDP partners — so OAuth re-consent every 60 days; native video accepts 9:16, 1:1, and 16:9 within a 1:2.4–2.4:1 range, so both the portrait and desktop 16:9 renders upload cleanly).

```
distribution.json (approved, sha-pinned) ──publish:episode──▶ platform API
                                                 │
                                                 └─▶ publish.remote.json (local + R2 manifests)
```

Gates: publishing requires the platform copy `approved` in `distribution.json` (Gate 1), its `renderRef.sha256` matching the current `render.remote.json`, and an explicit `--confirm` (Gate 2). A re-render invalidates everything until the copy is re-reviewed.

## One-time setup

### YouTube (Google Cloud)

1. Create a project at console.cloud.google.com and enable **YouTube Data API v3**.
2. OAuth consent screen: External. **Publish to Production** — apps left in Testing expire refresh tokens after 7 days.
3. Credentials → OAuth client ID → **Desktop app**. Put the id/secret in `.env` (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`).
4. `bun run publish:auth youtube` — opens the consent URL, catches the loopback redirect, stores the refresh token in `apps/hyperframe/.secrets/youtube-token.json` (gitignored).

Scope is `youtube.upload` only (no CASA audit). **Uploads from unaudited API clients are locked to private** (non-appealable for post-2020 projects): publish private/unlisted and flip to public in YouTube Studio. Quota is a non-issue at shorts volume — `videos.insert` now draws from a dedicated upload bucket rather than the legacy 10k/day pool; check the current limits in your project's Google Cloud quota console rather than assuming a fixed cost.

### Instagram (Meta)

1. Create an app at developers.facebook.com → add the **Instagram** product → "API setup with Instagram login".
2. Connect your own professional (Business/Creator) account and use the dashboard's token generator to issue a **long-lived access token** (no App Review needed for your own account; no Facebook Page required).
3. `bun run publish:auth instagram --token=<that-token>` — resolves your IG user id and stores both in `.secrets/instagram-token.json`. The CLI auto-refreshes the 60-day token when it has <10 days left.

The video must be fetchable by URL: `publish:episode` presigns the rendered mp4 in R2 (2h TTL), which requires the direct S3 credentials (`R2_ACCESS_KEY_ID_WRITE` / `R2_SECRET_ACCESS_KEY_WRITE`) — the upload gateway alone cannot presign.

### TikTok (developers.tiktok.com)

1. Register at developers.tiktok.com → **Manage apps** → create an app.
2. Add the **Login Kit** and **Content Posting API** products and request the **`video.upload`** scope only (draft-to-inbox; no audit needed — Direct Post's `video.publish` audit rejects personal upload tools).
3. Register an **HTTPS redirect URI** (any page you control works; you only copy the `code` param from it). Put key/secret/URI in `.env` (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`).
4. `bun run publish:auth tiktok` → open the printed URL, authorize, copy the `code` from the redirect → `bun run publish:auth tiktok --code=<code>`. Refresh tokens last ~1 year and rotate on use.

Publishing sends the mp4 (chunked `FILE_UPLOAD`, ≤128MB) to your TikTok **inbox**: open the app notification, edit the draft, paste the caption the CLI prints (the inbox API takes no caption), and publish. Rate limit: 6 init requests/min (TikTok's public rate-limit page only documents the Display API, not Content Posting). `FILE_UPLOAD` is used rather than `PULL_FROM_URL` because TikTok rejects an opaque presigned R2 URL with `url_ownership_unverified` (PULL requires a verified custom-domain prefix). The draft/inbox flow also sidesteps Direct Post's `SELF_ONLY` lock — it never "posts" with a viewership setting, so the audit's public-visibility restriction doesn't apply.

## Publishing an episode

```bash
bun run publish:episode <slug> --platform=youtube                    # prints the plan, publishes nothing
bun run publish:episode <slug> --platform=youtube --confirm          # Gate 2: actually uploads (private by default)
bun run publish:episode <slug> --platform=instagram --confirm
bun run publish:episode <slug> --platform=tiktok --confirm           # draft to your TikTok inbox + caption to paste
```

Options: `--lang=es|en` (default: scene-spec lang), `--privacy=private|unlisted|public` (YouTube; default private).

Results land in `src/episodes/<slug>/publish.remote.json` (status, id, url, sha pin per platform) and are uploaded to the episode's R2 manifests. After publishing, set `Video URL` / `Publish Date` on the episode's Shorts Archive page in Notion (operator-owned fields).
