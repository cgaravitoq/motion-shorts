# @cgaravitoq/mcp

## What this is

Local stdio MCP server for motion-shorts. It exposes the scene-hub authoring
surface plus lint/audio/render tools to AI agents (Claude Desktop / Cursor /
Codex) without a backing HTTP API.

## Tools

Scene-hub (parametric authoring — the building blocks for a short):

- `list_scene_types` — lists the scene-types with their slot summaries; optional `intent` filter.
- `get_scene_type` — returns one scene-type's full manifest (typed slot schema), DOM fragment, and a sample params object.
- `recommend_scene_types` — maps an `intent` to a recommended scene skeleton + scene-types.
- `validate_scene_spec` — validates a `scene-spec` object against the scene-type manifests (no assembly): `{ ok, errors[], warnings[] }`.
- `assemble_episode` — assembles a `scene-spec` into one monolithic `index.html` (deterministic, 1:1) and returns `{ html, scenes[], totalDuration }`.
- `scene_qa` — per-scene visual QA for an episode with a `scene-spec.json` on disk: snapshot key frames per scene + `inspect` overflow/overlap, no full render. `scenes` filters to specific scene ids.

Shared media tools:

- `lint_html` — validates Hyperframes HTML with `@hyperframes/core`.
- `render_composition` — renders HTML plus optional assets locally and returns `{ jobId, outputPath, outputBytes, outputDurationSec }`.
- `generate_audio` — writes `voice.mp3` and `captions.json` locally and returns their absolute paths.

Resources:

- `file:///canonical-short/SKILL.md`
- `file:///compositions/canonical-short.html`
- `file:///compositions/landscape-motion.html`
- `file:///compositions/square-social.html`

## Runtime

All work happens in-process:

- lint calls `@hyperframes/core`.
- audio calls `@cgaravitoq/audio` and writes `voice.mp3` plus `captions.json`.
- scene-hub tools call the engine in `apps/hyperframe/scripts/lib` (instantiator / assembler / spec validator / router); `scene_qa` shells out to `apps/hyperframe/scripts/scene-qa.mjs`.
- render materialises a temporary project, calls `@hyperframes/producer`, writes the output video, and removes the temporary project.

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

1. `list_scene_types` and expect the 11 scene-types with slot summaries.
2. `validate_scene_spec` with a small spec and expect `{ ok: true }`; `assemble_episode` with the same spec and expect `html`.
3. `render_composition` with a tiny composition and expect a local `outputPath`.

For audio, set the required provider env vars first, then call
`generate_audio` with a short string and verify `voice.mp3` and
`captions.json` exist under `MCP_OUTPUT_DIR`.
