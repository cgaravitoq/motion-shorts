import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { brandVarsStyleBlock, loadBrandPack } from "../brand-pack";

const writePack = (pack: object): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-pack-"));
  fs.mkdirSync(path.join(root, "brands", "acme"), { recursive: true });
  fs.writeFileSync(path.join(root, "brands", "acme", "brand.json"), JSON.stringify(pack));
  return root;
};

describe("loadBrandPack", () => {
  it("throws a clear error when the brand file is missing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-pack-"));
    expect(() => loadBrandPack(root, "ghost", "test")).toThrow(/brand "ghost" declared but/);
  });

  it("throws when palette is missing", () => {
    const root = writePack({ slug: "acme" });
    expect(() => loadBrandPack(root, "acme", "test")).toThrow(/missing required "palette"/);
  });
});

describe("brandVarsStyleBlock", () => {
  it("emits --brand-* vars in JSON key order", () => {
    const block = brandVarsStyleBlock({ slug: "acme", palette: { paper: "#fff", ink: "#000" } });
    expect(block).toContain('data-brand="acme"');
    expect(block.indexOf("--brand-paper: #fff;")).toBeLessThan(block.indexOf("--brand-ink: #000;"));
    expect(block).not.toContain("@font-face");
  });

  it("emits @font-face rules for declared brand fonts", () => {
    const block = brandVarsStyleBlock({
      slug: "acme",
      palette: { paper: "#fff" },
      fonts: [
        { family: "Sora", file: "SoraVariable.woff2" },
        { family: "Lora", file: "Lora.woff2", weight: "400 700" },
      ],
    });
    expect(block).toContain(
      '@font-face { font-family: "Sora"; src: url("assets/SoraVariable.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }',
    );
    expect(block).toContain('font-family: "Lora"');
    expect(block).toContain("font-weight: 400 700");
  });

  it("is deterministic for identical input", () => {
    const pack = {
      slug: "acme",
      palette: { paper: "#fff" },
      fonts: [{ family: "Sora", file: "s.woff2" }],
    };
    expect(brandVarsStyleBlock(pack)).toBe(brandVarsStyleBlock(pack));
  });
});
