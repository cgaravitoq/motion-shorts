# Brand packs (white-label)

`apps/hyperframe/brands/<slug>/brand.json` lets the scaffolder + render pipeline emit shorts in a different visual identity (palette, fonts, handle, voice).

Existing demos (`catalog-components-lab/`, `demo-explainer-blocks/`, `demo-explainer-with-logo/`, `demo-social-overlays/`, `source-driven-catalog-demo/`, `source-driven-editorial-demo/`) keep their hardcoded `:root` block intact — brand packs only apply to episodes whose `meta.json` declares `"brand": "<slug>"`.

```
apps/hyperframe/brands/
  default/brand.json   Baseline (mirrors theme.css, publishable=true).
  <your-brand>/brand.json   Your own white-label pack. Set publishable=false
                            for partner/customer brands whose guidelines
                            forbid mixing assets with other handles.
```

## Brand JSON fields

| Field | Description |
|-------|-------------|
| `palette` | CSS variable map. Keys become `var(--brand-<key>)` at render time. |
| `handle` | Social handle (e.g., `@your_handle`) |
| `wordmark` | Brand name text |
| `fonts` | Font family overrides |
| `voice.elevenlabsVoiceIdEs` | ElevenLabs voice ID for Spanish |
| `voice.elevenlabsVoiceIdEn` | ElevenLabs voice ID for English |
| `publishable` | Legal gate. `false` = CI should block publish. |
| `notes` | Freeform notes about usage restrictions |

## Workflow

```bash
cd apps/hyperframe
bun run new:episode <slug> --brand=<your-brand>   # emits meta.brand, var(--brand-*) refs,
                                                  # and a <style id="brand-vars"> placeholder
bun run render:episode <slug>                     # reads meta.brand, stamps :root vars
                                                  # into the working copy under out/
```

`render-episode.ts` warns when `publishable=false`; CI consumers should treat that as a publish gate. The stamp happens in `apps/hyperframe/out/episodes/<slug>/index.html` only — `src/` stays diff-clean.

> Note: `brands/` does not exist yet — it's a planned feature. The first brand pack land creates `apps/hyperframe/brands/default/brand.json`.
