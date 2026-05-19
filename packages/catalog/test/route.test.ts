import { describe, expect, it } from "vitest";
import { type CatalogIntent, route } from "../src/route";

const expected: Record<CatalogIntent, { skillPath: string; requiredComponents: string[] }> = {
  informative: {
    skillPath: ".agents/skills/short-informative",
    requiredComponents: ["brand-logo-outro", "brand-logo-watermark"],
  },
  data: {
    skillPath: ".agents/skills/short-data-visual",
    requiredComponents: ["brand-logo-outro", "brand-logo-watermark"],
  },
  workflow: {
    skillPath: ".agents/skills/short-workflow-explainer",
    requiredComponents: ["brand-logo-outro", "brand-logo-watermark"],
  },
  social: {
    skillPath: ".agents/skills/short-social-overlay",
    requiredComponents: ["brand-logo-outro", "brand-logo-watermark"],
  },
  brand: {
    skillPath: ".agents/skills/short-brand-system",
    requiredComponents: ["brand-logo-outro", "brand-logo-watermark"],
  },
  vfx: {
    skillPath: ".agents/skills/short-vfx-experimental",
    requiredComponents: ["brand-logo-outro", "brand-logo-watermark"],
  },
};

describe("route", () => {
  it.each(Object.entries(expected) as [CatalogIntent, (typeof expected)[CatalogIntent]][])(
    "routes %s intent",
    (intent, expectation) => {
      const result = route({ intent });

      expect({
        skillPath: result.skillPath,
        requiredComponents: result.requiredComponents.map((entry) => entry.id),
        recommendedComponents: result.recommendedComponents.map((entry) => entry.id),
        deprecatedAvoid: result.deprecatedAvoid.map((entry) => entry.id),
      }).toMatchSnapshot();
      expect(result.skillPath).toBe(expectation.skillPath);
      expect(result.requiredComponents.map((entry) => entry.id)).toEqual(expectation.requiredComponents);
    },
  );

  it("adds source-driven recommendations only when the source tag is present", () => {
    const result = route({ intent: "informative", tags: ["source"] });

    expect(result.recommendedComponents.map((entry) => entry.id)).toEqual([
      "asset-stack-parallax",
      "brand-logo-cloud",
      "data-chart",
      "device-screen-pan",
      "flowchart",
      "image-ken-burns",
      "map-route",
      "screenshot-spotlight",
      "source-article-hero",
      "source-attribution-strip",
      "source-friction-grid",
      "source-image-reveal",
      "source-knowledge-pipeline",
      "source-proof-card",
      "source-stat-comparison",
      "macos-notification",
    ]);
  });

  it("filters asset-motion recommendations by platform, format, density, and motion role", () => {
    const result = route({
      intent: "informative",
      tags: ["source"],
      platform: "youtube-shorts",
      format: "portrait",
      density: "low",
      motionRoles: ["reveal"],
    });

    expect(result.recommendedComponents.map((entry) => entry.id)).toEqual([
      "source-image-reveal",
    ]);
  });
});
