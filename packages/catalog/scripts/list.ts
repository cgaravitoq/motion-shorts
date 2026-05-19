import manifest from "../manifest.json";

for (const entry of manifest) {
  console.log(`${entry.id}\t${entry.type}\t${entry.status}\t${entry.intentTags.join(",")}`);
}
