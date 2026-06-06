import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { assembleEpisode } from "./assemble-episode";

const hubRoot = path.resolve(import.meta.dir, "../..");
// Inline fixture against the TRACKED scene-type manifests (templates/scenes):
// episodes under src/episodes are local working copies, never in git/CI.
const realSpec = () => ({
  slug: "contract-fixture",
  lang: "es",
  scenes: [
    { id: "hook", type: "hook", duration: 6, slots: { title: "Hola <strong>mundo</strong>" } },
    { id: "steps", type: "flow", duration: 8, slots: { steps: [{ label: "uno" }, { label: "dos" }] } },
    { id: "outro", type: "outro", duration: 5, slots: {} },
  ],
});

describe("assembleEpisode formats", () => {
  it("portrait default: 1080x1920 stage without data-format, no desktop CSS", () => {
    const { html } = assembleEpisode(realSpec(), { hubRoot });
    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
    const stageTag = html.match(/<div id="ep-stage"[^>]*>/)?.[0] ?? "";
    expect(stageTag).not.toContain("data-format=");
    expect(html).not.toContain("(desktop)");
    expect(html).toContain("--safe-top: 200px");
    expect(html).not.toContain("--safe-top: 108px");
  });

  it("desktop: 1920x1080 stage with data-format and desktop CSS appended", () => {
    const { html } = assembleEpisode(realSpec(), { hubRoot, format: "desktop" });
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('data-format="desktop-1080p"');
    expect(html).toContain("--safe-top: 108px");
    expect(html).toContain("/* scene-type: flow@1 (desktop) */");
  });

  it("desktop forces 1920x1080 even when the spec declares portrait dimensions", () => {
    const { html } = assembleEpisode({ ...realSpec(), width: 1080, height: 1920 }, { hubRoot, format: "desktop" });
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
  });

  it("is deterministic per format: identical spec => identical bytes", () => {
    const a = assembleEpisode(realSpec(), { hubRoot, format: "desktop" });
    const b = assembleEpisode(realSpec(), { hubRoot, format: "desktop" });
    expect(a.html).toBe(b.html);
  });

  it("desktop redeclares every shell.css :root token (formats never share values)", () => {
    const shellCss = fs.readFileSync(path.join(hubRoot, "templates/_shell/shell.css"), "utf8");
    const desktopCss = fs.readFileSync(path.join(hubRoot, "templates/_shell/shell.desktop.css"), "utf8");
    const rootBlock = shellCss.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const desktopBlock = desktopCss.match(/#ep-stage\[data-format="desktop-1080p"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const tokens = [...rootBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(tokens.length).toBeGreaterThan(0);
    // Brand/source colors and accents come from the spec palette, identical in
    // both formats — only the spacing/type/watermark system is per-format.
    const shared = new Set(["--ink", "--paper", "--muted", "--line", "--panel", "--source-accent", "--source-accent-2", "--accent", "--accent-2", "--title-line-height"]);
    const missing = tokens.filter((t) => !shared.has(t) && !desktopBlock.includes(`${t}:`));
    expect(missing).toEqual([]);
  });

  it("desktop karaoke widens to the 16:9 caption band; portrait keeps 28/5", () => {
    const portrait = assembleEpisode(realSpec(), { hubRoot });
    const desktop = assembleEpisode(realSpec(), { hubRoot, format: "desktop" });
    expect(portrait.html).toContain("{ maxChars: 28, maxTokens: 5 }");
    expect(desktop.html).toContain("{ maxChars: 40, maxTokens: 7 }");
  });
});
