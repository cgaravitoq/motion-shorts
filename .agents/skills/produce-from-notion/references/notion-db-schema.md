# Notion database schema reference

Load this file at **Stage 1 — Pull from Notion** or **Stage 6 — Push to Notion** when reading or writing properties.

## Database identifiers

This skill is database-agnostic. Create a Notion database matching the schema below, then expose its identifiers via environment variables:

- `NOTION_SHORTS_DATABASE_ID` — the database UUID
- `NOTION_SHORTS_DATA_SOURCE_ID` — the data source UUID (read from the Notion API or the database URL)

The skill will query `${NOTION_SHORTS_DATA_SOURCE_ID}` for entries with `Status = "Hook Drafted"`.

## Properties

| Property | Type | Used for |
| --- | --- | --- |
| `Title` | title | Page title (checkmark prefix when Status=Asset Ready) |
| `Asset Slug` | rich_text | Maps to `apps/hyperframe/src/episodes/<slug>/` |
| `Status` | select | `Idea` -> `Hook Drafted` -> `Script` -> `Asset Ready` -> `Recorded` -> `Editing` -> `Published` |
| `Priority` | select | `P0 - Next` / `P1 - Soon` / `P2 - Backlog` / `P3 - Maybe` |
| `Visual Source` | select | `Hyperframes` (this skill only handles Hyperframes) / Manim / Screen Capture / Mix |
| `Format` | select | `Pure Animation` (default for this pipeline) / Talking Head / Screen Capture + Captions / Mix |
| `Hook Text` | rich_text | Seed hook from Notion, MUST honor |
| `Hook Type` | select | Bold Claim / Curiosity Gap / Question / Before/After / Pattern Interrupt / Demo Reveal |
| `Duration` | select | `15-30s` / `30-45s` / `45-60s` |
| `Series` | select | AI Engineering / Agent Engineering / Vibe Coding / AI Engineering Harness / General |
| `Topic` | multi_select | agents / mcp / claude-code / codex / hooks / skills / memory / evals / cli / workflow / prompting / hyperframes |
| `Platforms` | multi_select | YouTube Shorts / TikTok / Instagram Reels / LinkedIn (default all 4) |
| `Payoff` | rich_text | The take-away in one sentence |
| `Publish Date` | date | Set by the operator, NOT this skill |
| `Video URL` | url | Set by the operator after publishing |
