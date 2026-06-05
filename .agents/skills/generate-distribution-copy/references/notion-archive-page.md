# Notion Shorts Archive — page contract

Load this file when archiving an episode to Notion (produce-from-source Stage 8, or re-mirroring after copy changes). Notion is a **one-way archive/visualization surface**: pages are created and updated FROM the repo; the episode's `distribution.json` (+ R2) is the single source of truth. Never copy Notion edits back.

## Database

**🎞️ Shorts Archive** — one page per generated episode.

- Env: `NOTION_SHORTS_ARCHIVE_DATABASE_ID` (database) and `NOTION_SHORTS_ARCHIVE_DATA_SOURCE_ID` (`collection://` id used for queries).
- Upsert key: `Asset Slug` == episode slug. Search the data source for the slug first; update on exactly one match, create on zero, **abort and report on multiple**.

## Properties

| Property | Type | Value |
|---|---|---|
| Name | title | Episode title (from `meta.json` / final hook title) |
| Asset Slug | rich_text | `<slug>` — matches `apps/hyperframe/src/episodes/<slug>/` |
| Source URL | url | The captured source the short was generated from (omit for freeform ideas) |
| Status | select | `Rendered` -> `Copy Approved` (all selected platforms approved in distribution.json) -> `Published` (operator-set) |
| Platforms | multi_select | YouTube Shorts / TikTok / Instagram Reels / LinkedIn — the platforms present in `distribution.json.platforms` |
| Video URL | url | Operator-set after publishing (primary platform URL) |
| Publish Date | date | Operator-set |
| Render Hash | rich_text | First 12 chars of the rendered mp4 sha256 (`render.remote.json` objects[renders].sha256) |

`Video URL` and `Publish Date` are operator-owned; the archive push never overwrites a non-empty value.

## Page body

1. `heading_2` "Status"
2. `paragraph`: render duration + R2 key + full sha256 + runId
3. `heading_2` "Source"
4. `paragraph`: source URL + the verified facts the script uses (one line each)
5. `divider`
6. `heading_2` "📣 Publishing copies"
7. `paragraph` marker: `generated from distribution.json · render <sha256 first 12> · <date>`
8. Per platform present in `distribution.json.platforms`, in order youtube / instagram / tiktok / linkedin:
   - `heading_3` "<Platform label> — <status>" (status = `draft` / `approved` / `rejected`)
   - paragraph-label + `code` block pairs (language `javascript` — renders best in Notion's monospace), copy text verbatim (paste-ready, hashtags inline):
     - YouTube Shorts: "ES Titulo" / "ES Descripcion" / "EN Title" / "EN Description"
     - Instagram Reels, TikTok: "ES Caption" / "EN Caption"
     - LinkedIn: "ES Post" / "EN Post"

## Managed-section rules

- The blocks from the divider (5) to the end are the **managed range**: on re-archive, delete that range and re-append. Never touch blocks outside it (the operator may add free notes above).
- Regenerate the mirror after every distribution.json change that matters (new draft, approval, re-render); always after `copy:sync`.
- A re-render changes the sha256: re-archive so the marker and Render Hash match the new pin.
