export interface PacingOptions {
  sentenceMs?: number;
  clauseMs?: number;
}

export type PacingSyntax = "ssml-break" | "eleven-v3-tags";

export interface PacingResult {
  text: string;
  injected: number;
  syntax: PacingSyntax;
}

export const DEFAULT_PACING: Required<PacingOptions> = {
  sentenceMs: 400,
  clauseMs: 250,
};

export const MAX_BREAK_MS = 3000;

const clamp = (ms: number): number => Math.max(0, Math.min(MAX_BREAK_MS, ms));

const formatBreak = (ms: number): string => `<break time="${(ms / 1000).toFixed(2)}s" />`;

const formatV3Pause = (ms: number): string => {
  if (ms >= 1000) return "[long pause]";
  return "[short pause]";
};

export const isElevenV3Model = (modelId: string): boolean => modelId.toLowerCase() === "eleven_v3";

export const injectPauses = (text: string, opts: PacingOptions = {}): PacingResult => {
  if (/<break\b/i.test(text)) {
    return { text, injected: 0, syntax: "ssml-break" };
  }

  const sentenceMs = clamp(opts.sentenceMs ?? DEFAULT_PACING.sentenceMs);
  const clauseMs = clamp(opts.clauseMs ?? DEFAULT_PACING.clauseMs);

  let injected = 0;
  let result = text;

  if (sentenceMs > 0) {
    const tag = formatBreak(sentenceMs);
    result = result.replace(/([.!?])(?=\s)/g, (m) => {
      injected += 1;
      return `${m} ${tag}`;
    });
  }

  if (clauseMs > 0) {
    const tag = formatBreak(clauseMs);
    result = result.replace(/([:;—])(?=\s)/g, (m) => {
      injected += 1;
      return `${m} ${tag}`;
    });
  }

  return { text: result, injected, syntax: "ssml-break" };
};

export const injectElevenV3Pauses = (text: string, opts: PacingOptions = {}): PacingResult => {
  if (/<break\b/i.test(text) || /\[(?:short\s+|long\s+)?pause\]/i.test(text)) {
    return { text, injected: 0, syntax: "eleven-v3-tags" };
  }

  const sentenceMs = clamp(opts.sentenceMs ?? DEFAULT_PACING.sentenceMs);
  const clauseMs = clamp(opts.clauseMs ?? DEFAULT_PACING.clauseMs);

  let injected = 0;
  let result = text;

  if (sentenceMs > 0) {
    const tag = formatV3Pause(sentenceMs);
    result = result.replace(/([.!?])(?=\s)/g, (m) => {
      injected += 1;
      return `${m} ${tag}`;
    });
  }

  if (clauseMs > 0) {
    const tag = formatV3Pause(clauseMs);
    result = result.replace(/([:;—])(?=\s)/g, (m) => {
      injected += 1;
      return `${m} ${tag}`;
    });
  }

  return { text: result, injected, syntax: "eleven-v3-tags" };
};
