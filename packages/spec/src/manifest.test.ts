import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { Result } from "effect";
import { decodeSceneTypeManifest } from "./manifest";
import { formatParseError } from "./parse-error";

const scenesRoot = path.resolve(import.meta.dir, "../../../apps/hyperframe/templates/scenes");

const realManifests = fs
  .readdirSync(scenesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const typeDir = path.join(scenesRoot, entry.name);
    return fs
      .readdirSync(typeDir, { withFileTypes: true })
      .filter((version) => version.isDirectory() && /^v\d+$/.test(version.name))
      .map((version) => ({
        type: entry.name,
        file: path.join(typeDir, version.name, "manifest.json"),
      }));
  });

describe("SceneTypeManifest", () => {
  it("finds the real scene-type manifests", () => {
    expect(realManifests.length).toBeGreaterThanOrEqual(17);
  });

  for (const { type, file } of realManifests) {
    it(`decodes the real "${type}" manifest`, () => {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      const result = decodeSceneTypeManifest(json);
      if (Result.isFailure(result)) {
        throw new Error(formatParseError(result.failure, "manifest").join("\n"));
      }
      expect(result.success.type).toBe(type);
    });
  }

  it("rejects a manifest without builder", () => {
    const json = JSON.parse(fs.readFileSync(realManifests[0]?.file ?? "", "utf8"));
    delete json.builder;
    const result = decodeSceneTypeManifest(json);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(formatParseError(result.failure, "manifest").join("\n")).toContain("builder");
    }
  });

  it("rejects an unknown slot kind", () => {
    const json = JSON.parse(fs.readFileSync(realManifests[0]?.file ?? "", "utf8"));
    json.slots = { broken: { kind: "markdown" } };
    const result = decodeSceneTypeManifest(json);
    expect(Result.isFailure(result)).toBe(true);
  });

  it("accepts an image slot kind", () => {
    const json = JSON.parse(fs.readFileSync(realManifests[0]?.file ?? "", "utf8"));
    json.slots = { screenshot: { kind: "image" }, caption: { kind: "text" } };
    const result = decodeSceneTypeManifest(json);
    expect(Result.isSuccess(result)).toBe(true);
  });

  it("rejects a repeat slot without min/max", () => {
    const json = JSON.parse(fs.readFileSync(realManifests[0]?.file ?? "", "utf8"));
    json.slots = { items: { kind: "repeat", item: {} } };
    const result = decodeSceneTypeManifest(json);
    expect(Result.isFailure(result)).toBe(true);
  });
});
