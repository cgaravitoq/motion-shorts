import { compactCatalogEntry, route } from "@cgaravitoq/catalog";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";

const inputSchema = z.object({
  intent: z.enum(["informative", "data", "workflow", "social", "brand", "vfx"]),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  platform: z.enum(["youtube-shorts", "tiktok", "instagram-reels", "linkedin"]).optional(),
  density: z.enum(["low", "medium", "high"]).optional(),
  format: z.enum(["portrait", "square", "landscape"]).optional(),
  assetKinds: z
    .array(z.enum(["image", "font", "screenshot", "svg", "logo", "video", "other"]))
    .optional(),
  motionRoles: z
    .array(z.enum(["hook", "reveal", "transition", "ambient", "proof", "brand", "cta"]))
    .optional(),
});

const jsonSchema = {
  type: "object" as const,
  properties: {
    intent: { type: "string", enum: ["informative", "data", "workflow", "social", "brand", "vfx"] },
    tags: { type: "array", items: { type: "string" } },
    source: { type: "string" },
    platform: {
      type: "string",
      enum: ["youtube-shorts", "tiktok", "instagram-reels", "linkedin"],
    },
    density: { type: "string", enum: ["low", "medium", "high"] },
    format: { type: "string", enum: ["portrait", "square", "landscape"] },
    assetKinds: {
      type: "array",
      items: { type: "string", enum: ["image", "font", "screenshot", "svg", "logo", "video", "other"] },
    },
    motionRoles: {
      type: "array",
      items: { type: "string", enum: ["hook", "reveal", "transition", "ambient", "proof", "brand", "cta"] },
    },
  },
  required: ["intent"],
};

export const recommendVisualComponentsTool: ToolDefinition = {
  name: "recommend_visual_components",
  description:
    "Recommend visual catalog components for a short intent using intent, tags, source, platform, density, format, asset kinds, and motion roles.",
  inputSchema: jsonSchema,
  async handler(input) {
    try {
      const result = route(inputSchema.parse(input));
      return success({
        skillPath: result.skillPath,
        requiredComponents: result.requiredComponents.map(compactCatalogEntry),
        recommendedComponents: result.recommendedComponents.map(compactCatalogEntry),
        deprecatedAvoid: result.deprecatedAvoid.map(compactCatalogEntry),
      });
    } catch (error) {
      return failure(error);
    }
  },
};
