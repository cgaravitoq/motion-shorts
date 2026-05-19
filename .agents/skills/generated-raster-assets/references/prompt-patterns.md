# Generated Raster Asset Prompt Patterns

This reference converts current image-generation prompting guidance into a Hyperframes-safe asset workflow.

Research anchors:

- OpenAI image guidance: https://openai.com/academy/image-generation/
  - Use short, clear prompts grounded in purpose, subject, action, setting, style, framing, lighting, and constraints.
  - Iterate with small targeted changes.
  - For text in images, specify quoted text, placement, font style, color, and keep labels short.
- OpenAI cookbook image prompting guide: https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide/
  - Treat prompt structure, composition, text rendering, and revision strategy as production controls.
- Google Imagen guide: https://ai.google.dev/gemini-api/docs/imagen
  - Favor descriptive prompts that specify subject, context, style, and composition.
- Adobe Firefly prompt guidance: https://helpx.adobe.com/firefly/web/generate-images-with-text-to-image/generate-images-using-text-prompts/writing-effective-text-prompts.html
  - Use simple direct language with subject, descriptors, and keywords; add style and lighting details instead of vague phrasing.

## Prompt Anatomy

Use this structure for every generated asset:

```text
Purpose: [what this asset must communicate in the short]
Canvas: [1080x1920 full vertical scene, or exact aspect/crop]
Subject: [primary object or scene]
Composition: [foreground/background, left/right, focal point, safe negative space]
Visual style: [product mockup, clean editorial UI, tactile bundle diagram, etc.]
Color/material/lighting: [palette and light direction]
Text policy: [no text, or exact short labels in quotes with placement]
Constraints: [no logos, no brand imitation, no extra labels, no sci-fi, no clutter]
Output: [single clean PNG/WebP source asset, no border unless the object is self-framed]
```

Keep the first attempt specific but not overpacked. Iterate with one change at a time, for example: "Keep the same composition; reduce background clutter and make the connector lines thicker."

## Product Or Workspace Screenshot

Use for fake app screens, IDE/workspace views, browser dashboards, design tools, or source-product style scenes.

```text
Purpose: create the hero visual for a vertical short explaining [topic].
Canvas: 1080x1920 vertical. Leave clear negative space in the bottom 360px for captions and in the top-right safe area for a small watermark.
Subject: a polished generic AI workspace screenshot, shown as the primary object, not inside an extra card. The UI has a left file tree, central editor or canvas, right review panel, and small status chips.
Composition: large workspace window centered, slight perspective, readable big regions, no tiny body text. Important visual focus in the center 70% of the frame.
Visual style: premium product screenshot, crisp UI, restrained editorial lighting, realistic shadows, clean dark-on-light or light-on-dark contrast.
Text policy: use only short generic labels: "Context", "Draft", "Review", "Ship". No paragraphs.
Constraints: no real company logos, no recognizable product brand, no unreadable microtext, no duplicated windows, no extra floating cards.
Output: one clean PNG source asset.
```

HTML usage:

```html
<img class="scene-asset scene-asset--workspace" src="assets/generated/workspace-overview.png" alt="" />
```

```css
.scene-asset--workspace {
  position: absolute;
  left: 76px;
  top: 250px;
  width: 928px;
  height: 1080px;
  object-fit: cover;
  object-position: center;
}
```

## Handoff Bundle Diagram

Use when the scene needs a tactile bundle of files, screenshots, tickets, checklist cards, or design artifacts. This pattern worked well in `source-driven-catalog-demo`.

```text
Purpose: show a complete handoff bundle moving from design to implementation.
Canvas: 1080x1920 vertical, with the bundle occupying the center and upper-middle of the frame.
Subject: an organized bundle of generic project artifacts: a design screenshot sheet, a checklist, a spec page, a small asset folder, and connector ribbons tying them together.
Composition: one coherent bundle, angled slightly, with clear separation between artifacts. Keep the bottom 320px quiet for captions.
Visual style: premium editorial product illustration, crisp raster detail, subtle paper texture, soft shadow, high contrast edges.
Text policy: only short Spanish labels if needed: "Diseño", "Assets", "Checklist", "Entrega". Preserve accents exactly. No body copy.
Constraints: no real brand logos, no fake unreadable paragraphs, no duplicated labels, no extra loose cards outside the bundle.
Output: one clean PNG source asset with transparent or simple background.
```

## Connector-Heavy Visual Explainer

Use when an HTML flowchart would exceed four nodes, require crossing lines, or collide with captions in 9:16.

```text
Purpose: explain the relationship between [input], [decision], [artifact], and [output] as one clean visual.
Canvas: 1080x1920 vertical. Leave top-right watermark space and bottom caption space.
Subject: a clean open-canvas workflow diagram with 5-7 nodes and thick readable connector lines.
Composition: main flow travels from upper-left to lower-right with no crossing lines. Nodes have generous spacing and one clear focal output node.
Visual style: editorial systems diagram, precise geometry, soft depth, restrained accent colors, high contrast connectors.
Text policy: short labels only, each in quotes: "[Label 1]", "[Label 2]", "[Label 3]". Use large sans-serif lettering.
Constraints: no tiny labels, no crossing connectors, no dense grid background, no generic glass card around the whole diagram.
Output: one clean PNG source asset.
```

If exact text matters, generate the diagram without labels and overlay the labels in HTML. This is usually safer for Spanish accents and technical terms.

## Provenance Note

Use one compact note per generated asset batch:

```md
## Generated assets

- `assets/generated/workspace-overview.png`
  - Kind: generated raster source asset
  - Purpose: product/workspace hero for scene 2
  - Prompt source: `.agents/skills/generated-raster-assets/references/prompt-patterns.md`
  - Model/tool: [tool name if known]
  - Human approval: [date or "pending"]
  - External references: none / [source URL]
```

## QA Rubric

Before handoff, inspect rendered frames and reject the asset if:

- Any important object is cropped by the stage, captions, brand corner, or outro transition.
- Connectors touch labels, cross unintentionally, or terminate between cards.
- Generated text contains broken Spanish accents, missing `ñ`, misspelled technical terms, or fake paragraphs that look like copy.
- The image imitates a real third-party logo or exact product UI without a cleared source-driven reason.
- The asset is just a card inside a card; self-framed screenshots and bundles must be the scene object.
- The image looks too generic compared with a simple catalog component that would communicate the idea more clearly.
