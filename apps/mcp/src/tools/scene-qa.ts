import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { HUB_ROOT } from "./scene-hub-runtime";

const inputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  scenes: z.array(z.string()).optional(),
});

export const sceneQaTool: ToolDefinition = {
  name: "scene_qa",
  description:
    "Run per-scene visual QA on an episode that already has a scene-spec.json in apps/hyperframe/src/episodes/<slug>/ (NO full mp4 render): re-assembles, captures snapshot key frames per scene and runs `inspect` for overflow/overlap. Pass `scenes` to QA only specific scene ids (iterate only the rejected ones). Returns the report and the per-scene PNG paths to review.",
  inputSchema: {
    type: "object",
    properties: {
      slug: { type: "string" },
      scenes: { type: "array", items: { type: "string" } },
    },
    required: ["slug"],
  },
  async handler(input) {
    try {
      const { slug, scenes } = inputSchema.parse(input);
      const args = ["run", "scripts/scene-qa.mjs", slug];
      if (scenes?.length) args.push(`--scenes=${scenes.join(",")}`);
      const proc = spawnSync("bun", args, { cwd: HUB_ROOT, encoding: "utf8" });
      if (proc.status !== 0) {
        throw new Error(`scene-qa failed: ${proc.stderr || proc.stdout}`);
      }
      const reportPath = join(HUB_ROOT, "renders", `${slug}-qa`, "report.json");
      const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
      return success({ slug, report, log: proc.stdout.trim().split("\n").slice(-6).join("\n") });
    } catch (error) {
      return failure(error);
    }
  },
};
