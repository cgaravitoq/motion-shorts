# motion-shorts

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

```bash
cd apps/hyperframe
bun run render:episode demo-explainer-blocks --format=mp4
```

`render-episode.mjs` ffprobes the episode's `voice.mp3`, stamps
`data-duration` and inlines `assets/captions.json` in a working copy
under `apps/hyperframe/out/episodes/<slug>/`, then invokes
`bunx hyperframes render` on that copy — `apps/hyperframe/src/episodes/<slug>/`
is never mutated. The episode's `meta.json` carries a `tail` field
(default `3`) that pads past end-of-audio so the brand-card lockup holds
long enough to read. Override per-render with `--tail=<seconds>`.

The demo episodes ship without committed audio binaries — generate voice
locally with `bun run audio` (see [Author a new episode](#author-a-new-episode))
or wire your own R2 bucket and `bun run hydrate:episode <slug>`.

With R2 configured, verified render and asset artifacts are uploaded to R2 and
local render outputs are deleted by default. Use `--keep-local` when you need a
local mp4 to inspect; otherwise use the R2 URL emitted after upload.

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
