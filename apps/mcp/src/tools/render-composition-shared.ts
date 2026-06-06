import { stat } from "node:fs/promises";
import { join } from "node:path";
import { getAudioDurationSeconds } from "@cgaravitoq/audio";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Effect, Schema } from "effect";
import { failure, success } from "./_helpers";
import { createJobId, ensureOutputDir, renderCompositionToFile } from "./local-runtime";

export const renderCompositionInputSchema = Schema.Struct({
  html: Schema.NonEmptyString,
  assets: Schema.optional(
    Schema.Array(Schema.Struct({ name: Schema.String, data: Schema.String })),
  ),
  format: Schema.Literals(["mp4", "mov", "webm"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("mp4")),
  ),
  fps: Schema.Literals([24, 30, 60]).pipe(Schema.withDecodingDefault(Effect.succeed(30))),
  quality: Schema.Literals(["draft", "standard", "high"]).pipe(
    Schema.withDecodingDefault(Effect.succeed("standard")),
  ),
});
const decodeInput = Schema.decodeUnknownSync(renderCompositionInputSchema);

export const renderCompositionJsonSchema = {
  type: "object" as const,
  properties: {
    html: { type: "string", minLength: 1 },
    assets: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, data: { type: "string" } },
        required: ["name", "data"],
      },
    },
    format: { type: "string", enum: ["mp4", "mov", "webm"], default: "mp4" },
    fps: { type: "integer", enum: [24, 30, 60], default: 30 },
    quality: { type: "string", enum: ["draft", "standard", "high"], default: "standard" },
  },
  required: ["html"],
};

export const renderComposition = async (
  input: unknown,
  _path = "/compositions/render",
): Promise<CallToolResult> => {
  try {
    const request = decodeInput(input);
    const jobId = createJobId();
    const outputPath = join(await ensureOutputDir(), `${jobId}.${request.format}`);

    await renderCompositionToFile({
      jobId,
      html: request.html,
      assets: [...(request.assets ?? [])],
      format: request.format,
      fps: request.fps,
      quality: request.quality,
      outputPath,
    });

    const { size } = await stat(outputPath);

    return success({
      jobId,
      outputPath,
      outputBytes: size,
      outputDurationSec: await getAudioDurationSeconds(outputPath),
    });
  } catch (error) {
    return failure(error);
  }
};
