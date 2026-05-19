# source-driven-editorial@1

Exact 9:16 Hyperframes template for source-driven editorial shorts. It is anchored on the proven `source-driven-editorial-demo` visual system, but normalized to the current repo contract: top-right `#brand-corner`, required `brand-logo-outro`, paused GSAP timeline, catalog comment on line 2, seconds timing, and monolithic output.

## Contract

- Skills decide the production process and intent.
- The catalog defines reusable components and validation rules.
- This template defines the exact visual system, slot schema, timing, typography, and motion grammar.
- `new-episode --template=source-driven-editorial@1` instantiates a complete monolithic episode under `src/episodes/<slug>/`.

Generated episodes must remain self-contained in `index.html`: CSS, HTML, GSAP, and captions JSON placeholder are inline. The generated episode may symlink `lib/` for shared runtime helpers, but it must not use `data-composition-src` or import template code at render time.

## Files

- `manifest.json` — versioned template contract, catalog IDs, slots, timing, tracks, and validation expectations.
- `sample-data.json` — default slot data used by the scaffolder and demo.
- `tokens.css` — exact visual tokens, typography, component styling, and template layout.
- `timeline.js` — deterministic paused GSAP grammar with seek-safe `tl.set` calls for discrete states.
- `template.html.tmpl` — monolithic HTML source with slot placeholders.

## Usage

```bash
cd apps/hyperframe
bun run new-episode source-driven-editorial-demo --template=source-driven-editorial@1
bun run catalog:check src/episodes/source-driven-editorial-demo/index.html
bunx hyperframes lint src/episodes/source-driven-editorial-demo
```

Optional data file:

```bash
bun run new-episode my-source-short \
  --template=source-driven-editorial@1 \
  --template-data=templates/source-driven-editorial/v1/sample-data.json
```

## Slot Notes

Use short, paraphrased source copy. The source brand can influence accent colors and attribution labels, but it must not replace the persistent cgaravitoq watermark or the final brand outro. Keep Berkeley Mono for labels and proof metadata in this family; fallback to JetBrains Mono when the local Berkeley asset is absent.
