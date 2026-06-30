import { describe, expect, it } from "vitest";
import { DEFAULT_PACING, injectElevenV3Pauses, injectPauses, MAX_BREAK_MS } from "../script-pacing";

describe("injectPauses", () => {
  it("returns the input unchanged when the script already contains a <break> tag", () => {
    const text = `Hola. <break time="2s" /> Mundo.`;
    const result = injectPauses(text);
    expect(result.text).toBe(text);
    expect(result.injected).toBe(0);
  });

  it("injects a sentence-end break after `.`, `!`, `?` followed by whitespace", () => {
    const result = injectPauses("Uno. Dos! Tres? Cuatro.");
    expect(result.injected).toBe(3);
    expect(result.syntax).toBe("ssml-break");
    expect(result.text).toMatch(/Uno\. <break time="0\.40s" \/> Dos! <break/);
  });

  it("does NOT split decimals (period followed by a digit, no whitespace)", () => {
    const result = injectPauses("OpenAI 4.5 sube a 10000 RPS. Y luego cae.");
    expect(result.injected).toBe(1);
    expect(result.text).toContain("4.5 sube");
  });

  it("injects a clause break after `:`, `;`, `—` followed by whitespace", () => {
    const result = injectPauses("Capa uno: rate limiting; foo — bar.", {
      sentenceMs: 0,
    });
    expect(result.injected).toBe(3);
    expect(result.text).toContain('uno: <break time="0.25s" />');
    expect(result.text).toContain('limiting; <break time="0.25s" />');
    expect(result.text).toContain('foo — <break time="0.25s" />');
  });

  it("respects custom sentenceMs / clauseMs", () => {
    const result = injectPauses("Uno: dos. Tres.", {
      sentenceMs: 600,
      clauseMs: 150,
    });
    expect(result.text).toContain('Uno: <break time="0.15s" />');
    expect(result.text).toContain('dos. <break time="0.60s" />');
  });

  it("disables sentence injection when sentenceMs=0", () => {
    const result = injectPauses("Uno. Dos.", { sentenceMs: 0 });
    expect(result.injected).toBe(0);
    expect(result.text).toBe("Uno. Dos.");
  });

  it("disables clause injection when clauseMs=0", () => {
    const result = injectPauses("Uno: dos. Tres.", { clauseMs: 0 });
    expect(result.injected).toBe(1);
  });

  it("clamps break durations to [0, MAX_BREAK_MS]", () => {
    const huge = injectPauses("Uno. Dos.", { sentenceMs: 9999 });
    expect(huge.text).toContain(`<break time="${(MAX_BREAK_MS / 1000).toFixed(2)}s" />`);

    const negative = injectPauses("Uno. Dos.", { sentenceMs: -100 });
    expect(negative.injected).toBe(0);
  });

  it("handles multi-paragraph text (newlines count as whitespace)", () => {
    const text = "Frase uno.\n\nFrase dos.\n";
    const result = injectPauses(text);
    expect(result.injected).toBe(2);
  });

  it("DEFAULT_PACING is sentence=400ms, clause=250ms", () => {
    expect(DEFAULT_PACING).toEqual({ sentenceMs: 400, clauseMs: 250 });
  });
});

describe("injectElevenV3Pauses", () => {
  it("injects Eleven v3 pause tags instead of SSML breaks", () => {
    const result = injectElevenV3Pauses("Uno. Dos: tres.", {
      sentenceMs: 400,
      clauseMs: 250,
    });

    expect(result.text).toContain("Uno. [short pause] Dos: [short pause] tres.");
    expect(result.text).not.toContain("<break");
    expect(result.injected).toBe(2);
    expect(result.syntax).toBe("eleven-v3-tags");
  });

  it("does not inject v3 pauses into hand-authored pause-tag scripts", () => {
    const text = "Uno. [short pause] Dos.";
    expect(injectElevenV3Pauses(text)).toEqual({
      text,
      injected: 0,
      syntax: "eleven-v3-tags",
    });
  });
});
