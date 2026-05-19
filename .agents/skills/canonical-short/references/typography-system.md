# Typography System

Use this for source-driven, informative, workflow, and data-led shorts. Do not invent new font weights per episode.

## Font Loading

Every episode must load the same families:

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap"
/>
```

Use literal `font-family` declarations. Hyperframes does not resolve CSS vars in `font-family`.

```css
font-family: "Inter", system-ui, sans-serif;
font-family: "JetBrains Mono", ui-monospace, monospace;
```

## Role Tokens

| Role | Family | Size | Weight | Line Height | Letter Spacing | Use |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `hf-display` | Inter | `91px` | `890` | `0.98` | `0` | First-scene hook or one dominant claim. |
| `hf-headline` | Inter | `78px` | `850` | `1.02` | `0` | Standard scene headline. |
| `hf-compact-title` | Inter | `58px` | `850` | `1.02` | `0` | Titles inside source cards or framed components. |
| `hf-card-title` | Inter | `34px` | `820` | `1.04` | `0` | Card, grid, and metric row labels. |
| `hf-card-body` | Inter | `34px` | `760` | `1.12` | `0` | Support proof claims and short body copy. |
| `hf-eyebrow` | JetBrains Mono | `23px` | `800` | `1.2` | `0` | Uppercase scene label above a headline. |
| `hf-source-pill` | JetBrains Mono | `21px` | `650` | `1.2` | `0` | Source attribution, URL, or metadata pill. |
| `hf-mono-small` | JetBrains Mono | `18px` | `700` | `1.2` | `0` | Secondary metadata inside components. |
| `hf-outro-name` | Inter | `72px` | `790` | `1.02` | `0` | Final `cgaravitoq` wordmark only. |
| `hf-outro-tagline` | JetBrains Mono | `30px` | `590` | `1.2` | `3px` | Final `AI Engineering` tagline only. |
| `hf-caption` | Inter | `60px` | `900` | `1.1` | `0` | Karaoke captions. |

## Rules

- Do not use arbitrary weights like `780`, `820`, `850`, or `890` outside the role that owns that value.
- Use `hf-display` only when the scene has one dominant text block. If the scene also has a large component, use `hf-headline`.
- Source brands may affect colors, screenshots, logos, and source labels, but never typography.
- Keep source labels visually secondary: `hf-source-pill`, not a heavy card or full-width bar.
- The final brand scene only uses `hf-outro-name` and `hf-outro-tagline`; never place source cards in the outro.
