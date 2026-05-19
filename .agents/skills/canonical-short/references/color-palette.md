# Color palette reference

Load this file when picking colors for a new episode. Never reuse the primary color of the previous short.

## Production palettes used

| Short | Primary | Accents |
|---|---|---|
| short-01 (MCP) | cyan `#00d4ff` | magenta `#f97cff` + bridge violet |
| short-02 (AI Harness) | gold `#ffb547` | teal `#2ed3a8` + violet `#a78bfa` |
| short-03 (Prompt Caching) | emerald `#10b981` | warn-red `#ef4444` + gold `#fbbf24` |
| short-04 (Subagents) | amber `#ffb547` | teal `#2ed3a8` + warn-red |
| short-05 (ACE) | emerald | gold + warn-red |
| short-06 (Memoria estado) | violet | emerald + warn-red |

## Token mapping

Always use these theme tokens (the now-dead `--bg`/`--text`/`--accent-soft` were removed from theme.css):

| Token | Value | Usage |
|-------|-------|-------|
| `--ink` | `#060912` | Background |
| `--paper` | `#f4f6fb` | Text |
| `--muted` | `#8b95a5` | Secondary text |
| `--dim` | | De-emphasized elements |
| `--accent` | (per-short primary) | Primary accent color |
| `--code-bg` | `#0a0e17` | Code blocks |
| `--primary-2` | (per-short lighter) | Caption active token |

## Mesh BG (always present)

All four background layers are always present. GSAP breathes the mesh.

```css
.mesh {
  background-color: var(--ink);
  background-image:
    radial-gradient(circle at 22% 16%, rgba(<PRIMARY>, 0.32) 0%, transparent 42%),
    radial-gradient(circle at 80% 78%, rgba(<ACCENT>, 0.28) 0%, transparent 45%),
    radial-gradient(circle at 50% 50%, rgba(<SOFT>, 0.10) 0%, transparent 55%);
  filter: saturate(1.05);
}
```

Additional layers: `.grid` (60px squares, opacity 0.65), `.grain` (radial dots, mix-blend overlay), `.vignette` (radial darken at edges).

## Font rule

`font-family` must be literal — Hyperframes does NOT resolve `var()` in `font-family`:
```css
font-family: "Inter", system-ui, sans-serif;
font-family: "JetBrains Mono", Menlo, monospace;
```

Use `references/typography-system.md` for font sizes, weights, and role names. This file only defines palette and literal family names.
