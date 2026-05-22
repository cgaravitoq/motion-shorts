import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const helpersPath = path.resolve(import.meta.dirname, "../timeline-helpers.js");
const helpersSource = readFileSync(helpersPath, "utf8");

// Loads timeline-helpers.js inside a vm context with stubs for the DOM globals
// it touches. Returns the `__hf` namespace plus instrumentation hooks.
const loadHelpers = ({ scrollWidthFor }) => {
  const warnings = [];
  const fakeWindow = {
    gsap: { timeline: () => ({}) },
  };
  const context = {
    window: fakeWindow,
    document: {},
    getComputedStyle: () => ({ fontSize: "48px", fontFamily: "sans", fontWeight: "400" }),
    console: { ...console, warn: (...args) => warnings.push(args.join(" ")), error: console.error },
  };
  vm.createContext(context);
  // Mirror browser semantics: `global` is the window object in the IIFE.
  context.global = fakeWindow;
  vm.runInContext(helpersSource, context);
  return { hf: fakeWindow.__hf, warnings, scrollWidthFor };
};

const makeElement = ({ text, scrollWidth }) => {
  const el = {
    id: "fit-target",
    className: "",
    tagName: "DIV",
    textContent: text,
    style: { fontSize: "48px" },
    parentElement: { clientWidth: 400 },
    clientWidth: 400,
  };
  Object.defineProperty(el, "scrollWidth", {
    get: () => scrollWidth(el),
  });
  return el;
};

describe("fitText", () => {
  it("caps the shrink loop at 100 iterations on impossible text without hanging", () => {
    // Element scrollWidth never satisfies the container — naive loop would
    // iterate until size <= minFontSize, here forced unsatisfiable.
    const el = makeElement({
      text: "x".repeat(10_000),
      scrollWidth: () => 9_999_999,
    });
    const { hf, warnings } = loadHelpers({});

    const started = Date.now();
    hf.fitText(el, { baseFontSize: 1000, minFontSize: 1, maxWidth: 10 });
    const elapsed = Date.now() - started;

    // Cap is 100; size starts at 1000, so final size must be >= 900 — proves
    // the loop stopped at the cap, not at minFontSize.
    const finalSize = Number.parseFloat(el.style.fontSize);
    expect(finalSize).toBeGreaterThanOrEqual(900);
    expect(finalSize).toBeLessThanOrEqual(1000);
    expect(elapsed).toBeLessThan(1000);
    expect(warnings.some((w) => w.includes("fitText") && w.includes("#fit-target"))).toBe(true);
  });

  it("returns normally when text fits within maxWidth", () => {
    const el = makeElement({
      text: "short",
      scrollWidth: () => 50,
    });
    const { hf, warnings } = loadHelpers({});

    hf.fitText(el, { baseFontSize: 48, minFontSize: 12, maxWidth: 400 });

    expect(el.style.fontSize).toBe("48px");
    expect(warnings).toHaveLength(0);
  });
});
