import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsTTSProvider } from "../elevenlabs";
import { getTTSProvider, getTTSProviderName, resolveTTSProviderDefaults } from "../factory";
import { InworldTTSProvider } from "../inworld";

const mockEnv = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: undefined as string | undefined,
  ELEVENLABS_SCRIBE_MODEL: undefined as string | undefined,
  ELEVENLABS_VOICE_ID_ES: undefined as string | undefined,
  ELEVENLABS_VOICE_ID_EN: undefined as string | undefined,
  TTS_PROVIDER: "elevenlabs" as "elevenlabs" | "inworld",
  INWORLD_API_KEY: undefined as string | undefined,
  INWORLD_VOICE_ID_ES: undefined as string | undefined,
  INWORLD_VOICE_ID_EN: undefined as string | undefined,
  INWORLD_TTS_MODEL: "inworld-tts-2",
}));

vi.mock("../env", () => ({
  env: mockEnv,
}));

describe("getTTSProvider", () => {
  beforeEach(() => {
    mockEnv.ELEVENLABS_API_KEY = "test-key";
    mockEnv.INWORLD_API_KEY = "test-key";
    mockEnv.ELEVENLABS_VOICE_ID_ES = "elevenlabs-voice-es-fixture";
    mockEnv.ELEVENLABS_VOICE_ID_EN = "elevenlabs-voice-en-fixture";
    mockEnv.INWORLD_VOICE_ID_ES = "inworld-voice-es-fixture";
    mockEnv.INWORLD_VOICE_ID_EN = "inworld-voice-en-fixture";
    mockEnv.INWORLD_TTS_MODEL = "inworld-tts-2";
    mockEnv.TTS_PROVIDER = "elevenlabs";
  });

  afterEach(() => {
    mockEnv.ELEVENLABS_API_KEY = undefined;
    mockEnv.INWORLD_API_KEY = undefined;
    mockEnv.ELEVENLABS_VOICE_ID_ES = undefined;
    mockEnv.ELEVENLABS_VOICE_ID_EN = undefined;
    mockEnv.INWORLD_VOICE_ID_ES = undefined;
    mockEnv.INWORLD_VOICE_ID_EN = undefined;
  });

  it("returns an ElevenLabsTTSProvider", () => {
    expect(getTTSProvider()).toBeInstanceOf(ElevenLabsTTSProvider);
  });

  it("returns an InworldTTSProvider", () => {
    mockEnv.TTS_PROVIDER = "inworld";
    expect(getTTSProvider()).toBeInstanceOf(InworldTTSProvider);
  });

  it("resolves ElevenLabs defaults through the provider", () => {
    expect(getTTSProvider().resolveDefaults({ lang: "es" })).toEqual({
      voiceId: "elevenlabs-voice-es-fixture",
      modelId: "eleven_v3",
    });
  });

  it("resolves Inworld defaults through the provider", () => {
    mockEnv.TTS_PROVIDER = "inworld";
    expect(getTTSProvider().resolveDefaults({ lang: "en" })).toEqual({
      voiceId: "inworld-voice-en-fixture",
      modelId: "inworld-tts-2",
    });
  });

  it("returns the configured provider name without constructing a client", () => {
    mockEnv.ELEVENLABS_API_KEY = undefined;
    expect(getTTSProviderName()).toBe("elevenlabs");
  });

  it("resolves ElevenLabs defaults without requiring an API key", () => {
    mockEnv.ELEVENLABS_API_KEY = undefined;
    expect(resolveTTSProviderDefaults({ lang: "es" })).toEqual({
      voiceId: "elevenlabs-voice-es-fixture",
      modelId: "eleven_v3",
    });
  });

  it("resolves Inworld defaults without requiring an API key", () => {
    mockEnv.TTS_PROVIDER = "inworld";
    mockEnv.INWORLD_API_KEY = undefined;
    expect(resolveTTSProviderDefaults({ lang: "en" })).toEqual({
      voiceId: "inworld-voice-en-fixture",
      modelId: "inworld-tts-2",
    });
  });

});
