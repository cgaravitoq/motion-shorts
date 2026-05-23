import { describe, expect, it } from "vitest";
import { filterBySafeForFormat } from "../helpers";

type TestComponent = {
  id: string;
  safeFor?: readonly string[];
};

describe("filterBySafeForFormat", () => {
  const components: TestComponent[] = [
    { id: "short-only", safeFor: ["short"] },
    { id: "both", safeFor: ["short", "desktop-1080p"] },
    { id: "desktop-only", safeFor: ["desktop-1080p"] },
    { id: "implicit-short" },
  ];

  it("filters components for short with missing safeFor defaulting to short", () => {
    expect(filterBySafeForFormat(components, "short").map((component) => component.id)).toEqual([
      "short-only",
      "both",
      "implicit-short",
    ]);
  });

  it("filters components for desktop-1080p", () => {
    expect(filterBySafeForFormat(components, "desktop-1080p").map((component) => component.id)).toEqual([
      "both",
      "desktop-only",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(filterBySafeForFormat([], "short")).toEqual([]);
    expect(filterBySafeForFormat([], "desktop-1080p")).toEqual([]);
  });
});
