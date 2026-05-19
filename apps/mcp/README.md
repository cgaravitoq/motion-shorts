# @cgaravitoq/mcp

## What this is

Local stdio MCP server for motion-shorts. It exposes lint, audio, render,
catalog, and template resources to AI agents (Claude Desktop / Cursor / Codex)
without a backing HTTP API.

## Tools

- `lint_html` — validates Hyperframes HTML with `@hyperframes/core`.
- `render_composition` — renders HTML plus optional assets locally and returns `{ jobId, outputPath, outputBytes, outputDurationSec }`.
- `generate_audio` — writes `voice.mp3` and `captions.json` locally and returns their absolute paths.
- `list_visual_components` — lists compact catalog entries with optional filters.
- `get_visual_component` — returns one full catalog entry with snippet HTML inlined.
- `recommend_visual_components` — routes an intent to a short skill and recommended catalog entries.
- `validate_episode_catalog_contract` — validates an `index.html` string against the catalog contract.

Resources:

- `file:///canonical-short/SKILL.md`
- `file:///compositions/canonical-short.html`
- `file:///compositions/landscape-motion.html`
- `file:///compositions/square-social.html`

## Runtime

All work happens in-process:

- lint calls `@hyperframes/core`.
- audio calls `@cgaravitoq/audio` and writes `voice.mp3` plus `captions.json`.
- render materialises a temporary project, runs the catalog check, calls `@hyperframes/producer`, writes the output video, and removes the temporary project.

Outputs go to `MCP_OUTPUT_DIR`, defaulting to `~/.motion-shorts/out`.
Audio jobs create `<jobId>/voice.mp3` and `<jobId>/captions.json`; render jobs
create `<jobId>.<format>`.

## Env vars

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `MCP_OUTPUT_DIR` | No | `~/.motion-shorts/out` | Absolute or `~`-relative output directory. |
| `ELEVENLABS_API_KEY` | For ElevenLabs audio | — | Used by `@cgaravitoq/audio`. |
| `ELEVENLABS_VOICE_ID_ES` / `ELEVENLABS_VOICE_ID_EN` | For ElevenLabs audio | — | Default voices unless a tool call passes `voice`. |
| `TTS_PROVIDER` | No | `elevenlabs` | `elevenlabs` or `inworld`. |
| `STT_PROVIDER` | No | `elevenlabs` | `elevenlabs` or `hyperframes-transcribe`. |

## Claude Desktop setup

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS:

```json
{
  "mcpServers": {
    "motion-shorts": {
      "command": "bun",
      "args": ["run", "apps/mcp/src/index.ts"],
      "cwd": "/path/to/motion-shorts",
      "env": {
        "MCP_OUTPUT_DIR": "~/.motion-shorts/out"
      }
    }
  }
}
```

`command: "bun"` is enough when Bun is on the spawned process's PATH.
Otherwise, set `command` to the absolute path (for example `~/.bun/bin/bun`
on Unix or `C:\\Users\\<you>\\.bun\\bin\\bun.exe` on Windows).

Do not invoke the MCP through `bun run --filter @cgaravitoq/mcp start`. The
filter wrapper does not propagate the child process's stdout, so JSON-RPC
responses never reach the client. Invoke `apps/mcp/src/index.ts` directly.

## Manual smoke

```bash
bun run mcp:start
```

The server boots and waits on stdin.

```bash
bun run mcp:inspector
```

Verify the tools and resources appear, then call:

1. `lint_html` with broken HTML and expect structured findings.
2. `validate_episode_catalog_contract` with a known-good episode.
3. `render_composition` with a tiny compliant composition and expect a local `outputPath`.

For audio, set the required provider env vars first, then call
`generate_audio` with a short string and verify `voice.mp3` and
`captions.json` exist under `MCP_OUTPUT_DIR`.
