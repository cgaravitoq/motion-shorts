import fs from "node:fs";
import path from "node:path";
import { type ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "./env";
import { getAudioDurationSeconds } from "./ffprobe";
import {
  DEFAULT_MAX_AUDIO_MINUTES,
  type HyperframesCaption,
  type STTProvider,
  type TranscribeOptions,
} from "./stt-types";

type ScribeModelId = ElevenLabs.SpeechToTextConvertRequestModelId;

const DEFAULT_SCRIBE_MODEL = "scribe_v2";
const KNOWN_SCRIBE_MODELS = ["scribe_v1", "scribe_v2"] as const;
type KnownScribeModel = (typeof KNOWN_SCRIBE_MODELS)[number];

const isKnownScribeModel = (value: string): value is KnownScribeModel =>
  (KNOWN_SCRIBE_MODELS as readonly string[]).includes(value);

const resolveScribeModel = (): ScribeModelId => {
  const raw = env.ELEVENLABS_SCRIBE_MODEL?.trim();
  if (!raw) return DEFAULT_SCRIBE_MODEL as ScribeModelId;
  if (!isKnownScribeModel(raw)) {
    throw new Error(
      `ELEVENLABS_SCRIBE_MODEL="${raw}" is not a recognised Scribe model. ` +
        `Expected one of: ${KNOWN_SCRIBE_MODELS.join(", ")}.`,
    );
  }
  return raw as ScribeModelId;
};

interface ProviderOptions {
  apiKey?: string;
  client?: ElevenLabsClient;
}

interface SpeechToTextWord {
  text: string;
  start?: number;
  end?: number;
  type: string;
  logprob: number;
}

interface SpeechToTextSingleChannel {
  words: SpeechToTextWord[];
  text?: string;
  languageCode?: string;
  audioDurationSecs?: number;
}

const isSingleChannel = (response: unknown): response is SpeechToTextSingleChannel =>
  typeof response === "object" &&
  response !== null &&
  "words" in response &&
  Array.isArray((response as { words: unknown }).words);

const expConfidence = (logprob: number): number | undefined => {
  if (!Number.isFinite(logprob)) return undefined;
  const v = Math.exp(logprob);
  if (!Number.isFinite(v)) return undefined;
  return Math.min(1, Math.max(0, v));
};

const mapWordsToCaptions = (words: SpeechToTextWord[]): HyperframesCaption[] => {
  const captions: HyperframesCaption[] = [];
  let firstWord = true;
  for (const w of words) {
    if (w.type !== "word") continue;
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
    const text = firstWord || w.text.startsWith(" ") ? w.text : ` ${w.text}`;
    firstWord = false;
    const caption: HyperframesCaption = {
      text,
      start: Number((w.start as number).toFixed(3)),
      end: Number((w.end as number).toFixed(3)),
    };
    const confidence = expConfidence(w.logprob);
    if (confidence !== undefined) {
      caption.confidence = Number(confidence.toFixed(3));
    }
    captions.push(caption);
  }
  return captions;
};

export class ElevenLabsScribeProvider implements STTProvider {
  readonly name = "elevenlabs";
  private readonly client: ElevenLabsClient;

  constructor(opts: ProviderOptions = {}) {
    if (opts.client) {
      this.client = opts.client;
      return;
    }
    const apiKey = opts.apiKey ?? env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ELEVENLABS_API_KEY missing — set it in .env or pass opts.apiKey to ElevenLabsScribeProvider",
      );
    }
    this.client = new ElevenLabsClient({ apiKey });
  }

  async transcribe(audioPath: string, opts: TranscribeOptions): Promise<HyperframesCaption[]> {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`ElevenLabsScribeProvider.transcribe: audio not found at ${audioPath}`);
    }

    const cap = opts.maxMinutes ?? DEFAULT_MAX_AUDIO_MINUTES;
    const seconds = await getAudioDurationSeconds(audioPath);
    if (seconds > 0 && seconds / 60 > cap) {
      throw new Error(
        `ElevenLabsScribeProvider.transcribe: audio is ${(seconds / 60).toFixed(1)} min, exceeds soft cap (${cap} min). Refusing to burn Scribe credits.`,
      );
    }

    const modelId = resolveScribeModel();
    // The SDK's FormDataWrapper expects Buffer/Blob/stream (Uploadable.FromPath
    // crashes at runtime). Read eagerly — Scribe caps at 5 min ≈ 5 MB resident.
    const response = await this.client.speechToText.convert({
      file: {
        data: fs.readFileSync(audioPath),
        filename: path.basename(audioPath),
        contentType: "audio/mpeg",
      },
      modelId,
      languageCode: opts.lang,
      timestampsGranularity: "word",
    });

    if (!isSingleChannel(response)) {
      throw new Error(
        "ElevenLabsScribeProvider.transcribe: expected single-channel response with word timestamps; got multichannel or webhook shape.",
      );
    }

    return mapWordsToCaptions(response.words);
  }
}
