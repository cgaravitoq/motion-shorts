/**
 * Inject pause controls into a narration script before TTS.
 *
 * ElevenLabs v2/v2.5 models support SSML `<break />` tags. Eleven v3 does not;
 * it uses expressive square-bracket tags like `[short pause]` instead.
 *
 * Refs (verified 2026-05-09):
 * - help.elevenlabs.io/hc/en-us/articles/24352686926609
 * - elevenlabs.io/docs/best-practices/prompting
 */

export interface PacingOptions {
  /** ms pause after sentence-ending punctuation (`.`, `!`, `?`). Default 400. Set to 0 to disable. */
  sentenceMs?: number;
  /** ms pause after clause punctuation (`:`, `;`, `—`). Default 250. Set to 0 to disable. */
  clauseMs?: number;
}

export type PacingSyntax = "ssml-break" | "eleven-v3-tags";

/** Caller-facing selector for the tag dialect injected into the script. */
export type PauseSyntax = "ssml" | "v3";

export interface PacingResult {
  text: string;
  injected: number;
  syntax: PacingSyntax;
}

export const DEFAULT_PACING: Required<PacingOptions> = {
  sentenceMs: 400,
  clauseMs: 250,
};

/** ElevenLabs hard limit per `<break>` tag. */
export const MAX_BREAK_MS = 3000;

const clamp = (ms: number): number => Math.max(0, Math.min(MAX_BREAK_MS, ms));

const formatBreak = (ms: number): string => `<break time="${(ms / 1000).toFixed(2)}s" />`;

const formatV3Pause = (ms: number): string => {
  if (ms >= 1000) return "[long pause]";
  return "[short pause]";
};

export const isElevenV3Model = (modelId: string): boolean => modelId.toLowerCase() === "eleven_v3";

interface SyntaxSpec {
  /** `PacingSyntax` reported on the result. */
  label: PacingSyntax;
  /** Renders a pause tag for a given millisecond duration. */
  formatTag: (ms: number) => string;
  /** True when the script already carries hand-authored pause tags (idempotency). */
  alreadyTagged: (text: string) => boolean;
}

const SYNTAX_SPECS: Record<PauseSyntax, SyntaxSpec> = {
  ssml: {
    label: "ssml-break",
    formatTag: formatBreak,
    // Any existing `<break ...>` means the script is hand-authored; leave it.
    alreadyTagged: (text) => /<break\b/i.test(text),
  },
  v3: {
    label: "eleven-v3-tags",
    formatTag: formatV3Pause,
    // Manual pause tags OR SSML breaks both mark the script as hand-authored.
    alreadyTagged: (text) => /<break\b/i.test(text) || /\[(?:short\s+|long\s+)?pause\]/i.test(text),
  },
};

/**
 * Returns the script with pause tags inserted. `syntax` selects the dialect:
 * `"ssml"` injects `<break />` tags (ElevenLabs v2/v2.5); `"v3"` injects
 * `[short pause]` / `[long pause]` tags (eleven_v3, where SSML breaks are
 * ignored). Idempotent over already-tagged input — if the script already
 * contains the dialect's tags it's treated as hand-authored and returned
 * untouched.
 */
export const injectPauses = (
  text: string,
  opts: PacingOptions = {},
  syntax: PauseSyntax = "ssml",
): PacingResult => {
  const spec = SYNTAX_SPECS[syntax];
  if (spec.alreadyTagged(text)) {
    return { text, injected: 0, syntax: spec.label };
  }

  const sentenceMs = clamp(opts.sentenceMs ?? DEFAULT_PACING.sentenceMs);
  const clauseMs = clamp(opts.clauseMs ?? DEFAULT_PACING.clauseMs);

  let injected = 0;
  let result = text;

  if (sentenceMs > 0) {
    // Match `.!?` only when followed by whitespace — protects decimals like
    // "4.5" (period followed by a digit) and avoids appending a break to the
    // very last token of the script.
    const tag = spec.formatTag(sentenceMs);
    result = result.replace(/([.!?])(?=\s)/g, (m) => {
      injected += 1;
      return `${m} ${tag}`;
    });
  }

  if (clauseMs > 0) {
    const tag = spec.formatTag(clauseMs);
    result = result.replace(/([:;—])(?=\s)/g, (m) => {
      injected += 1;
      return `${m} ${tag}`;
    });
  }

  return { text: result, injected, syntax: spec.label };
};

/**
 * Eleven v3 pause-tag variant of {@link injectPauses}. Thin wrapper kept for
 * call sites that select the dialect by function rather than argument.
 */
export const injectElevenV3Pauses = (text: string, opts: PacingOptions = {}): PacingResult =>
  injectPauses(text, opts, "v3");
