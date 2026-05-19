# AGENTS.md — motion-shorts

> **Canonical file.** `CLAUDE.md` is a symlink to this file.
> If `CLAUDE.md` is a regular file, run once: `rm CLAUDE.md && ln -s AGENTS.md CLAUDE.md`

Read this first when working in the repo. It's a **map**, not a manual — navigate deeper as needed via the pointers below.

## What this is

Turborepo monorepo for vertical 9:16 motion-graphics shorts (YouTube, TikTok, LinkedIn, Reels).

```
script.txt -> ElevenLabs TTS -> voice.mp3 + word-level captions.json
                                          |
         HTML + GSAP timeline (monolithic, paused) + assets/voice.mp3
                                          |
                bunx hyperframes render -> mp4 / mov / webm
```

```
apps/hyperframe/     Shorts pipeline (Hyperframes 0.6.x + GSAP 3.15.x)
apps/mcp/            Local stdio MCP server with in-process lint/audio/render tools
packages/audio/      TTS + STT + ffprobe + script pacing (@cgaravitoq/audio)
packages/catalog/    Visual component manifest + inline-safe catalog tooling
.agents/skills/      Agent workflow skills (canonical-short, audio-pipeline, etc.)
docs/                Rules, layout, commands, decisions (read on-demand)
```

## Critical constraints

Breaking any of these will corrupt the render. They are non-negotiable.

1. **Monolithic single-file.** Each `apps/hyperframe/src/episodes/<slug>/index.html` contains ALL CSS + HTML + GSAP + captions JSON inline. Zero `data-composition-src` — the runtime force-applies `position: absolute; top:0; left:0; 100%x100%` on tracked stage children, collapsing sub-comp flex layouts.
2. **GSAP: `paused: true` + `window.__timelines["<id>"]` registry.** Frame-accurate seek requires both. Missing registry = no animation. Missing `paused: true` = frame seek breaks.
3. **Times in SECONDS.** `data-duration` is seconds, GSAP timeline matches. Frame/30 = sec.
4. **Deterministic only.** No `Math.random`, `Date.now`, `repeat: -1`, or async timeline construction. Lint catches it.
5. **CWD for CLI.** Run `bunx hyperframes` and `bun run <script>` from `apps/hyperframe/` (or via `turbo run`). Running from root fails to find episodes.
6. **bun + biome.** `bun install` always from repo root. Biome for TS/JSON lint; `bunx hyperframes lint <dir>` for HTML compositions. No eslint, no prettier, no npm.
7. **Seek-safe GSAP.** `onStart` / `onComplete` / `tl.call()` do NOT fire during seek — Hyperframes seeks frame-by-frame, never plays. Use `tl.set(target, props, t)` (zero-duration tween) for discrete transitions; materialises at any seek position. `onUpdate` IS seek-safe (use for animated counters, bar fills).
8. **Track-index convention.** `0..8` for BG layers + scenes, `97` for `#brand-corner`, `98` for audio, `99` for captions.
9. **Artifact persistence.** R2 + remote manifests (`render.remote.json`, `assets.remote.json`) are canonical for render/audio/image artifacts. Local generated media are cache/working copies only; do not commit heavy episode binaries. Hydrate first-time clones with `bun run hydrate:episode <slug>` when assets live only in R2.

## Catalog preflight

Before authoring or editing a short, inspect the visual catalog in `packages/catalog/manifest.json` and run `bun run catalog:list` from `apps/hyperframe/` to choose inline-safe components. Remote agents can use the MCP `list_visual_components` tool for the same catalog-first lookup.

## Visual framing rule

Do not wrap a self-framed object in a generic glass/card container. Terminal windows, code editors, browser/app windows, social post cards, phone/device mockups, and media player cards are already containers; make them the primary scene object and animate that object directly. Use a glass/card frame only for loose content that needs grouping: metric lists, labels, unframed diagrams, badge groups, or abstract blocks.

For diagrams, choose the frame based on density. Compact charts or small decision diagrams can sit in a card. Workflow graphs, pipelines, and multi-node flowcharts should use an open canvas or a full-scene frame so the graph has breathing room in 9:16.

## Navigation — read on-demand

| Need | Go to |
|------|-------|
| Full rules reference (23 rules) | `docs/rules.md` |
| Directory layout (annotated tree) | `docs/layout.md` |
| Run the local in-process MCP server (Claude Desktop / Cursor / Codex) | `apps/mcp/README.md` |
| Env vars and local defaults | `.env.example` |
| Setup + common commands | `docs/quickstart.md` |
| Voice IDs, TTS gotchas, pause injection | `docs/voice-config.md` |
| Typography roles for informative/source-driven shorts | `.agents/skills/canonical-short/references/typography-system.md` |
| Exact reusable Hyperframes templates | `docs/templates.md` + `apps/hyperframe/templates/` |
| Brand packs (white-label) | `docs/brand-packs.md` |
| MCP integrations (Notion) | `docs/mcp-integrations.md` |
| Visual component catalog | `packages/catalog/manifest.json` + `bun run catalog:list` |
| Source URL capture | `docs/quickstart.md#source-url-capture` |
| Past design decisions | `docs/decisions/` |
| **Build a new short (e2e playbook)** | `.agents/skills/canonical-short/SKILL.md` |
| Generate audio + captions | `.agents/skills/audio-pipeline/SKILL.md` |
| Scaffold a new episode | `.agents/skills/new-episode/SKILL.md` |
| Produce from Notion brief | `.agents/skills/produce-from-notion/SKILL.md` |

## Environment

**No `process.env` in `.ts` source.** All env reads go through the package's `env.ts`. Enforced by `scripts/check-no-process-env.sh` (pre-commit + `bun run lint:env`).
