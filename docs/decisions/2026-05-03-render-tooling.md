# Render tooling: Scribe v2, tail, captions shape

**Date**: 2026-05-03

## Scribe v2 default

`ELEVENLABS_SCRIBE_MODEL=scribe_v2` in `.env.example` and as the in-code default.
Same word-shape contract as v1, better punctuation detection, identical pricing tier.

## Tail persisted in meta.json

`render-episode.mjs` resolves tail as: `--tail` CLI flag > `meta.json` `tail` field > `0.3` fallback.
Production shorts use `tail: 3` (~3s holds the brand-card readable without overstaying).
Scaffolder emits `tail: 3` as default for new episodes.

## Captions shape

Hyperframes-canonical: `[{text, start, end, confidence?}]` in seconds.
Inlined as `<script type="application/json" id="captions-data">` in episode HTML so the timeline build stays synchronous.
`captions-karaoke.js` consumes this directly. Scribe provider (`ElevenLabsScribeProvider`) emits this shape natively.
