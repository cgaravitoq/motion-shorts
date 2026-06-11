import fs from "node:fs";
import path from "node:path";

export interface BrandFontFace {
  family: string;
  file: string;
  weight?: string;
}

export interface BrandPack {
  slug: string;
  palette?: Record<string, string>;
  fonts?: BrandFontFace[];
  publishable?: boolean;
  notes?: string;
}

export const EMPTY_BRAND_VARS = '<style id="brand-vars"></style>';

export function loadBrandPack(root: string, brandSlug: string, caller: string): BrandPack {
  const brandPath = path.resolve(root, "brands", brandSlug, "brand.json");
  if (!fs.existsSync(brandPath)) {
    throw new Error(
      `${caller}: brand "${brandSlug}" declared but ${brandPath} does not exist. Create the brand pack or remove the field.`,
    );
  }
  let brand: BrandPack;
  try {
    brand = JSON.parse(fs.readFileSync(brandPath, "utf8")) as BrandPack;
  } catch (err) {
    throw new Error(`${caller}: ${brandPath} is not valid JSON: ${(err as Error).message}`);
  }
  if (!brand.palette || typeof brand.palette !== "object") {
    throw new Error(`${caller}: ${brandPath} missing required "palette" object.`);
  }
  return brand;
}

// Object.entries on JSON.parse output preserves the file's key insertion
// order, so identical brand.json bytes => identical CSS block bytes. Font
// files resolve relative to the episode's index.html (assets/<file>), so the
// woff2 must live in the consuming episode's assets/ directory.
export function brandVarsStyleBlock(brand: BrandPack): string {
  const cssVars = Object.entries(brand.palette ?? {})
    .map(([key, value]) => `  --brand-${key}: ${value};`)
    .join("\n");
  const fontFaces = (brand.fonts ?? [])
    .map(
      (f) =>
        `@font-face { font-family: "${f.family}"; src: url("assets/${f.file}") format("woff2"); font-weight: ${f.weight ?? "100 900"}; font-display: swap; }`,
    )
    .join("\n");
  const fontBlock = fontFaces ? `\n${fontFaces}` : "";
  return `<style id="brand-vars" data-brand="${brand.slug}">\n:root {\n${cssVars}\n}${fontBlock}\n</style>`;
}
