import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { HUB_ROOT, routeIntent } from "./scene-hub-runtime";

const INTENT_ENUM = ["informative", "data", "workflow", "social", "brand", "vfx"] as const;

const inputSchema = z.object({ intent: z.enum(INTENT_ENUM) });

export const recommendSceneTypesTool: ToolDefinition = {
  name: "recommend_scene_types",
  description:
    "Recommend scene-types for an intent. `intent` is a closed enum — one of: informative | data | workflow | social | brand | vfx. Returns a `skeleton` (a sensible ordered scene spine, hook-first/outro-last), `recommended` scene-types tagged for the intent, and the `structural` scenes every short needs.",
  inputSchema: {
    type: "object",
    properties: { intent: { type: "string", enum: [...INTENT_ENUM] } },
    required: ["intent"],
  },
  async handler(input) {
    try {
      const { intent } = inputSchema.parse(input);
      return success(routeIntent(intent, { hubRoot: HUB_ROOT }));
    } catch (error) {
      return failure(error);
    }
  },
};
