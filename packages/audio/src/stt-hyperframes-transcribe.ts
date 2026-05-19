import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { HyperframesCaption, STTProvider, TranscribeOptions } from "./stt-types";

/**
 * Offline STT provider that shells out to `npx hyperframes transcribe`, which
 * wraps whisper.cpp under the hood and emits word-level JSON.
 *
 * Tradeoff vs Scribe: free + offline, lower accuracy + slower. Use as the
 * fallback when ELEVENLABS_API_KEY isn't set or when audio exceeds the Scribe
 * 5-minute soft cap.
 *
 * Process invocation uses spawnSync with an argument array (not shell
 * template strings) so paths with quotes, semicolons or `$()` are safe.
 */

interface HyperframesTranscriptToken {
  text?: string;
  word?: string;
  start: number;
  end: number;
}

const stripExt = (p: string): string => {
  const ext = path.extname(p);
  return ext ? p.slice(0, -ext.length) : p;
};

// Memoize the binary probe per process — `npx hyperframes --version` shells
// out to npm/npx resolution which is slow (~200-500ms). One probe per CLI
// invocation is enough; long-running consumers should restart to re-probe.
let binaryChecked = false;
const ensureBinaryAvailable = (): void => {
  if (binaryChecked) return;
  const probe = spawnSync("npx", ["--yes", "hyperframes", "--version"], {
    encoding: "utf8",
  });
  if (probe.error) {
    throw new Error(
      `HyperframesTranscribeProvider: failed to invoke npx (${probe.error.message}). ` +
        "Install Node ≥22 and run `npx hyperframes init` once to seed the cache.",
    );
  }
  if (probe.status !== 0) {
    const stderr = (probe.stderr || "").trim();
    throw new Error(
      `HyperframesTranscribeProvider: \`npx hyperframes --version\` exited ${probe.status}` +
        `${stderr ? `: ${stderr}` : ""}`,
    );
  }
  binaryChecked = true;
};

const parseTranscript = (raw: string): HyperframesCaption[] => {
  const data = JSON.parse(raw);
  // Hyperframes transcribe emits either `[{text, start, end}]` directly or
  // `{ words: [...] }` depending on input format. Handle both.
  const tokens: HyperframesTranscriptToken[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.words)
      ? data.words
      : [];
  if (tokens.length === 0) {
    throw new Error(
      "HyperframesTranscribeProvider: transcript JSON is empty or unrecognised shape",
    );
  }
  return tokens
    .filter(
      (t) =>
        Number.isFinite(t.start) && Number.isFinite(t.end) && Boolean((t.text ?? t.word ?? "").trim()),
    )
    .map((t, idx) => {
      const rawText = (t.text ?? t.word ?? "").trim();
      const text = idx === 0 || rawText.startsWith(" ") ? rawText : ` ${rawText}`;
      return {
        text,
        start: Number(t.start.toFixed(3)),
        end: Number(t.end.toFixed(3)),
      };
    });
};

export class HyperframesTranscribeProvider implements STTProvider {
  readonly name = "hyperframes-transcribe";

  async transcribe(audioPath: string, opts: TranscribeOptions): Promise<HyperframesCaption[]> {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`HyperframesTranscribeProvider.transcribe: audio not found at ${audioPath}`);
    }
    ensureBinaryAvailable();

    const outJson = `${stripExt(audioPath)}.transcript.json`;
    const args = [
      "--yes",
      "hyperframes",
      "transcribe",
      audioPath,
      "--language",
      opts.lang,
      "--output",
      outJson,
      "--json",
    ];
    console.log(`[hyperframes-transcribe] running: npx ${args.join(" ")}`);
    const result = spawnSync("npx", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (result.error) {
      throw new Error(
        `HyperframesTranscribeProvider: spawn failed (${result.error.message})`,
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `HyperframesTranscribeProvider: \`npx hyperframes transcribe\` exited ${result.status}`,
      );
    }

    if (!fs.existsSync(outJson)) {
      throw new Error(
        `HyperframesTranscribeProvider: expected ${outJson} to be written but it is missing`,
      );
    }
    const raw = fs.readFileSync(outJson, "utf8");
    return parseTranscript(raw);
  }
}
