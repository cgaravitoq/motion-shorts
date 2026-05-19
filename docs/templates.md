# Hyperframes Templates

Templates are exact, versioned visual systems for shorts. They sit between the visual catalog and final episode HTML:

```text
skill chooses process -> catalog chooses components -> template fixes visual system -> scaffolder writes monolithic episode
```

The generated episode is still the render source of truth. It must keep all Hyperframes constraints from `AGENTS.md`: single-file HTML, no `data-composition-src`, paused GSAP, `window.__timelines`, seconds timing, deterministic animation, track 97 watermark, track 98 audio, track 99 captions, and the required brand outro.

## Available Templates

List templates from `apps/hyperframe/`:

```bash
bun run templates:list
```

### `source-driven-editorial@1`

Use for public-source editorial shorts where the source, proof, and payoff should follow the same visual grammar every time instead of being redesigned by the agent. The source artifacts live at:

```text
apps/hyperframe/templates/source-driven-editorial/v1/
```

Instantiate a new episode:

```bash
cd apps/hyperframe
bun run new-episode <slug> --template=source-driven-editorial@1
```

Use custom slots:

```bash
bun run new-episode <slug> \
  --template=source-driven-editorial@1 \
  --template-data=templates/source-driven-editorial/v1/sample-data.json
```

Validation:

```bash
bun run catalog:check src/episodes/<slug>/index.html
bunx hyperframes lint src/episodes/<slug>
```

`hyperframes lint` requires `assets/voice.mp3` to exist. For a template smoke check, a local ignored silent placeholder is acceptable; do not commit episode audio binaries.

### `social-proof-overlay@1`

Use for shorts led by posts, proof cards, follow overlays, and lower-thirds. Catalog focus: `x-post`, `source-proof-card`, `instagram-follow`, `yt-lower-third`.

### `workflow-canvas@1`

Use for pipeline and process shorts where the graph should own the scene. Catalog focus: `flowchart`, `source-knowledge-pipeline`, `svg-path-draw`, `map-route`.

### `data-benchmark@1`

Use for metric-first comparisons, benchmark claims, and source-backed charts. Catalog focus: `data-chart`, `source-stat-comparison`, `source-attribution-strip`, `svg-path-draw`.

### `brand-system-reveal@1`

Use for logo-led, identity, and product/brand reveal shorts. Catalog focus: `logo-orbit`, `brand-logo-cloud`, `product-turntable-lite`, `shimmer-sweep`.

### `asset-motion-showcase@1`

Use when captured images, screenshots, or product assets need reusable motion treatment. Catalog focus: `image-ken-burns`, `source-image-reveal`, `screenshot-spotlight`, `asset-stack-parallax`, `device-screen-pan`.
