import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { validateSceneSpec } from "./scene-spec";

const hubRoot = path.resolve(import.meta.dir, "../..");
const realSpec = () =>
  JSON.parse(fs.readFileSync(path.join(hubRoot, "src/episodes/qa-progress-ring/scene-spec.json"), "utf8"));

describe("validateSceneSpec", () => {
  it("accepts a real episode spec", () => {
    const { ok, errors, warnings } = validateSceneSpec(realSpec(), { hubRoot });
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("rejects a non-object spec", () => {
    expect(validateSceneSpec(null)).toEqual({
      ok: false,
      errors: ["spec is not an object"],
      warnings: [],
    });
  });

  it("rejects a non-kebab slug", () => {
    const { ok, errors } = validateSceneSpec({ ...realSpec(), slug: "Bad Slug" }, { hubRoot });
    expect(ok).toBe(false);
    expect(errors.join("\n")).toContain("spec.slug");
  });

  it("flags duplicate scene ids", () => {
    const spec = realSpec();
    spec.scenes.push({ ...spec.scenes[0] });
    const { ok, errors } = validateSceneSpec(spec, { hubRoot });
    expect(ok).toBe(false);
    expect(errors.join("\n")).toContain("duplicate scene id");
  });

  it("flags an unknown scene-type", () => {
    const spec = realSpec();
    spec.scenes[0].type = "does-not-exist";
    const { ok, errors } = validateSceneSpec(spec, { hubRoot });
    expect(ok).toBe(false);
    expect(errors.join("\n")).toContain('unknown scene-type "does-not-exist@1"');
  });

  it("flags a repeat slot out of range", () => {
    const spec = {
      slug: "range-check",
      scenes: [{ id: "kpis", type: "metric", slots: { stats: [] } }],
    };
    const { ok, errors } = validateSceneSpec(spec, { hubRoot });
    expect(ok).toBe(false);
    expect(errors.join("\n")).toContain("allowed range");
  });

  it("warns on unknown params without failing", () => {
    const spec = realSpec();
    spec.scenes[0].slots = { ...(spec.scenes[0].slots ?? {}), bogusParam: "x" };
    const { ok, warnings } = validateSceneSpec(spec, { hubRoot });
    expect(ok).toBe(true);
    expect(warnings.join("\n")).toContain("bogusParam");
  });

  it("collects structural and relational errors together", () => {
    const spec = {
      slug: "BAD SLUG",
      scenes: [
        { id: "a", type: "does-not-exist", duration: -2 },
        { id: "a", type: "metric", slots: { stats: [] } },
      ],
    };
    const { ok, errors } = validateSceneSpec(spec, { hubRoot });
    expect(ok).toBe(false);
    const text = errors.join("\n");
    expect(text).toContain("spec.slug");
    expect(text).toContain("duration");
    expect(text).toContain("unknown scene-type");
    expect(text).toContain("duplicate scene id");
    expect(text).toContain("allowed range");
  });
});
