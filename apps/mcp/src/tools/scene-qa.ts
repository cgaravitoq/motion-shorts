import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { HUB_ROOT } from "./scene-hub-runtime";

const inputSchema = Schema.Struct({
  slug: Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/)),
  scenes: Schema.optional(Schema.Array(Schema.String)),
  frames: Schema.optional(Schema.Literals([1, 3])),
});
const decodeInput = Schema.decodeUnknownSync(inputSchema);

export const sceneQaTool: ToolDefinition = {
  name: "scene_qa",
  description:
    "Run per-scene visual QA on an episode that already has a scene-spec.json in apps/hyperframe/src/episodes/<slug>/ (NO full mp4 render): re-assembles, captures one settled 'final' frame per scene (frames=3 for entry/mid/late motion debugging) and runs `inspect` for overflow/overlap. Pass `scenes` to QA only specific scene ids (iterate only the rejected ones). Returns the report plus the contact-sheet image of every sampled scene inline — show that image to the user in the chat for HITL review; never ask them to open the PNG folders.",
  inputSchema: {
    type: "object",
    properties: {
      slug: { type: "string" },
      scenes: { type: "array", items: { type: "string" } },
      frames: { type: "number", enum: [1, 3], description: "1 (default): one settled final frame per scene. 3: entry/mid/late for motion debugging." },
    },
    required: ["slug"],
  },
  async handler(input) {
    try {
      const { slug, scenes, frames } = decodeInput(input);
      const args = ["run", "scripts/scene-qa.ts", slug, `--frames=${frames ?? 1}`];
      if (scenes?.length) args.push(`--scenes=${scenes.join(",")}`);
      const proc = spawnSync("bun", args, { cwd: HUB_ROOT, encoding: "utf8" });
      if (proc.status !== 0) {
        throw new Error(`scene-qa failed: ${proc.stderr || proc.stdout}`);
      }
      const reportPath = join(HUB_ROOT, "renders", `${slug}-qa`, "report.json");
      const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
      const result = success({ slug, report, log: proc.stdout.trim().split("\n").slice(-6).join("\n") });
      for (const sheet of report?.contactSheets ?? []) {
        const sheetPath = join(HUB_ROOT, sheet);
        if (existsSync(sheetPath)) {
          result.content.push({
            type: "image",
            data: readFileSync(sheetPath).toString("base64"),
            mimeType: "image/jpeg",
          });
        }
      }
      return result;
    } catch (error) {
      return failure(error);
    }
  },
};
