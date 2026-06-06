import { Schema } from "effect";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { assembleEpisode, HUB_ROOT, validateSceneSpec } from "./scene-hub-runtime";

const inputSchema = Schema.Struct({
  spec: Schema.Record(Schema.String, Schema.Unknown),
});
const decodeInput = Schema.decodeUnknownSync(inputSchema);

export const assembleEpisodeTool: ToolDefinition = {
  name: "assemble_episode",
  description:
    "Assemble a scene-spec into ONE monolithic, render-ready index.html (deterministic: identical spec => identical bytes). Validates first; on failure returns the validation errors. On success returns { html, scenes[] (id/type/track/window/mid), totalDuration }. The html is returned, not written to disk.",
  inputSchema: {
    type: "object",
    properties: { spec: { type: "object", additionalProperties: true } },
    required: ["spec"],
  },
  async handler(input) {
    try {
      const { spec } = decodeInput(input);
      const validation = validateSceneSpec(spec, { hubRoot: HUB_ROOT });
      if (!validation.ok) {
        return failure(
          Object.assign(new Error(`scene-spec invalid: ${validation.errors.join("; ")}`), {
            failures: validation.errors,
          }),
        );
      }
      const built = assembleEpisode(spec, { hubRoot: HUB_ROOT });
      return success({
        html: built.html,
        scenes: built.scenes,
        totalDuration: built.totalDuration,
        audioDuration: built.audioDuration,
        warnings: [...validation.warnings, ...built.warnings],
      });
    } catch (error) {
      return failure(error);
    }
  },
};
