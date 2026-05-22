import { describe, expect, it } from "bun:test";
import { lintDesktopHtml } from "./lint-desktop-safe.mjs";

const wrap = (stageAttrs, body) => `<!doctype html>
<html><body>
<div data-composition-id="test"${stageAttrs}>
${body}
</div>
</body></html>`;

const validStage = ' data-format="desktop-1080p" data-width="1920" data-height="1080" data-fps="30" data-duration="5"';

describe("lintDesktopHtml — stage dimensions", () => {
  it("passes a clean 1920x1080 stage with no critical elements", () => {
    expect(lintDesktopHtml(wrap(validStage, ""))).toEqual([]);
  });

  it("flags a missing data-format attribute", () => {
    const v = lintDesktopHtml(
      wrap(' data-width="1920" data-height="1080" data-fps="30" data-duration="5"', ""),
    );
    expect(v.some((x) => x.ruleId === "stage-dimensions" && /data-format/.test(x.message))).toBe(
      true,
    );
  });

  it("flags wrong dimensions (1080x1920 instead of 1920x1080)", () => {
    const v = lintDesktopHtml(
      wrap(
        ' data-format="desktop-1080p" data-width="1080" data-height="1920" data-fps="30" data-duration="5"',
        "",
      ),
    );
    expect(v.some((x) => x.ruleId === "stage-dimensions")).toBe(true);
  });

  it("flags a missing stage element entirely", () => {
    const v = lintDesktopHtml("<!doctype html><html><body><p>nope</p></body></html>");
    expect(v).toHaveLength(1);
    expect(v[0].ruleId).toBe("stage-dimensions");
  });
});

describe("lintDesktopHtml — title-safe inset", () => {
  it("passes a critical element placed inside title-safe (left=200, top=120)", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h1 data-critical="true" style="position:absolute; left:200px; top:120px; right:200px; bottom:200px;">Title</h1>',
      ),
    );
    expect(v).toEqual([]);
  });

  it("flags a critical element pinned to left:80px (inside 192px inset)", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h1 data-critical="true" style="position:absolute; left:80px; top:300px; width:400px; height:80px;">Title</h1>',
      ),
    );
    expect(v.some((x) => x.ruleId === "title-safe-inset")).toBe(true);
  });
});

describe("lintDesktopHtml — YouTube dead zones", () => {
  it("flags a deliberate violation inside the YouTube end-screen bar (bottom:60px)", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<div data-critical="true" style="position:absolute; left:400px; bottom:60px; width:600px; height:80px;">End-screen text</div>',
      ),
    );
    expect(v.some((x) => x.ruleId === "endscreen-dead-zone")).toBe(true);
  });

  it("flags a deliberate violation inside the YouTube CTA slot (bottom-right 160x160)", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<div data-critical="true" style="position:absolute; right:40px; bottom:40px; width:80px; height:80px;">CTA</div>',
      ),
    );
    expect(v.some((x) => x.ruleId === "cta-dead-zone")).toBe(true);
  });

  it("does NOT flag critical elements safely above the dead zones (bottom:300px)", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<div data-critical="true" style="position:absolute; left:300px; right:300px; bottom:300px; height:120px;">Safe</div>',
      ),
    );
    expect(v).toEqual([]);
  });

  it("does NOT flag a critical element marked without inline coordinates (skip rule)", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h1 class="headline" data-critical="true">No inline coords</h1>',
      ),
    );
    expect(v).toEqual([]);
  });
});
