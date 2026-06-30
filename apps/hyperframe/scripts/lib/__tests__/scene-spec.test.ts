import { describe, expect, it } from "bun:test";
import path from "node:path";
import { validateSceneSpec } from "../scene-spec";

const hubRoot = path.resolve(import.meta.dir, "../../..");

type FixtureScene = {
  id: string;
  type: string;
  duration?: number;
  slots?: Record<string, unknown>;
};
type FixtureSpec = {
  slug: string;
  lang: string;
  width: number;
  height: number;
  scenes: [FixtureScene, FixtureScene, FixtureScene];
};

// Inline fixture against the TRACKED scene-type manifests (templates/scenes):
// episodes under src/episodes are local working copies, never in git/CI.
const realSpec = (): FixtureSpec => ({
  slug: "contract-fixture",
  lang: "es",
  width: 1080,
  height: 1920,
  scenes: [
    { id: "hook", type: "hook", duration: 6, slots: { title: "Hola <strong>mundo</strong>" } },
    {
      id: "kpis",
      type: "metric",
      duration: 7,
      slots: { stats: [{ value: "42", label: "shorts" }] },
    },
    { id: "outro", type: "outro", duration: 5, slots: {} },
  ],
});

describe("validateSceneSpec", () => {
  it("accepts a valid spec built against the real scene-type manifests", () => {
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
