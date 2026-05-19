# Canonical short pattern validated

**Date**: 2026-05-02

Production shorts (`short-01` through `short-08`) shipped, validating the canonical pattern:

- **Architecture**: Monolithic single-file `index.html` per episode. Zero `data-composition-src`.
- **Narrator at validation time**: ES preset (Alberto Rodriguez, `l1zE9xgNpUTaQCZzpNJa`). Superseded for new shorts by `docs/voice-config.md`: primary ES is `t9LRTh3y1ioN00e9wsNh`; Carlos's personal clone is secondary.
- **Scene transitions**: `FADE = 0.75s` cross-fades via `autoAlpha + scale + filter:blur`
- **Branding**: Persistent `#brand-corner` top-left + end-card crossfade (corner fades out, `.cta-brand` 34px solid pops in)
- **Hierarchical spacing**: Explicit margins replace uniform `gap` — tag->headline (32-90px), headline->body (40-90px), intra-body (12-22px)
- **Tail**: `--tail=6.5` end-card hold (later reduced to `tail: 3` in meta.json)
- **Color palette**: One primary + 2 accents per short, never reused consecutively. Background: `--ink: #060912`
- **Mesh BG**: 4 stacked layers (mesh, grid, grain, vignette). Half-period of breathing cycle ~ total duration / 2.

See `.agents/skills/canonical-short/SKILL.md` for the full e2e playbook.
