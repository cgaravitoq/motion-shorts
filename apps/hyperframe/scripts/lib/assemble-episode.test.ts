import { describe, expect, it } from "bun:test";
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
    {
      id: "steps",
      type: "flow",
      duration: 8,
      slots: { steps: [{ label: "uno" }, { label: "dos" }] },
    },
    { id: "outro", type: "outro", duration: 5, slots: {} },
  ],
});

describe("assembleEpisode", () => {
  it("portrait: 1080x1920 stage without data-format", () => {
    const { html } = assembleEpisode(realSpec(), { hubRoot });
    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
    const stageTag = html.match(/<div id="ep-stage"[^>]*>/)?.[0] ?? "";
    expect(stageTag).not.toContain("data-format=");
    expect(html).toContain("--safe-top: 200px");
  });

  it("is deterministic: identical spec => identical bytes", () => {
    const a = assembleEpisode(realSpec(), { hubRoot });
    const b = assembleEpisode(realSpec(), { hubRoot });
    expect(a.html).toBe(b.html);
  });

  it("portrait karaoke keeps 28/5", () => {
    const { html } = assembleEpisode(realSpec(), { hubRoot });
    expect(html).toContain("{ maxChars: 28, maxTokens: 5 }");
  });
});

describe("outro brand slots", () => {
  it("defaults to the cgaravitoq lockup when the slots are omitted", () => {
    const { html } = assembleEpisode(realSpec(), { hubRoot });
    expect(html).toContain('<h1 class="brand-outro__name">cgaravitoq</h1>');
    expect(html).toContain('<p class="brand-outro__tagline">AI Engineering</p>');
    expect(html).toContain("cgaravitoq logo");
  });

  it("renders a custom wordmark/tagline from the spec", () => {
    const spec = realSpec();
    const branded = {
      ...spec,
      scenes: spec.scenes.map((s) =>
        s.type === "outro" ? { ...s, slots: { wordmark: "Acme Co", tagline: "Ship faster" } } : s,
      ),
    };
    const { html } = assembleEpisode(branded, { hubRoot });
    expect(html).toContain('<h1 class="brand-outro__name">Acme Co</h1>');
    expect(html).toContain('<p class="brand-outro__tagline">Ship faster</p>');
    expect(html).not.toContain("cgaravitoq</h1>");
  });
});
