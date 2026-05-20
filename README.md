# motion-shorts

[![YouTube Channel](https://img.shields.io/badge/YouTube-@cgaravitoq--ai-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/@cgaravitoq-ai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Turborepo monorepo for producing vertical 9:16 motion-graphics shorts
(YouTube Shorts, LinkedIn, TikTok, Instagram Reels) entirely from text
scripts — [Hyperframes](https://hyperframes.heygen.com/) +
[GSAP](https://gsap.com/) +
[ElevenLabs](https://elevenlabs.io/) (TTS + Scribe STT).

```
script.txt → voice.mp3 + word-level captions.json
                            ↓
   HTML + GSAP timeline (monolithic, paused) + assets/voice.mp3
                            ↓
        bunx hyperframes render → mp4 / mov / webm
```

No React, no JSX, no build step. Render is local, single-machine,
headless Chrome + ffmpeg, frame-accurate. See
`apps/hyperframe/src/episodes/` for reference implementations
(`demo-explainer-blocks`, `demo-explainer-with-logo`,
`demo-social-overlays`, `source-driven-catalog-demo`,
`source-driven-editorial-demo`, `catalog-components-lab`) of the
canonical pattern documented in
[`.agents/skills/canonical-short/SKILL.md`](./.agents/skills/canonical-short/SKILL.md).

## Examples in the wild

Two shorts produced with this pipeline and published on
[**@cgaravitoq-ai**](https://www.youtube.com/@cgaravitoq-ai):

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/shorts/HW0vRlc_nCo">
        <img src=".github/assets/codex-mobile-remote-control.gif" width="280" alt="Codex mobile remote control" />
      </a>
      <br/>
      <sub><b>Codex desde el móvil</b> · 54s · <a href="https://www.youtube.com/shorts/HW0vRlc_nCo">YouTube</a></sub>
    </td>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/shorts/aey_LhOTRK8">
        <img src=".github/assets/claude-code-routines.gif" width="280" alt="Claude Code routines" />
      </a>
      <br/>
      <sub><b>Claude Code routines</b> · 59s · <a href="https://www.youtube.com/shorts/aey_LhOTRK8">YouTube</a></sub>
    </td>
  </tr>
</table>

More episodes (Claude Code hooks, Codex vs Claude Code, prompt caching,
agentic context engineering, AI engineering harness, …) on the
[YouTube channel](https://www.youtube.com/@cgaravitoq-ai).

## Setup

Requires [Bun](https://bun.sh/) ≥ 1.3, Node ≥ 22, and `ffmpeg` on the
path. ElevenLabs API key needed for TTS + Scribe captions.

```bash
git clone https://github.com/cgaravitoq/motion-shorts.git
cd motion-shorts
bun install                                            # always from repo root
cp .env.example .env                                   # set ELEVENLABS_API_KEY
                                                       # (Notion MCP uses OAuth)
```

This repo is local-first. Renders run through the Hyperframes CLI or the local
stdio MCP server; there is no maintained production API or worker stack.

## Render an existing demo episode

The demos render out of the box, **with or without** an ElevenLabs API key:

```bash
cd apps/hyperframe
bun run render:episode demo-explainer-blocks --format=mp4
```

- **With `voice.mp3`** under `assets/`: `render-episode.mjs` ffprobes it, stamps
  `data-duration` on the stage and the `<audio id="voiceover">` tag, inlines
  `assets/captions.json` for word-level karaoke, and renders with audio.
- **Without `voice.mp3`** (e.g. on a fresh clone with no ElevenLabs key):
  the script warns, **strips the `<audio>` tag**, and uses the stage's
  existing `data-duration` as the silent timeline. You still get a
  fully-animated motion-graphics mp4 — just no narration. Add voice later
  by generating `voice.mp3` and re-running the render.

The working copy lives under `apps/hyperframe/out/episodes/<slug>/`;
`apps/hyperframe/src/episodes/<slug>/` is never mutated. The episode's
`meta.json` carries a `tail` field (default `3`) that pads past
end-of-audio so the brand-card lockup holds long enough to read. Override
per-render with `--tail=<seconds>`. Silent renders ignore `tail` (the
stage `data-duration` is authoritative).

To add narration to a demo: write a short script (`examples/<slug>.txt`),
then run `bun run audio examples/<slug>.txt --lang=es --out=public/voice/<slug>`
and copy `voice.mp3` (and optional `captions.json`) into the episode's
`assets/` dir. See [Author a new episode](#author-a-new-episode) for the
full flow.

With R2 configured, verified render and asset artifacts are uploaded to R2 and
local render outputs are deleted by default. Use `--keep-local` when you need a
local mp4 to inspect; otherwise use the R2 URL emitted after upload. After a
successful upload the script prints `local <path> deleted after verified R2
upload` so you don't have to guess where the mp4 went.

### Working-copy semantics (read once before cleaning anything)

`render-episode.mjs` builds a self-contained working copy under
`apps/hyperframe/out/episodes/<slug>/` so the canonical episode under
`src/episodes/<slug>/` never gets mutated. The working copy has two symlinks:

- `out/episodes/<slug>/lib` → `src/lib`
- `out/episodes/<slug>/assets` → `src/episodes/<slug>/assets`

The script defends the invariant with explicit guards (refuses to render if
the working-copy path resolves to the source dir or escapes `./out/`), but
**cleanup tools that follow symlinks are the footgun to avoid**. Standard POSIX
`rm -rf out/episodes/<slug>` removes the symlinks themselves and is safe.
Tools like `find … -delete`, `rsync --delete`, and certain Node `fs.rm` configs
can follow symlinks and destroy source files. If in doubt, target the working
copy explicitly with `rm -rf out/episodes/<slug>` and never run symlink-
following cleanup on `out/`.

## Author a new episode

```bash
cd apps/hyperframe

# 1. Scaffold (vertical 9:16 default; --width / --height to override)
bun run new:episode my-first-short --handle="@your_handle"

# 2. Write the narration
echo "Your voiceover script. Punctuation drives pacing." \
  > examples/my-first-short.txt

# 3. Generate voice + word-level captions
bun run audio examples/my-first-short.txt --lang=es \
  --speed=1.0 --pause-sentence=300 --pause-clause=0 \
  --out=public/voice/my-first-short

# 4. Listen BEFORE building the visuals (TTS issues are cheap to fix in
#    the script, expensive after rendering)
afplay public/voice/my-first-short/voice.mp3

# 5. Stage assets in the episode dir + inline the captions JSON inside
#    <script id="captions-data"> in index.html. Author scenes inline.

# 6. Render (uses meta.tail = 3 by default; --tail=<s> overrides)
bun run render:episode my-first-short --format=mp4
```

The full e2e playbook (5-scene template, hierarchical spacing,
brand-corner crossfade, color palettes, TTS pronunciation gotchas) is in
[`.agents/skills/canonical-short/SKILL.md`](./.agents/skills/canonical-short/SKILL.md).

The brand wordmark and tagline default to `cgaravitoq` / `AI Engineering`
in `scripts/new-episode.mjs` (so the demo episodes render unchanged).
Override per-clone via the `BRAND_NAME` and `BRAND_TAGLINE` env vars,
or replace `logo-mark.svg` and the brand text directly in your scaffolded
episodes.

## Layout

```
apps/hyperframe/
  src/episodes/<slug>/   One monolithic index.html per episode + lib symlink
  src/lib/               Shared CSS vars + GSAP helpers + karaoke renderer
  scripts/               bun run audio / render:episode / new:episode / dev
  templates/             Reusable episode templates (asset-motion, brand-system,
                         data-benchmark, social-proof, source-driven, workflow)
  examples/<slug>.txt    Narration scripts (one per episode)
  public/voice/<slug>/   Canonical audio assets (gitignored, regenerable)
  renders/               Local render cache when using --keep-local (gitignored)
  hyperframes.json       paths.episodes: "src/episodes" (relative to app cwd)

packages/audio/          @cgaravitoq/audio — ElevenLabs TTS + Scribe STT,
                         ffprobe, script pacing. In-source TS (no compile).
                         Consumed via "workspace:*".
packages/catalog/        Visual component manifest + inline-safe snippets.
apps/mcp/                Local stdio MCP server for lint/audio/render/catalog.

.agents/skills/          Source skill files (audio-pipeline, canonical-short,
                         new-episode, produce-from-notion, short-*)
.{claude,codex,opencode}/skills/   Symlinks → .agents/skills/<name>

turbo.json               typecheck / test / build / dev / render:episode
.env / .env.example      ELEVENLABS_API_KEY etc. (.env gitignored)
biome.json               Lint/format (TS, JSON; HTML uses hyperframes lint)
tsconfig.json            Base TS config (workspaces extend it)
package.json             workspaces: ["apps/*","packages/*"]
bun.lock                 Single lockfile
AGENTS.md                Conventions, rules, canonical pattern
CLAUDE.md                Symlink → AGENTS.md
```

`AGENTS.md` is the canonical source of truth for conventions.

## Stack

- [Turborepo 2.9.x](https://turborepo.com/) — task orchestration
- [Bun 1.3.x workspaces](https://bun.com/docs/install/workspaces) — package management
- [Hyperframes 0.6.x](https://hyperframes.heygen.com/) — engine + CLI
- [GSAP 3.15.x](https://gsap.com/) — animation, paused timeline
- [`@elevenlabs/elevenlabs-js`](https://elevenlabs.io/docs/api-reference) — TTS + Scribe v2
- [biome](https://biomejs.dev/) + [vitest](https://vitest.dev/)

## License

[MIT](./LICENSE).
