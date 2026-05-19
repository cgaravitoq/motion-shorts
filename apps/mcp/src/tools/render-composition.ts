import type { ToolDefinition } from ".";
import { renderComposition, renderCompositionJsonSchema } from "./render-composition-shared";

export const renderCompositionTool: ToolDefinition = {
  name: "render_composition",
  description:
    "Render a finished mp4/mov/webm video from a Hyperframes HTML composition locally. Synchronous — returns `{ jobId, outputPath, outputBytes, outputDurationSec }`. The HTML must include deterministic Hyperframes metadata (`data-width`, `data-height`, `data-duration`) and a paused GSAP timeline registered in `window.__timelines`; call lint_html first to catch issues. Audio and captions are optional.",
  inputSchema: renderCompositionJsonSchema,
  handler: (input) => renderComposition(input),
};
