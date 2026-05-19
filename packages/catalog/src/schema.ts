import { z } from "zod";

export const CatalogEntryTypeSchema = z.enum([
  "brand",
  "component",
  "block",
  "overlay",
  "transition",
  "vfx",
  "reference",
]);

export const CatalogEntryStatusSchema = z.enum([
  "required",
  "first-class",
  "copy-paste",
  "experimental",
  "deprecated",
]);

export const CatalogIntentTagSchema = z.enum([
  "informative",
  "workflow",
  "data",
  "social",
  "brand",
  "hook",
  "outro",
  "vfx",
  "source",
]);

export const CatalogPlatformSchema = z.enum(["youtube-shorts", "tiktok", "instagram-reels", "linkedin"]);

export const CatalogDensitySchema = z.enum(["low", "medium", "high"]);

export const CatalogFormatSchema = z.enum(["portrait", "square", "landscape"]);

export const CatalogAssetKindSchema = z.enum([
  "image",
  "font",
  "screenshot",
  "svg",
  "logo",
  "video",
  "other",
]);

export const CatalogMotionRoleSchema = z.enum([
  "hook",
  "reveal",
  "transition",
  "ambient",
  "proof",
  "brand",
  "cta",
]);

export const CatalogEntrySchema = z
  .object({
    id: z.string().regex(/^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: CatalogEntryTypeSchema,
    status: CatalogEntryStatusSchema,
    intentTags: z.array(CatalogIntentTagSchema),
    sourceDemo: z.union([
      z.literal(""),
      z.string().regex(/^apps\/hyperframe\/src\/episodes\/.+\/index\.html$/),
    ]),
    snippetPaths: z.array(z.string().min(1)),
    requiredTracks: z.array(z.number().int().min(0).max(99)),
    timingGuidance: z.string().min(1),
    dependencies: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
    usageRules: z.array(z.string().min(1)),
    validationRules: z.array(z.string().min(1)),
    platformTargets: z.array(CatalogPlatformSchema).optional(),
    density: CatalogDensitySchema.optional(),
    formatTargets: z.array(CatalogFormatSchema).optional(),
    assetKinds: z.array(CatalogAssetKindSchema).optional(),
    motionRoles: z.array(CatalogMotionRoleSchema).optional(),
    previewAssetPath: z.string().min(1).optional(),
  })
  .refine((entry) => entry.type === "reference" || entry.sourceDemo !== "", {
    message: "sourceDemo can be empty only for reference entries",
    path: ["sourceDemo"],
  });

export const CatalogManifestSchema = z.array(CatalogEntrySchema);

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;

export function validateEntry(entry: unknown): CatalogEntry {
  return CatalogEntrySchema.parse(entry);
}
