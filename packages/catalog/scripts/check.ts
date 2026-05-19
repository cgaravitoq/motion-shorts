import { checkEpisode } from "../src/check";
import { CatalogManifestSchema } from "../src/schema";
import { validateCatalog } from "../src/validate";
import manifest from "../manifest.json";

const htmlPath = process.argv[2];

if (!htmlPath) {
  await validateCatalog();
  console.log("catalog check passed");
  process.exit(0);
}

const result = checkEpisode(htmlPath, CatalogManifestSchema.parse(manifest));

if (!result.ok) {
  for (const item of result.failures) {
    console.error(`${item.episode}: ${item.rule}: ${item.fix}`);
  }
  process.exit(1);
}

console.log(`${htmlPath}: catalog check passed`);
