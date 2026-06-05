import { Schema } from "effect";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { HUB_ROOT, listSceneTypeSummaries } from "./scene-hub-runtime";

const INTENT_ENUM = ["informative", "data", "workflow", "social", "brand", "vfx"] as const;

const inputSchema = Schema.Struct({ intent: Schema.optional(Schema.Literal(...INTENT_ENUM)) });
const decodeInput = Schema.decodeUnknownSync(inputSchema);

export const listSceneTypesTool: ToolDefinition = {
  name: "list_scene_types",
  description:
    "List the parametric scene-types in the scene-hub (the only building blocks for a short). Each entry has its type, label, description, defaultDuration, intentTags, and a compact slot summary (name* = required, name? = optional, name[min-max] = repeatable). Optional `intent` filter.",
  inputSchema: {
    type: "object",
    properties: { intent: { type: "string", enum: [...INTENT_ENUM] } },
  },
  async handler(input) {
    try {
      const { intent } = decodeInput(input);
      let all = listSceneTypeSummaries(HUB_ROOT);
      if (intent) all = all.filter((s) => s.intentTags.includes(intent));
      return success(all);
    } catch (error) {
      return failure(error);
    }
  },
};
