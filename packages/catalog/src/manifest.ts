import manifestJson from "../manifest.json";
import { CatalogManifestSchema } from "./schema";

export const catalogManifest = CatalogManifestSchema.parse(manifestJson);
