# MCP integrations

The repo ships project-level MCP configs for Notion in three formats so agent surfaces (Claude Code, Codex, opencode) can write the downstream Shorts Archive (one-way mirror from distribution.json) without manual setup per CLI:

| File | CLI | Config |
|------|-----|--------|
| `.mcp.json` | Claude Code | `type: "http"` -> `https://mcp.notion.com/mcp` |
| `.codex/config.toml` | Codex CLI | `url = "https://mcp.notion.com/mcp"` |
| `.opencode/opencode.json` | opencode | `type: "remote"` -> same URL |

All three target Notion's hosted MCP server with OAuth. The first time each CLI connects, you'll be prompted to authenticate in the browser; the token is cached client-side. No `NOTION_TOKEN` env var needed.

> The local stdio package `@notionhq/notion-mcp-server` is being sunset by Notion in favour of the hosted server. We picked HTTP/OAuth as the public-repo default to avoid bitrot and keep `.env.example` clean.

The repo also ships `apps/mcp`, a local stdio MCP server for motion-shorts itself. Those tools run in-process against local packages and the Hyperframes producer; there is no remote API behind them.

## Scene-hub MCP tools

The local motion-shorts MCP exposes the scene-hub pipeline plus lint, audio, and render tools:

| Tool | Purpose |
|------|---------|
| `list_scene_types` | List the 24 scene-types (read dynamically from `templates/scenes/`, including the desktop-first types) with their slot ranges. See `bun run scene:gallery` for the full preview. |
| `get_scene_type` | Fetch one scene-type's manifest (slots, ranges, sample spec). |
| `recommend_scene_types` | Given an intent (`informative`, `data`, `workflow`, `social`, `brand`, `vfx`), suggest scene-types to compose the short. |
| `validate_scene_spec` | Validate a `scene-spec.json` against the scene-type manifests (mirrors `bun run scene:check`). |
| `assemble_episode` | Deterministically generate the monolithic `index.html` from a spec (mirrors `bun run assemble`; identical spec produces identical bytes). |
| `scene_qa` | Per-scene visual QA: snapshot key frames and run `hyperframes inspect` for overflow/overlap. Optional scene-id list re-checks only changed scenes. |
| `lint_html` | Run Hyperframes lint against a composition. |
| `generate_audio` | TTS + word-level captions. |
| `render_composition` | Synchronous full render. |

Do scene preflight with `list_scene_types` / `recommend_scene_types` before writing a spec so scene-type IDs and slot ranges come from the manifests. `render_composition` and `generate_audio` return absolute local paths under `MCP_OUTPUT_DIR` instead of signed URLs or async job IDs.

## Notion Shorts Archive (optional)

Notion is a **downstream archive only**: the repo is the single entry point for producing shorts (`produce-from-source`), and each finished episode is archived as a page in a Shorts Archive database — properties (Status, Asset Slug, Source URL, Platforms, Render Hash) plus a managed "Publishing copies" section mirrored one-way from the episode's `distribution.json`.

Create a database matching the contract in [`.agents/skills/generate-distribution-copy/references/notion-archive-page.md`](../.agents/skills/generate-distribution-copy/references/notion-archive-page.md) and expose its identifiers via the `NOTION_SHORTS_ARCHIVE_DATABASE_ID` and `NOTION_SHORTS_ARCHIVE_DATA_SOURCE_ID` env vars. Without Notion, the pipeline works the same — `distribution.json` + R2 remain the source of truth and the archive step is skipped.
