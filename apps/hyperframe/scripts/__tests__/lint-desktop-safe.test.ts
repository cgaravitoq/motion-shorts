import { describe, expect, it } from "bun:test";
import { lintDesktopHtml } from "../lint-desktop-safe";

const wrap = (stageAttrs: string, body: string) => `<!doctype html>
<html><body>
<div data-composition-id="test"${stageAttrs}>
${body}
</div>
</body></html>`;

const validStage =
  ' data-format="desktop-1080p" data-width="1920" data-height="1080" data-fps="30" data-duration="5"';

describe("lintDesktopHtml — stage dimensions", () => {
  it("passes a clean 1920x1080 stage with no critical elements", () => {
    expect(lintDesktopHtml(wrap(validStage, ""))).toEqual([]);
  });

  it("passes a clean stage at 60 fps", () => {
    const v = lintDesktopHtml(
      wrap(
        ' data-format="desktop-1080p" data-width="1920" data-height="1080" data-fps="60" data-duration="5"',
        "",
      ),
    );
    expect(v).toEqual([]);
  });

  it("flags a stage at 24 fps", () => {
    const v = lintDesktopHtml(
      wrap(
        ' data-format="desktop-1080p" data-width="1920" data-height="1080" data-fps="24" data-duration="5"',
        "",
      ),
    );
    expect(v.some((x) => x.ruleId === "stage-dimensions" && /30, 60/.test(x.message))).toBe(true);
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
    expect(v[0]?.ruleId).toBe("stage-dimensions");
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
      wrap(validStage, '<h1 class="headline" data-critical="true">No inline coords</h1>'),
    );
    expect(v).toEqual([]);
  });
});

describe("lintDesktopHtml — action-safe inset", () => {
  it("passes a tracked element placed inside action-safe", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<div id="panel" data-track-index="5" style="position:absolute; left:120px; top:80px; width:400px; height:200px;">Panel</div>',
      ),
    );
    expect(v).toEqual([]);
  });

  it("warns when a tracked element is outside action-safe", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<div id="panel" data-track-index="5" style="position:absolute; left:20px; top:80px; width:400px; height:200px;">Panel</div>',
      ),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ruleId: "action-safe-inset", severity: "warning" });
  });

  it("skips ambiguous translate values instead of treating them as zero", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<div id="panel" data-track-index="5" style="position:absolute; left:120px; top:80px; width:400px; height:200px; transform:translateX(var(--shift));">Panel</div>',
      ),
    );
    expect(v).toEqual([]);
  });
});

describe("lintDesktopHtml — lower-third collision", () => {
  it("passes tracked text above the lower-third strip", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h2 id="headline" class="headline" data-track-index="5" style="position:absolute; left:200px; right:200px; bottom:320px; font-size:64px;">Safe headline</h2>',
      ),
    );
    expect(v).toEqual([]);
  });

  it("warns when tracked text sits in the lower-third strip", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<p id="dek" class="subcopy" data-track-index="5" style="position:absolute; left:200px; right:200px; bottom:100px; font-size:32px;">Too low</p>',
      ),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ruleId: "lower-third-collision", severity: "warning" });
  });

  it("warns when tracked text reaches the lower-third strip via top and height", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h2 id="headline" class="headline" data-track-index="5" style="position:absolute; top:900px; left:200px; height:200px; font-size:48px;">Hidden in lower third</h2>',
      ),
    );
    expect(v.some((x) => x.ruleId === "lower-third-collision" && x.severity === "warning")).toBe(
      true,
    );
  });
});

describe("lintDesktopHtml — desktop font minimum", () => {
  it("passes tracked text at desktop-readable sizes", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h1 id="hero" class="headline" data-track-index="5" style="position:absolute; left:200px; top:120px; font-size:64px;">Readable</h1><p id="copy" class="copy" data-track-index="6" style="position:absolute; left:200px; top:260px; font-size:28px;">Readable body</p>',
      ),
    );
    expect(v).toEqual([]);
  });

  it("errors when tracked text is below desktop-readable sizes", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<h1 id="hero" class="headline" data-track-index="5" style="position:absolute; left:200px; top:120px; font-size:40px;">Small headline</h1>',
      ),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ruleId: "desktop-font-minimum", severity: "error" });
  });

  it("errors when a compound selector sets a too-small headline font size", () => {
    const v = lintDesktopHtml(
      wrap(
        validStage,
        '<style>h1.headline { font-size: 40px; }</style><h1 id="hero" class="headline" data-track-index="5" style="position:absolute; left:200px; top:120px;">Small headline</h1>',
      ),
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ruleId: "desktop-font-minimum", severity: "error" });
  });
});
