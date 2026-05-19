import type { InworldTTS } from "@inworld/tts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InworldTTSProvider } from "../inworld";

type InworldTTSClient = ReturnType<typeof InworldTTS>;

const mockEnv = vi.hoisted(() => ({
  INWORLD_API_KEY: undefined as string | undefined,
  INWORLD_VOICE_ID_ES: undefined as string | undefined,
  INWORLD_VOICE_ID_EN: undefined as string | undefined,
  INWORLD_TTS_MODEL: "inworld-tts-2",
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

const stubClient = (bytes: number[] = [1, 2, 3]) => {
  const generate = vi.fn().mockResolvedValue(new Uint8Array(bytes));
  const client = { generate } as unknown as InworldTTSClient;
  return { client, generate };
};

describe("InworldTTSProvider", () => {
  beforeEach(() => {
    mockEnv.INWORLD_API_KEY = undefined;
    mockEnv.INWORLD_VOICE_ID_ES = "inworld-voice-es-fixture";
    mockEnv.INWORLD_VOICE_ID_EN = "inworld-voice-en-fixture";
    mockEnv.INWORLD_TTS_MODEL = "inworld-tts-2";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a clear error when INWORLD_API_KEY is missing and no client is injected", () => {
    expect(() => new InworldTTSProvider()).toThrow(/INWORLD_API_KEY missing/);
  });

  it("requires a voice ID via env or opts.voiceId", async () => {
    mockEnv.INWORLD_VOICE_ID_EN = undefined;
    const { client } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("hello", { lang: "en" })).rejects.toThrow(
      /No Inworld voice ID configured for lang="en"/,
    );
  });

  it("resolves the Spanish voice ID from env", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es" });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      voice: "inworld-voice-es-fixture",
      language: "es-ES",
    });
  });

  it("honours opts.voiceId over env defaults", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hi", { lang: "en", voiceId: "custom-inworld-voice" });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ voice: "custom-inworld-voice" });
  });

  it("maps speed to speakingRate", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es", speed: 1.2 });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ speakingRate: 1.2 });
  });

  it("omits speakingRate when speed is not provided", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es" });
    expect(generate.mock.calls[0]?.[0]).not.toHaveProperty("speakingRate");
  });

  it("accepts Inworld speed boundaries", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es", speed: 0.5 });
    await provider.synthesize("hola otra vez", { lang: "es", speed: 1.5 });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ speakingRate: 0.5 });
    expect(generate.mock.calls[1]?.[0]).toMatchObject({ speakingRate: 1.5 });
  });

  it("throws when speed is outside Inworld's supported range", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("hola", { lang: "es", speed: Number.NaN })).rejects.toThrow(
      /speed=NaN outside Inworld's supported range \[0.5, 1.5\]/,
    );
    await expect(provider.synthesize("hola", { lang: "es", speed: 0.49 })).rejects.toThrow(
      /speed=0.49 outside Inworld's supported range \[0.5, 1.5\]/,
    );
    await expect(provider.synthesize("hola", { lang: "es", speed: 1.51 })).rejects.toThrow(
      /speed=1.51 outside Inworld's supported range \[0.5, 1.5\]/,
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("aborts before calling the SDK when text exceeds the cost guardrail", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("x".repeat(5001), { lang: "es" })).rejects.toThrow(
      /exceeds soft cap/,
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects empty text", async () => {
    const { client } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await expect(provider.synthesize("   ", { lang: "es" })).rejects.toThrow(/text is empty/);
  });

  it("logs one warning when ElevenLabs-only options are passed", async () => {
    vi.resetModules();
    const { InworldTTSProvider: FreshInworldTTSProvider } = await import("../inworld");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client } = stubClient();
    const provider = new FreshInworldTTSProvider({ apiKey: "test", client });

    await provider.synthesize("hola", { lang: "es", stability: 0.6 });
    await provider.synthesize("hola otra vez", { lang: "es", similarityBoost: 0.85, style: 0.1 });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[inworld-tts] stability/similarityBoost/style are ElevenLabs-only and ignored on Inworld.",
    );
  });

  it("wraps the SDK Uint8Array as a Buffer", async () => {
    const { client } = stubClient([0x49, 0x44, 0x33]);
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    const buffer = await provider.synthesize("hola", { lang: "es" });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString("latin1", 0, 3)).toBe("ID3");
  });

  it("uses the default model and honours the env override", async () => {
    const { client, generate } = stubClient();
    const provider = new InworldTTSProvider({ apiKey: "test", client });
    await provider.synthesize("hola", { lang: "es" });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ model: "inworld-tts-2" });

    mockEnv.INWORLD_TTS_MODEL = "inworld-tts-custom";
    await provider.synthesize("hola otra vez", { lang: "es" });
    expect(generate.mock.calls[1]?.[0]).toMatchObject({ model: "inworld-tts-custom" });
  });
});
