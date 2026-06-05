# Publishing — direct YouTube + Instagram

Automated publishing for approved episodes. TikTok and LinkedIn stay manual in v1 (TikTok's Content Posting API audit prohibits personal-use apps; LinkedIn's self-serve tier issues no refresh token), so for those you paste the approved copy from `distribution.json`.

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

Scope is `youtube.upload` only (no CASA audit). **Uploads from unaudited API clients are locked to private** (non-appealable for post-2020 projects): publish private/unlisted and flip to public in YouTube Studio. Quota: `videos.insert` costs 1600 units of the 10k/day default — ~6 uploads/day.

### Instagram (Meta)

1. Create an app at developers.facebook.com → add the **Instagram** product → "API setup with Instagram login".
2. Connect your own professional (Business/Creator) account and use the dashboard's token generator to issue a **long-lived access token** (no App Review needed for your own account; no Facebook Page required).
3. `bun run publish:auth instagram --token=<that-token>` — resolves your IG user id and stores both in `.secrets/instagram-token.json`. The CLI auto-refreshes the 60-day token when it has <10 days left.

The video must be fetchable by URL: `publish:episode` presigns the rendered mp4 in R2 (2h TTL), which requires the direct S3 credentials (`R2_ACCESS_KEY_ID_WRITE` / `R2_SECRET_ACCESS_KEY_WRITE`) — the upload gateway alone cannot presign.

## Publishing an episode

```bash
bun run publish:episode <slug> --platform=youtube                    # prints the plan, publishes nothing
bun run publish:episode <slug> --platform=youtube --confirm          # Gate 2: actually uploads (private by default)
bun run publish:episode <slug> --platform=instagram --confirm
```

Options: `--lang=es|en` (default: scene-spec lang), `--privacy=private|unlisted|public` (YouTube; default private).

Results land in `src/episodes/<slug>/publish.remote.json` (status, id, url, sha pin per platform) and are uploaded to the episode's R2 manifests. After publishing, set `Video URL` / `Publish Date` on the episode's Shorts Archive page in Notion (operator-owned fields).
