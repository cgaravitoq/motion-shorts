# Privacy Policy — motion-shorts

Last updated: 2026-06-05

motion-shorts is an open-source, local-first command-line tool. It has no servers, no telemetry, and no analytics.

1. **No data collection.** The project does not collect, store, transmit, or sell any personal data. There is no backend.
2. **OAuth tokens stay on your machine.** Platform credentials (YouTube, Instagram, TikTok) obtained through each platform's official OAuth flow are stored only in a local, git-ignored directory (`apps/hyperframe/.secrets/`) on the operator's own computer, with restrictive file permissions. They are sent only to the respective platform's official API endpoints.
3. **Content you upload.** Videos and captions are transmitted directly from your machine to the platform you explicitly target (e.g. TikTok's Content Posting API), only when you run a publish command and confirm it. Nothing is routed through third-party servers.
4. **Data deletion.** Delete `apps/hyperframe/.secrets/` to remove all stored credentials, and revoke access at any time from each platform's connected-apps settings (e.g. TikTok → Settings → Security → Apps).

Questions: open an issue at https://github.com/cgaravitoq/motion-shorts/issues
