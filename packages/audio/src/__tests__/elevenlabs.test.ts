import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsTTSProvider } from "../elevenlabs";

const mockEnv = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: undefined as string | undefined,
  ELEVENLABS_MODEL_ID: undefined as string | undefined,
  ELEVENLABS_SCRIBE_MODEL: undefined as string | undefined,
  ELEVENLABS_VOICE_ID_ES: undefined as string | undefined,
  ELEVENLABS_VOICE_ID_EN: undefined as string | undefined,
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

const makeStream = (bytes: number[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });

const stubClient = (stream: ReadableStream<Uint8Array>) => {
  const convert = vi.fn().mockResolvedValue(stream);
  const client = { textToSpeech: { convert } } as unknown as ElevenLabsClient;
  return { client, convert };
};

describe("ElevenLabsTTSProvider", () => {
  beforeEach(() => {
    mockEnv.ELEVENLABS_API_KEY = undefined;
    mockEnv.ELEVENLABS_MODEL_ID = undefined;
    mockEnv.ELEVENLABS_VOICE_ID_ES = "voice-es-fixture";
    mockEnv.ELEVENLABS_VOICE_ID_EN = "voice-en-fixture";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a clear error when ELEVENLABS_API_KEY is missing and no client is injected", () => {
    expect(() => new ElevenLabsTTSProvider()).toThrow(/ELEVENLABS_API_KEY missing/);
  });

  it("synthesize() returns a Buffer with the bytes streamed from the SDK", async () => {
    const { client, convert } = stubClient(makeStream([0x49, 0x44, 0x33]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });

    const buffer = await provider.synthesize("hola mundo", { lang: "es" });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(3);
    expect(buffer.toString("latin1", 0, 3)).toBe("ID3");
    expect(convert).toHaveBeenCalledOnce();
    const [voiceId, request] = convert.mock.calls[0] ?? [];
    expect(voiceId).toBe("voice-es-fixture");
    expect(request).toMatchObject({
      text: "hola mundo",
      languageCode: "es",
      modelId: "eleven_v3",
      outputFormat: "mp3_44100_128",
    });
  });

  it("aborts before calling the SDK when text exceeds the cost guardrail", async () => {
    const { client, convert } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });

    await expect(provider.synthesize("x".repeat(5001), { lang: "es" })).rejects.toThrow(
      /exceeds soft cap/,
    );
    expect(convert).not.toHaveBeenCalled();
  });

  it("rejects empty text", async () => {
    const { client } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("   ", { lang: "es" })).rejects.toThrow(/text is empty/);
  });

  it("requires a voice ID via env or opts.voiceId", async () => {
    mockEnv.ELEVENLABS_VOICE_ID_EN = undefined;
    const { client } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("hello", { lang: "en" })).rejects.toThrow(
      /No voice ID configured for lang="en"/,
    );
  });

  it("resolveDefaults returns provider voice and model defaults", () => {
    const { client } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    expect(provider.resolveDefaults({ lang: "en" })).toEqual({
      voiceId: "voice-en-fixture",
      modelId: "eleven_v3",
    });
  });

  it("resolveDefaults honours explicit voice and forces eleven_v3", () => {
    const { client } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    expect(
      provider.resolveDefaults({ lang: "es", voice: "custom-voice-id", model: "eleven_v3" }),
    ).toEqual({
      voiceId: "custom-voice-id",
      modelId: "eleven_v3",
    });
  });

  it("honours opts.voiceId over env defaults", async () => {
    const { client, convert } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hi", { lang: "en", voiceId: "custom-voice-id" });
    expect(convert.mock.calls[0]?.[0]).toBe("custom-voice-id");
  });

  it("blocks a non-v3 ELEVENLABS_MODEL_ID (v3-only pipeline)", async () => {
    mockEnv.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
    const { client } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("hola", { lang: "es" })).rejects.toThrow(/eleven_v3-only/);
  });

  it("blocks a non-v3 per-call modelId override", async () => {
    mockEnv.ELEVENLABS_MODEL_ID = "eleven_v3";
    const { client } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await expect(
      provider.synthesize("hola", { lang: "es", modelId: "eleven_multilingual_v2" }),
    ).rejects.toThrow(/eleven_v3-only/);
  });

  it("always sends eleven_v3 as the model", async () => {
    mockEnv.ELEVENLABS_MODEL_ID = "eleven_v3";
    const { client, convert } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es" });
    const [, request] = convert.mock.calls[0] ?? [];
    expect(request).toMatchObject({ modelId: "eleven_v3" });
  });

  it("applies the narration preset (stability=0.5, similarityBoost=0.82, speed=1.04) when no tuning overrides are passed", async () => {
    const { client, convert } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es" });
    const [, request] = convert.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      voiceSettings: { stability: 0.5, similarityBoost: 0.82, speed: 1.04 },
    });
  });

  it("lets per-call tuning options override the preset", async () => {
    const { client, convert } = stubClient(makeStream([0]));
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", {
      lang: "es",
      stability: 0.35,
      similarityBoost: 0.75,
      style: 0.3,
      speed: 1.0,
    });
    const [, request] = convert.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      voiceSettings: { stability: 0.35, similarityBoost: 0.75, style: 0.3, speed: 1.0 },
    });
  });

  it("throws when the API returns an empty audio stream", async () => {
    const { client } = stubClient(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
    );
    const provider = new ElevenLabsTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("hola", { lang: "es" })).rejects.toThrow(/empty audio stream/);
  });
});
