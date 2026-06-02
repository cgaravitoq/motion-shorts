import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { HUB_ROOT, validateSceneSpec } from "./scene-hub-runtime";

const inputSchema = z.object({ spec: z.record(z.string(), z.unknown()) });

export const validateSceneSpecTool: ToolDefinition = {
  name: "validate_scene_spec",
  description:
    "Validate a scene-spec against the scene-type manifests WITHOUT assembling. Returns { ok, errors[], warnings[] }: checks slug, unique scene ids, that each scene.type exists, required slots are present, and repeat-slot counts are within range. Run this before assembling.",
  inputSchema: {
    type: "object",
    properties: { spec: { type: "object", additionalProperties: true } },
    required: ["spec"],
  },
  async handler(input) {
    try {
      const { spec } = inputSchema.parse(input);
      return success(validateSceneSpec(spec, { hubRoot: HUB_ROOT }));
    } catch (error) {
      return failure(error);
    }
  },
};
