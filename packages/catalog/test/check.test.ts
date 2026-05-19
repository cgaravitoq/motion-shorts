import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";
import { checkEpisode } from "../src/check";
import { CatalogManifestSchema } from "../src/schema";

const catalogManifest = CatalogManifestSchema.parse(manifest);

const writeEpisode = (body: string) => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-check-"));
  const file = join(dir, "index.html");
  writeFileSync(file, body);
  return file;
};

const compliantHtml = (
  comment = "<!-- catalog: [brand-logo-watermark, brand-logo-outro] -->",
) => `<!doctype html>
${comment}
<html>
  <body>
    <div data-composition-id="fixture" data-duration="30">
      <div id="brand-corner" data-track-index="97">@brand</div>
      <section id="scene-setup" class="scene clip" data-start="0" data-track-index="4"></section>
      <section id="scene-brand-outro" class="scene clip" data-start="24" data-track-index="7">
        <div class="brand-outro">
          <div class="brand-outro__lockup">
            <div id="brand-aura" class="brand-outro__aura"></div>
            <svg id="brand-mark" class="brand-outro__mark"><path id="brand-piece-left" class="brand-outro__piece" d="M0 0h1" /><path id="brand-piece-top-left" class="brand-outro__piece" d="M0 0h1" /><path id="brand-piece-bridge" class="brand-outro__piece" d="M0 0h1" /><path id="brand-piece-bottom-right" class="brand-outro__piece" d="M0 0h1" /><path id="brand-piece-right" class="brand-outro__piece" d="M0 0h1" /></svg>
          </div>
          <h1 id="brand-name" class="brand-outro__name">cgaravitoq</h1>
          <p id="brand-tagline" class="brand-outro__tagline">AI Engineering</p>
        </div>
      </section>
    </div>
    <script>const tl = gsap.timeline({ paused: true }); tl.set(["#brand-name", "#brand-tagline"], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)" }, 0); tl.to("#brand-corner", { autoAlpha: 0 }, 23.5); tl.to("#scene-brand-outro", { autoAlpha: 1 }, 24); tl.to(["#brand-name", "#brand-tagline"], { autoAlpha: 1, scale: 1, filter: "blur(0px)" }, 24.62);</script>
  </body>
</html>
`;

describe("checkEpisode", () => {
  it("passes a compliant episode", () => {
    const result = checkEpisode(writeEpisode(compliantHtml()), catalogManifest);

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("accepts uppercase doctype and CRLF line endings", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml().replace("<!doctype html>", "<!DOCTYPE html>").replace(/\n/g, "\r\n"),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(true);
  });

  it("fails when a blank line appears before the catalog comment", () => {
    const result = checkEpisode(
      writeEpisode(compliantHtml().replace("\n<!-- catalog:", "\n\n<!-- catalog:")),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("catalog-comment-format");
  });

  it("fails when a required component is missing", () => {
    const result = checkEpisode(
      writeEpisode(compliantHtml("<!-- catalog: [brand-logo-watermark] -->")),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("required-component");
  });

  it("fails when a deprecated component is referenced", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml(
          "<!-- catalog: [brand-logo-watermark, brand-logo-outro, texture-mask-text] -->",
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("catalog-id-not-deprecated");
  });

  it("fails when an unknown component id is referenced", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml(
          "<!-- catalog: [brand-logo-watermark, brand-logo-outro, missing-component] -->",
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("catalog-id-exists");
  });

  it("fails when disabled has no reason", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml("<!-- catalog: [brand-logo-watermark] disabled: [brand-logo-outro] -->"),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("disabled-reason");
  });

  it("passes when a required component is disabled with a reason", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml(
          '<!-- catalog: [brand-logo-watermark] disabled: [brand-logo-outro] reason: "<15s teaser" -->',
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(true);
  });

  it("fails requires # when the only matching id is prefixed", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml(
          "<!-- catalog: [brand-logo-watermark, brand-logo-outro, grid-pixelate-wipe] -->",
        ).replace(
          '<section id="scene-setup" class="scene clip" data-start="0" data-track-index="4"></section>',
          '<section id="scene-setup" class="scene clip" data-start="0" data-track-index="4" data-id="pixel-grid"></section>',
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("requires #pixel-grid");
  });

  it("fails requires . when the only matching class is a longer token", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml(
          "<!-- catalog: [brand-logo-watermark, brand-logo-outro, data-chart] -->",
        ).replace(
          '<section id="scene-setup" class="scene clip" data-start="0" data-track-index="4"></section>',
          '<section id="scene-setup" class="scene clip" data-start="0" data-track-index="4"></section><section data-track-index="5" class="hf-data-chart-demo"></section><script>const metric = { onUpdate: () => null };</script>',
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("requires .hf-data-chart");
  });

  it("fails when a component with forbidden reserved tracks uses 97..99", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml(
          "<!-- catalog: [brand-logo-watermark, brand-logo-outro, yt-lower-third] -->",
        ).replace(
          '<section id="scene-setup" class="scene clip" data-start="0" data-track-index="4"></section>',
          '<section id="scene-setup" class="scene clip" data-start="0" data-track-index="4"></section><section id="yt-lower-third" data-track-index="99"></section>',
      ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("forbidden tracks 97..99");
  });

  it("fails brand-logo-outro when the exact scene-brand-outro template is missing", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml().replace(
          '<section id="scene-brand-outro" class="scene clip" data-start="24" data-track-index="7">',
          '<section id="scene-logo-outro" class="scene clip" data-start="24" data-track-index="7">',
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("requires #scene-brand-outro");
  });

  it("fails brand-logo-outro when it is not the last scene", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml().replace(
          "</div>\n    <script>",
          '<section id="scene-after-outro" class="scene clip" data-start="28" data-track-index="8"></section></div>\n    <script>',
        ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain("requires final scene-brand-outro");
  });

  it("fails brand-logo-outro when the text does not use the blur scale reveal", () => {
    const result = checkEpisode(
      writeEpisode(
        compliantHtml()
          .replace(
            'tl.set(["#brand-name", "#brand-tagline"], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)" }, 0); ',
            "",
          )
          .replace(
            ' tl.to(["#brand-name", "#brand-tagline"], { autoAlpha: 1, scale: 1, filter: "blur(0px)" }, 24.62);',
            "",
          ),
      ),
      catalogManifest,
    );

    expect(result.ok).toBe(false);
    expect(result.failures.map((item) => item.rule)).toContain(
      "requires outro text blur scale reveal",
    );
  });
});
