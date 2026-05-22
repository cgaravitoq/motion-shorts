import { describe, expect, it } from "bun:test";
import { extractInlineScripts, lintHtml, stripComments } from "./lint-seek-safe.mjs";

const wrap = (script) => `<!doctype html>
<html><body>
<div data-composition-id="test" data-duration="5" data-width="1080" data-height="1920"></div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script type="application/json" id="captions-data">[]</script>
<script>
${script}
window.__timelines = window.__timelines || {};
window.__timelines["test"] = tl;
</script>
</body></html>`;

const validBaseline = `
const tl = gsap.timeline({ paused: true });
tl.set("#a", { autoAlpha: 0 }, 0);
tl.to("#a", { autoAlpha: 1, duration: 0.5, ease: "power2.out", onUpdate: () => {} }, 0);
`;

describe("extractInlineScripts", () => {
  it("returns only inline blocks, skipping external and application/json scripts", () => {
    const html = wrap(validBaseline);
    const blocks = extractInlineScripts(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toContain("gsap.timeline");
  });
});

describe("stripComments", () => {
  it("blanks out // line comments and /* block comments */", () => {
    const src = `const a = 1; // onStart: bad
/* onComplete: also bad */
const b = 2;`;
    const stripped = stripComments(src);
    expect(stripped).not.toContain("onStart");
    expect(stripped).not.toContain("onComplete");
    expect(stripped).toContain("const a = 1");
    expect(stripped).toContain("const b = 2");
  });

  it("preserves string literals so they keep matching when intentionally suspicious", () => {
    const src = `const s = "// not a comment";`;
    expect(stripComments(src)).toBe(src);
  });
});

describe("lintHtml — seek-safe rules", () => {
  it("passes a clean baseline timeline with onUpdate and tl.set", () => {
    const result = lintHtml(wrap(validBaseline));
    expect(result).toEqual([]);
  });

  it("flags onStart as an error", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, duration: 0.5, onStart: () => console.log("nope") }, 0);
`),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ ruleId: "seek-callback", severity: "error" });
  });

  it("flags onComplete as an error", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, duration: 0.5, onComplete: () => {} }, 0);
`),
    );
    expect(result.some((v) => v.ruleId === "seek-callback" && /onComplete/.test(v.snippet))).toBe(
      true,
    );
  });

  it("flags onRepeat as an error", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, repeat: 2, onRepeat: () => {} }, 0);
`),
    );
    expect(result.some((v) => v.ruleId === "seek-callback")).toBe(true);
  });

  it("does NOT flag onUpdate (seek-safe)", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, duration: 0.5, onUpdate: () => {} }, 0);
`),
    );
    expect(result).toEqual([]);
  });

  it("flags tl.call() as an error", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.call(() => console.log("never fires during seek"), null, 1.5);
`),
    );
    expect(result.some((v) => v.ruleId === "tl-call")).toBe(true);
  });

  it("flags repeat: -1 as an error", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, duration: 0.5, repeat: -1 }, 0);
`),
    );
    expect(result.some((v) => v.ruleId === "repeat-infinite")).toBe(true);
  });

  it("flags repeat: <n> with n > 0 as a warning, not an error", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, duration: 0.5, repeat: 3 }, 0);
`),
    );
    const repeat = result.find((v) => v.ruleId === "repeat-finite");
    expect(repeat).toBeDefined();
    expect(repeat.severity).toBe("warning");
  });

  it("does NOT flag repeat: 0", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
tl.to("#a", { autoAlpha: 1, duration: 0.5, repeat: 0 }, 0);
`),
    );
    expect(result).toEqual([]);
  });

  it("flags setTimeout / setInterval / requestAnimationFrame", () => {
    const result = lintHtml(
      wrap(`
const tl = gsap.timeline({ paused: true });
setTimeout(() => tl.play(), 100);
setInterval(() => {}, 250);
requestAnimationFrame(() => {});
`),
    );
    const async = result.filter((v) => v.ruleId === "async-callback");
    expect(async).toHaveLength(3);
    expect(async.every((v) => v.severity === "error")).toBe(true);
  });

  it("flags a missing paused: true on gsap.timeline()", () => {
    const html = `<!doctype html><html><body>
<script>
const tl = gsap.timeline({});
tl.set("#a", { autoAlpha: 0 }, 0);
window.__timelines = window.__timelines || {};
window.__timelines["test"] = tl;
</script>
</body></html>`;
    const result = lintHtml(html);
    expect(result.some((v) => v.ruleId === "missing-paused")).toBe(true);
  });

  it("flags a missing window.__timelines registry assignment", () => {
    const html = `<!doctype html><html><body>
<script>
const tl = gsap.timeline({ paused: true });
tl.set("#a", { autoAlpha: 0 }, 0);
</script>
</body></html>`;
    const result = lintHtml(html);
    expect(result.some((v) => v.ruleId === "missing-registry")).toBe(true);
  });

  it("accepts variable-keyed registration (e.g. window.__timelines[templateCompositionId] = tl)", () => {
    const html = `<!doctype html><html><body>
<script>
const tl = gsap.timeline({ paused: true });
tl.set("#a", { autoAlpha: 0 }, 0);
const templateCompositionId = "demo";
window.__timelines = window.__timelines || {};
window.__timelines[templateCompositionId] = tl;
</script>
</body></html>`;
    const result = lintHtml(html);
    expect(result).toEqual([]);
  });

  it("does NOT flag patterns living inside // line comments or /* block comments */", () => {
    const html = wrap(`
const tl = gsap.timeline({ paused: true });
// onComplete: legacy note, kept for context
/* setTimeout(() => {}, 0); was here */
tl.set("#a", { autoAlpha: 1 }, 0);
`);
    expect(lintHtml(html)).toEqual([]);
  });

  it("reports violations with file-relative line numbers", () => {
    const html = `<!doctype html>
<html><body>
<script>
const tl = gsap.timeline({ paused: true });
tl.to("#a", { duration: 0.5, onStart: () => {} }, 0);
window.__timelines = window.__timelines || {};
window.__timelines["x"] = tl;
</script>
</body></html>`;
    const result = lintHtml(html);
    const v = result.find((x) => x.ruleId === "seek-callback");
    expect(v).toBeDefined();
    expect(v.line).toBe(5);
  });
});
