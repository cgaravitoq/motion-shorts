#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import type { SceneTypeManifest } from "@cgaravitoq/spec";

interface CatalogType {
  type: string;
  manifest: SceneTypeManifest;
  sample: Record<string, unknown>;
}

const root = path.resolve("templates/scenes");
const types: CatalogType[] = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const dir = path.join(root, d.name, "v1");
    return {
      type: d.name,
      manifest: JSON.parse(
        fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
      ) as SceneTypeManifest,
      sample: JSON.parse(fs.readFileSync(path.join(dir, "sample.json"), "utf8")) as Record<
        string,
        unknown
      >,
    };
  });

const order = (t: CatalogType): number => (t.type === "hook" ? 0 : t.type === "outro" ? 2 : 1);
types.sort((a, b) => order(a) - order(b) || a.type.localeCompare(b.type));

const scenes = types.map((t) => ({
  id: t.type,
  type: t.type,
  duration: t.manifest.defaultDuration ?? 6,
  slots: t.sample,
}));

const spec = {
  slug: "scene-catalog",
  lang: "es",
  width: 1080,
  height: 1920,
  palette: { accent: "#5b6cff", accent2: "#e9ff00" },
  scenes,
};

const dir = path.resolve("src/episodes/scene-catalog");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "scene-spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
console.log(
  `[catalog-demo] wrote ${path.relative(process.cwd(), path.join(dir, "scene-spec.json"))} with ${scenes.length} scenes: ${scenes.map((s) => s.type).join(", ")}`,
);
