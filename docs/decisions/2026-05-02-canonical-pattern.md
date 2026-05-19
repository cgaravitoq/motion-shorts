# Canonical short pattern validated

**Date**: 2026-05-02

Production shorts (`short-01` through `short-08`) shipped, validating the canonical pattern:

- **Architecture**: Monolithic single-file `index.html` per episode. Zero `data-composition-src`.
- **Narrator at validation time**: a peninsular Spanish narrator preset from the ElevenLabs Voice Library. Superseded for new shorts by `docs/voice-config.md`, which documents how to pick and configure the primary ES / EN voices via env vars.
- **Scene transitions**: `FADE = 0.75s` cross-fades via `autoAlpha + scale + filter:blur`
- **Branding**: Persistent `#brand-corner` top-left + end-card crossfade (corner fades out, `.cta-brand` 34px solid pops in)
- **Hierarchical spacing**: Explicit margins replace uniform `gap` — tag->headline (32-90px), headline->body (40-90px), intra-body (12-22px)
- **Tail**: `--tail=6.5` end-card hold (later reduced to `tail: 3` in meta.json)
- **Color palette**: One primary + 2 accents per short, never reused consecutively. Background: `--ink: #060912`
- **Mesh BG**: 4 stacked layers (mesh, grid, grain, vignette). Half-period of breathing cycle ~ total duration / 2.

See `.agents/skills/canonical-short/SKILL.md` for the full e2e playbook.
