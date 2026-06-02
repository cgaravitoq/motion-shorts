import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { HUB_ROOT, resolveSceneType } from "./scene-hub-runtime";

const inputSchema = z.object({ type: z.string().min(1), version: z.number().int().positive().default(1) });

export const getSceneTypeTool: ToolDefinition = {
  name: "get_scene_type",
  description:
    "Get the full contract for one scene-type: its manifest (typed slot schema, builder, defaultDuration, intentTags), the DOM fragment, and a sample params object. Use this to learn exactly which slots to fill before adding a scene to a scene-spec.",
  inputSchema: {
    type: "object",
    properties: { type: { type: "string" }, version: { type: "integer", default: 1 } },
    required: ["type"],
  },
  async handler(input) {
    try {
      const { type, version } = inputSchema.parse(input);
      const resolved = resolveSceneType(type, version, HUB_ROOT);
      const samplePath = join(HUB_ROOT, "templates/scenes", type, `v${version}`, "sample.json");
      const sample = existsSync(samplePath) ? JSON.parse(readFileSync(samplePath, "utf8")) : {};
      return success({
        id: resolved.manifest.id,
        type,
        version,
        manifest: resolved.manifest,
        fragment: resolved.fragment,
        sample,
      });
    } catch (error) {
      return failure(error);
    }
  },
};
