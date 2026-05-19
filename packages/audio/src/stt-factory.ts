import { env } from "./env";
import { ElevenLabsScribeProvider } from "./stt-elevenlabs-scribe";
import { HyperframesTranscribeProvider } from "./stt-hyperframes-transcribe";
import type { STTProvider } from "./stt-types";

export type STTProviderName = "elevenlabs" | "hyperframes-transcribe";

const isKnown = (name: string): name is STTProviderName =>
  name === "elevenlabs" || name === "hyperframes-transcribe";

export const getSTTProvider = (name?: string): STTProvider => {
  // `||` (not `??`) so an empty STT_PROVIDER env entry falls back instead of
  // failing — `dotenv` and `vi.stubEnv("...", "")` both produce empty strings.
  const resolved = (name || env.STT_PROVIDER).toLowerCase();
  if (!isKnown(resolved)) {
    throw new Error(
      `Unknown STT provider "${resolved}". Expected "elevenlabs" or "hyperframes-transcribe".`,
    );
  }
  switch (resolved) {
    case "elevenlabs":
      return new ElevenLabsScribeProvider();
    case "hyperframes-transcribe":
      return new HyperframesTranscribeProvider();
  }
};
