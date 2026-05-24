import { describe, expect, it } from "vitest";
import { filterBySafeForFormat } from "../helpers";

type TestComponent = {
  id: string;
  safeFor?: readonly string[];
};

describe("filterBySafeForFormat", () => {
  const components: TestComponent[] = [
    { id: "short-only", safeFor: ["short"] },
    { id: "both", safeFor: ["short", "desktop-1080p", "desktop-4k", "square-1080"] },
    { id: "desktop-only", safeFor: ["desktop-1080p", "desktop-4k"] },
    { id: "square-only", safeFor: ["square-1080"] },
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

  it("filters components for desktop-4k", () => {
    expect(filterBySafeForFormat(components, "desktop-4k").map((component) => component.id)).toEqual([
      "both",
      "desktop-only",
    ]);
  });

  it("filters components for square-1080", () => {
    expect(filterBySafeForFormat(components, "square-1080").map((component) => component.id)).toEqual([
      "both",
      "square-only",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(filterBySafeForFormat([], "short")).toEqual([]);
    expect(filterBySafeForFormat([], "desktop-1080p")).toEqual([]);
    expect(filterBySafeForFormat([], "desktop-4k")).toEqual([]);
    expect(filterBySafeForFormat([], "square-1080")).toEqual([]);
  });
});
