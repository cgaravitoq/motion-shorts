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

## Scene-hub MCP tools

The local motion-shorts MCP exposes the scene-hub pipeline plus lint, audio, and render tools:

| Tool | Purpose |
|------|---------|
| `list_scene_types` | List the 17 scene-types (hook, title-cards, flow, fanout, metric, bars, big-stat, comparison, timeline, quote, code, social-card, progress-ring, line-chart, contrib-heatmap, decision-tree, outro) with their slot ranges. |
| `get_scene_type` | Fetch one scene-type's manifest (slots, ranges, sample spec). |
| `recommend_scene_types` | Given an intent (`informative`, `data`, `workflow`, `social`, `brand`, `vfx`), suggest scene-types to compose the short. |
| `validate_scene_spec` | Validate a `scene-spec.json` against the scene-type manifests (mirrors `bun run scene:check`). |
| `assemble_episode` | Deterministically generate the monolithic `index.html` from a spec (mirrors `bun run assemble`; identical spec produces identical bytes). |
| `scene_qa` | Per-scene visual QA: snapshot key frames and run `hyperframes inspect` for overflow/overlap. Optional scene-id list re-checks only changed scenes. |
| `lint_html` | Run Hyperframes lint against a composition. |
| `generate_audio` | TTS + word-level captions. |
| `render_composition` | Synchronous full render. |

Do scene preflight with `list_scene_types` / `recommend_scene_types` before writing a spec so scene-type IDs and slot ranges come from the manifests. `render_composition` and `generate_audio` return absolute local paths under `MCP_OUTPUT_DIR` instead of signed URLs or async job IDs.

## Notion database (optional)

The `produce-from-notion` skill is database-agnostic. To use it, create a Notion database matching the schema in [`.agents/skills/produce-from-notion/references/notion-db-schema.md`](../.agents/skills/produce-from-notion/references/notion-db-schema.md) and expose its identifiers via the `NOTION_SHORTS_DATABASE_ID` and `NOTION_SHORTS_DATA_SOURCE_ID` env vars.

The skill pulls entries with `Status: Hook Drafted` and pushes back `Status: Asset Ready` + render details. If you do not use Notion for content briefs, invoke the `canonical-short` skill directly and skip `produce-from-notion`.
