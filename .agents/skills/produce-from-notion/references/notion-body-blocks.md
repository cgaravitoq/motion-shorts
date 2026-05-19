# Notion page body structure (stage 6 push)

Load this file at **Stage 6 — Push to Notion**. It defines the exact block structure for the page body appended to the Notion entry after render approval.

Use `mcp__notion__API-patch-block-children` with `block_id = <chosen_page_id>` and these blocks in order:

1. `heading_2` "Status"
2. `paragraph` with bold "ASSET READY" + render path + duration + commit hash
3. `heading_2` "Production summary"
4. 5 `bulleted_list_item`: slug, voice, audio settings, length, pattern
5. `heading_2` "5 escenas (paleta <primary> + <accent> + <secondary>)"
6. 5 `bulleted_list_item`: one per scene with timing + visual description
7. `heading_2` "Componentes inline desarrollados (reusables como pattern)"
8. N `bulleted_list_item`: each reusable inline component developed
9. `heading_2` "Datos verificados (research <YYYY-MM-DD>)"
10. `paragraph` with sources
11. N `bulleted_list_item`: each verified fact
12. `heading_2` "Render command"
13. `code` (bash): the actual `bun run audio + cp + render:episode` chain
14. `heading_2` "Cross-platform variants"
15. 4 `bulleted_list_item`: YouTube Shorts / TikTok / LinkedIn / Instagram Reels
16. `divider`
17. `heading_2` "Publishing copies — tono educativo neutro"
18. `heading_3` "YouTube Shorts" + 4 pairs (paragraph + code) for ES Titulo / ES Descripcion / EN Title / EN Description
19. `heading_3` "Instagram Reels" + 2 pairs for ES Caption / EN Caption
20. `heading_3` "LinkedIn" + 2 pairs for ES Post / EN Post

## Properties update (6a)

Before appending the body, update page properties via `mcp__notion__API-patch-page`:

```
page_id: <chosen_page_id>
properties:
  Status: { select: { name: "Asset Ready" } }
  Asset Slug: { rich_text: [{ text: { content: "<slug>" } }] }
  # If working title was rewritten, push with checkmark:
  Title: { title: [{ text: { content: "✅ <new title>" } }] }
```

## Reference entry

The existing Notion entries (e.g. `short-03`) are the canonical reference for the body structure. Compare against them if unsure about any field.
