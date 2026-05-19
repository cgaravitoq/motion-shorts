import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const compositionResourceDefinitions = [
  {
    slug: "canonical-short",
    name: "canonical-short composition template",
    description: "1080x1920 Hyperframes composition template with audio and #captions.",
  },
  {
    slug: "landscape-motion",
    name: "landscape-motion composition template",
    description: "1920x1080 Hyperframes composition template without audio or captions.",
  },
  {
    slug: "square-social",
    name: "square-social composition template",
    description: "1080x1080 Hyperframes composition template without audio or captions.",
  },
] as const;

export const compositionResources = compositionResourceDefinitions.map(
  ({ slug, name, description }) => ({
    uri: `file:///compositions/${slug}.html`,
    name,
    description,
    mimeType: "text/html",
  }),
);

export const readCompositionResource = async (uri: string): Promise<string | null> => {
  const definition = compositionResourceDefinitions.find(
    ({ slug }) => uri === `file:///compositions/${slug}.html`,
  );
  if (!definition) return null;

  const path = fileURLToPath(new URL(`./compositions/${definition.slug}.html`, import.meta.url));
  return readFile(path, "utf8");
};
