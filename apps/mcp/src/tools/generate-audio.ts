import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAudioDurationSeconds, getSTTProvider, getTTSProvider } from "@cgaravitoq/audio";
import { Schema } from "effect";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { createJobId, ensureOutputDir } from "./local-runtime";

const inputSchema = Schema.Struct({
  text: Schema.NonEmptyString.pipe(
    Schema.maxLength(5000, { message: () => "text exceeds the 5000-char hard limit per request" }),
  ),
  lang: Schema.Literal("en", "es"),
  voice: Schema.optional(Schema.String),
  stability: Schema.optional(Schema.Number),
  similarityBoost: Schema.optional(Schema.Number),
  style: Schema.optional(Schema.Number),
  speed: Schema.optional(Schema.Number),
});
const decodeInput = Schema.decodeUnknownSync(inputSchema);

const jsonSchema = {
  type: "object" as const,
  properties: {
    text: { type: "string", minLength: 1, maxLength: 5000 },
    lang: { type: "string", enum: ["en", "es"] },
    voice: { type: "string" },
    stability: { type: "number" },
    similarityBoost: { type: "number" },
    style: { type: "number" },
    speed: { type: "number" },
  },
  required: ["text", "lang"],
};

export const generateAudioTool: ToolDefinition = {
  name: "generate_audio",
  description:
    "Synthesize narration audio (mp3) and word-level captions JSON from text using the local audio package. Synchronous — returns absolute local paths for voice.mp3 and captions.json under MCP_OUTPUT_DIR. Hard limit: 5000 chars per request.",
  inputSchema: jsonSchema,
  async handler(input) {
    try {
      const { text, lang, voice, stability, similarityBoost, style, speed } = decodeInput(input);
      const jobId = createJobId();
      const outputDir = join(await ensureOutputDir(), jobId);
      const audioPath = join(outputDir, "voice.mp3");
      const captionsPath = join(outputDir, "captions.json");

      await mkdir(outputDir, { recursive: true });
      const body = await getTTSProvider().synthesize(text, {
        lang,
        voiceId: voice,
        stability,
        similarityBoost,
        style,
        speed,
      });
      await writeFile(audioPath, body);

      const captions = await getSTTProvider().transcribe(audioPath, { lang });
      await writeFile(captionsPath, JSON.stringify({ words: captions }, null, 2));

      return success({
        jobId,
        audioPath,
        captionsPath,
        durationSec: await getAudioDurationSeconds(audioPath),
        charsUsed: [...text.trim()].length,
      });
    } catch (error) {
      return failure(error);
    }
  },
};
