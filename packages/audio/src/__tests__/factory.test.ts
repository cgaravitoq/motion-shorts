import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsTTSProvider } from "../elevenlabs";
import { getTTSProvider } from "../factory";
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
    mockEnv.TTS_PROVIDER = "elevenlabs";
  });

  afterEach(() => {
    mockEnv.ELEVENLABS_API_KEY = undefined;
    mockEnv.INWORLD_API_KEY = undefined;
  });

  it("returns an ElevenLabsTTSProvider", () => {
    expect(getTTSProvider()).toBeInstanceOf(ElevenLabsTTSProvider);
  });

  it("returns an InworldTTSProvider", () => {
    mockEnv.TTS_PROVIDER = "inworld";
    expect(getTTSProvider()).toBeInstanceOf(InworldTTSProvider);
  });
});
