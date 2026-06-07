const read = (name: string): string | undefined => process.env[name] || undefined;

export const env = {
  brandName: read("BRAND_NAME"),
  brandTagline: read("BRAND_TAGLINE"),
};
