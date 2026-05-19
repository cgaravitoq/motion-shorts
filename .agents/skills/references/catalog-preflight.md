# Catalog preflight reference

Run this contract before entering a short-production skill:

1. Read the catalog manifest summary by calling `route({ intent, tags?, source? })` for the selected short intent.
2. Treat every returned component with `status: required` as mandatory for the episode.
3. Pick optional `status: first-class` and `status: copy-paste` components by intent fit; keep the set minimal.
   - For generated raster scenes, prefer image-friendly components such as `screenshot-spotlight`, `image-ken-burns`, `asset-stack-parallax`, `device-screen-pan`, or `source-image-reveal` when they fit the scene.
   - If the visual needs product/workspace screenshots, handoff bundles, or dense connector diagrams, invoke `.agents/skills/generated-raster-assets/SKILL.md` before authoring the HTML.
4. Refuse every `status: deprecated` component, even when it appears relevant.
5. Persist the final chosen component IDs as `<!-- catalog: [id1, id2, ...] -->` on the line immediately after `<!doctype html>` in `index.html` (no blank line, no other comments between).
6. Continue into `canonical-short`, `produce-from-notion`, or `audio-pipeline` only after the catalog comment is present.
