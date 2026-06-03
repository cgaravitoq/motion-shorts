import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAudioDurationSeconds, getSTTProvider, getTTSProvider } from "@cgaravitoq/audio";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";
import { createJobId, ensureOutputDir } from "./local-runtime";

const inputSchema = z.object({
  text: z.string().min(1).max(5000, "text exceeds the 5000-char hard limit per request"),
  lang: z.enum(["en", "es"]),
  voice: z.string().optional(),
  stability: z.number().optional(),
  similarityBoost: z.number().optional(),
  style: z.number().optional(),
  speed: z.number().optional(),
});

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
      const { text, lang, voice, stability, similarityBoost, style, speed } =
        inputSchema.parse(input);
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
