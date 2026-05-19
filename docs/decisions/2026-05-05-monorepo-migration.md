# Monorepo migration

**Date**: 2026-05-05

Single-package `hyperframes-content` -> Turborepo monorepo `motion-shorts`.

## What changed

- `apps/hyperframe/` holds the shorts pipeline (was the root package)
- `packages/audio/` holds the reusable TTS+STT module (`@cgaravitoq/audio`, in-source TS, consumed via `workspace:*`)
- Shared configs at root: `biome.json`, `tsconfig.json` (base), `bunfig.toml`
- Agent skills (`.agents/skills/`) stay at root
- `turbo.json` orchestrates `typecheck`, `test`, `build`, `dev`, `render:episode`

## Rationale

The audio pipeline (TTS + STT + ffprobe + script pacing) was tightly coupled to the Hyperframes app. Extracting it as a workspace package enables:
- Independent versioning and testing (`packages/audio/__tests__/`)
- Reuse by future apps (Remotion, dashboards)
- Clean public API surface (`packages/audio/src/index.ts`)
