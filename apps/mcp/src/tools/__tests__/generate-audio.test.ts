import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const synthesize = mock(async () => Buffer.from("audio-bytes"));
const transcribe = mock(async () => [{ text: "Hola", start: 0, end: 0.5, confidence: 0.99 }]);

mock.module("@cgaravitoq/audio", () => ({
  getAudioDurationSeconds: mock(async () => 0.5),
  getSTTProvider: mock(() => ({ transcribe })),
  getTTSProvider: mock(() => ({ synthesize })),
}));

const { generateAudioTool } = await import("../generate-audio");

const text = (result: Awaited<ReturnType<typeof generateAudioTool.handler>>) => {
  const content = result.content[0];
  return JSON.parse(content?.type === "text" ? content.text : "{}");
};

describe("generate_audio", () => {
  let outputDir: string;

  beforeEach(async () => {
    synthesize.mockClear();
    transcribe.mockClear();
    outputDir = await mkdtemp(join(tmpdir(), "mcp-audio-test-"));
    Bun.env.MCP_OUTPUT_DIR = outputDir;
  });

  it("writes voice.mp3 and captions.json to the local output dir", async () => {
    const result = await generateAudioTool.handler({
      text: "Hola mundo",
      lang: "es",
      voice: "voice-id",
      stability: 0.4,
    });

    expect(result.isError).toBeUndefined();
    expect(synthesize).toHaveBeenCalledWith("Hola mundo", {
      lang: "es",
      voiceId: "voice-id",
      stability: 0.4,
      similarityBoost: undefined,
      style: undefined,
      speed: undefined,
    });

    const body = text(result);
    expect(body.audioPath).toStartWith(outputDir);
    expect(body.captionsPath).toStartWith(outputDir);
    expect(await Bun.file(body.audioPath).text()).toBe("audio-bytes");
    expect(await Bun.file(body.captionsPath).json()).toEqual({
      words: [{ text: "Hola", start: 0, end: 0.5, confidence: 0.99 }],
    });
    expect(body.durationSec).toBe(0.5);
    expect(body.charsUsed).toBe(10);

    await rm(outputDir, { recursive: true, force: true });
  });
});
