import { describe, expect, it } from "bun:test";
import { Result } from "effect";
import { formatParseError } from "../parse-error";
import { decodeSceneSpec } from "../scene-spec";

const validSpec = {
  slug: "demo-short",
  lang: "es",
  width: 1080,
  height: 1920,
  palette: { accent: "#4285f4", accent2: "#c58af9" },
  scenes: [
    { id: "hook", type: "hook", duration: 8.7, slots: { title: "Hola" } },
    { id: "outro", type: "outro", duration: 5, status: "approved", slots: {} },
  ],
};

describe("SceneSpec", () => {
  it("decodes a valid spec", () => {
    const result = decodeSceneSpec(validSpec);
    if (Result.isFailure(result)) {
      throw new Error(formatParseError(result.failure).join("\n"));
    }
    expect(result.success.slug).toBe("demo-short");
    expect(result.success.scenes).toHaveLength(2);
  });

  it("rejects a non-kebab slug with an actionable message", () => {
    const result = decodeSceneSpec({ ...validSpec, slug: "Demo Short" });
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      const messages = formatParseError(result.failure).join("\n");
      expect(messages).toContain("spec.slug");
      expect(messages).toContain("kebab-case");
    }
  });

  it("rejects empty scenes", () => {
    const result = decodeSceneSpec({ ...validSpec, scenes: [] });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects a non-positive scene duration", () => {
    const scenes = [{ id: "hook", type: "hook", duration: 0, slots: {} }];
    const result = decodeSceneSpec({ ...validSpec, scenes });
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(formatParseError(result.failure).join("\n")).toContain("scenes[0].duration");
    }
  });

  it("rejects an unknown scene status", () => {
    const scenes = [{ id: "hook", type: "hook", status: "rejected", slots: {} }];
    const result = decodeSceneSpec({ ...validSpec, scenes });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("collects every structural error in one pass", () => {
    const result = decodeSceneSpec({
      slug: "BAD SLUG",
      width: Number.POSITIVE_INFINITY,
      scenes: [{ id: "Hook!", type: "", duration: -1 }],
    });
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      const issues = formatParseError(result.failure);
      expect(issues.length).toBeGreaterThanOrEqual(4);
    }
  });
});
