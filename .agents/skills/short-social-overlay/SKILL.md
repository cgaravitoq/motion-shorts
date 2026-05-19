---
name: short-social-overlay
description: >
  Use for vertical shorts built around social posts, creator overlays, follow CTAs, media cards, or
  platform-native UI beats with the mandatory catalog preflight.
---

# Social overlay short

## Scope

Use for posts, comments, creator overlays, follow CTAs, media cards, and platform-native UI beats.

## Catalog preflight

Follow `.agents/skills/references/catalog-preflight.md` before production.

- Required: `brand-logo-outro`, `brand-logo-watermark`
- First-class: `instagram-follow`, `tiktok-follow`, `yt-lower-third`
- Copy-paste: `reddit-post`, `spotify-card`, `x-post`
- Deprecated: none

Call `route({ intent: "social" })` and keep the chosen IDs as the first non-doctype line in `index.html`.

## Handoff

Continue to `canonical-short`; if the source is a Notion brief, continue to `produce-from-notion`.
