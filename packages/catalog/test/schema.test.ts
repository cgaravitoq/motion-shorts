import { describe, expect, it } from "vitest";
import { CatalogEntrySchema } from "../src/schema";

const validEntry = {
  id: "brand-logo-watermark",
  type: "brand",
  status: "required",
  intentTags: ["brand"],
  sourceDemo: "apps/hyperframe/src/episodes/demo-explainer-with-logo/index.html",
  snippetPaths: ["packages/catalog/snippets/brand-logo-watermark.html"],
  requiredTracks: [97],
  timingGuidance: "Keep visible throughout the episode after the opening hook.",
  dependencies: [],
  usageRules: ["Use on branded shorts."],
  validationRules: ["requires #brand-corner element"],
};

describe("CatalogEntrySchema", () => {
  it("parses a valid catalog entry", () => {
    expect(CatalogEntrySchema.parse(validEntry)).toEqual(validEntry);
  });

  it("rejects invalid closed-set values", () => {
    expect(() =>
      CatalogEntrySchema.parse({
        ...validEntry,
        status: "recommended",
        intentTags: ["unknown"],
      }),
    ).toThrow();
  });

  it("rejects ids without at least one letter", () => {
    expect(() => CatalogEntrySchema.parse({ ...validEntry, id: "123" })).toThrow();
  });

  it("allows an empty sourceDemo only for reference entries", () => {
    expect(
      CatalogEntrySchema.parse({
        ...validEntry,
        id: "reddit-post",
        type: "reference",
        status: "copy-paste",
        sourceDemo: "",
        snippetPaths: ["packages/catalog/snippets/reddit-post.html"],
      }).sourceDemo,
    ).toBe("");

    expect(() => CatalogEntrySchema.parse({ ...validEntry, sourceDemo: "" })).toThrow();
  });
});
