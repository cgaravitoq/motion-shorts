# MCP integrations

The repo ships project-level MCP configs for Notion in three formats so agent surfaces (Claude Code, Codex, opencode) can read/write the content brief database without manual setup per CLI:

| File | CLI | Config |
|------|-----|--------|
| `.mcp.json` | Claude Code | `type: "http"` -> `https://mcp.notion.com/mcp` |
| `.codex/config.toml` | Codex CLI | `url = "https://mcp.notion.com/mcp"` |
| `.opencode/opencode.json` | opencode | `type: "remote"` -> same URL |

All three target Notion's hosted MCP server with OAuth. The first time each CLI connects, you'll be prompted to authenticate in the browser; the token is cached client-side. No `NOTION_TOKEN` env var needed.

> The local stdio package `@notionhq/notion-mcp-server` is being sunset by Notion in favour of the hosted server. We picked HTTP/OAuth as the public-repo default to avoid bitrot and keep `.env.example` clean.

The repo also ships `apps/mcp`, a local stdio MCP server for motion-shorts itself. Those tools run in-process against local packages and the Hyperframes producer; there is no remote API behind them.

## Catalog MCP tools

Remote agents should perform catalog preflight with `list_visual_components`, which mirrors `packages/catalog/manifest.json` and the local `bun run catalog:list` command. Use it before authoring an episode so component IDs, statuses, source demos, and snippet paths come from the catalog contract.

The local motion-shorts MCP exposes catalog discovery, catalog validation, Hyperframes lint, audio generation, and synchronous render tools. `render_composition` and `generate_audio` return absolute local paths under `MCP_OUTPUT_DIR` instead of signed URLs or async job IDs.

## Notion database (optional)

The `produce-from-notion` skill is database-agnostic. To use it, create a Notion database matching the schema in [`.agents/skills/produce-from-notion/references/notion-db-schema.md`](../.agents/skills/produce-from-notion/references/notion-db-schema.md) and expose its identifiers via the `NOTION_SHORTS_DATABASE_ID` and `NOTION_SHORTS_DATA_SOURCE_ID` env vars.

The skill pulls entries with `Status: Hook Drafted` and pushes back `Status: Asset Ready` + render details. If you do not use Notion for content briefs, invoke the `canonical-short` skill directly and skip `produce-from-notion`.
