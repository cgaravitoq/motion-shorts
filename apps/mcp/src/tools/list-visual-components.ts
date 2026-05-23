import type { CatalogEntry } from "@cgaravitoq/catalog";
import { compactCatalogEntry, filterBySafeForFormat, manifest } from "@cgaravitoq/catalog";
import { z } from "zod";
import type { ToolDefinition } from ".";
import { failure, success } from "./_helpers";

const inputSchema = z.object({
  status: z
    .enum(["required", "first-class", "copy-paste", "experimental", "deprecated"])
    .optional(),
  intentTags: z
    .array(z.enum(["informative", "workflow", "data", "social", "brand", "hook", "outro", "vfx", "source"]))
    .optional(),
  type: z
    .enum(["brand", "component", "block", "overlay", "transition", "vfx", "reference"])
    .optional(),
  platform: z.enum(["youtube-shorts", "tiktok", "instagram-reels", "linkedin"]).optional(),
  density: z.enum(["low", "medium", "high"]).optional(),
  format: z.enum(["portrait", "square", "landscape", "short", "desktop-1080p"]).optional(),
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
    status: {
      type: "string",
      enum: ["required", "first-class", "copy-paste", "experimental", "deprecated"],
    },
    intentTags: {
      type: "array",
      items: {
        type: "string",
        enum: ["informative", "workflow", "data", "social", "brand", "hook", "outro", "vfx", "source"],
      },
    },
    type: {
      type: "string",
      enum: ["brand", "component", "block", "overlay", "transition", "vfx", "reference"],
    },
    platform: {
      type: "string",
      enum: ["youtube-shorts", "tiktok", "instagram-reels", "linkedin"],
    },
    density: { type: "string", enum: ["low", "medium", "high"] },
    format: { type: "string", enum: ["portrait", "square", "landscape", "short", "desktop-1080p"] },
    assetKinds: {
      type: "array",
      items: { type: "string", enum: ["image", "font", "screenshot", "svg", "logo", "video", "other"] },
    },
    motionRoles: {
      type: "array",
      items: { type: "string", enum: ["hook", "reveal", "transition", "ambient", "proof", "brand", "cta"] },
    },
  },
};

export const listVisualComponentsTool: ToolDefinition = {
  name: "list_visual_components",
  description:
    "List compact visual catalog components. Optional filters: status, intentTags, type, and format (short or desktop-1080p safeFor; legacy portrait/square/landscape formatTargets also accepted). Returns no snippet bodies.",
  inputSchema: jsonSchema,
  async handler(input) {
    try {
      const filters = inputSchema.parse(input);
      const safeForFormat =
        filters.format === "desktop-1080p" || filters.format === "short" ? filters.format : "short";
      const formatTarget =
        filters.format === "portrait" || filters.format === "square" || filters.format === "landscape"
          ? filters.format
          : undefined;
      const entries = filterBySafeForFormat(manifest, safeForFormat).filter((entry: CatalogEntry) => {
        if (filters.status && entry.status !== filters.status) return false;
        if (filters.type && entry.type !== filters.type) return false;
        if (
          filters.intentTags?.length &&
          !filters.intentTags.every((tag) => entry.intentTags.includes(tag))
        )
          return false;
        if (filters.platform && !entry.platformTargets?.includes(filters.platform)) return false;
        if (filters.density && entry.density !== filters.density) return false;
        if (formatTarget && !entry.formatTargets?.includes(formatTarget)) return false;
        if (
          filters.assetKinds?.length &&
          !filters.assetKinds.some((kind) => entry.assetKinds?.includes(kind))
        )
          return false;
        if (
          filters.motionRoles?.length &&
          !filters.motionRoles.some((role) => entry.motionRoles?.includes(role))
        )
          return false;
        return true;
      });

      return success(entries.map(compactCatalogEntry));
    } catch (error) {
      return failure(error);
    }
  },
};
