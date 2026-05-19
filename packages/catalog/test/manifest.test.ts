import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

const expectedStatuses = {
  "asset-stack-parallax": "first-class",
  "brand-logo-cloud": "first-class",
  "brand-logo-watermark": "required",
  "brand-logo-outro": "required",
  "grain-overlay": "first-class",
  "shimmer-sweep": "first-class",
  "grid-pixelate-wipe": "first-class",
  "scene-blur-crossfade": "first-class",
  "data-chart": "first-class",
  "device-screen-pan": "first-class",
  flowchart: "first-class",
  "image-ken-burns": "first-class",
  "logo-orbit": "first-class",
  "map-route": "first-class",
  "product-turntable-lite": "first-class",
  "screenshot-spotlight": "first-class",
  "source-article-hero": "first-class",
  "source-attribution-strip": "first-class",
  "source-friction-grid": "first-class",
  "source-image-reveal": "first-class",
  "source-knowledge-pipeline": "first-class",
  "source-proof-card": "first-class",
  "source-stat-comparison": "first-class",
  "svg-path-draw": "first-class",
  "instagram-follow": "first-class",
  "tiktok-follow": "first-class",
  "yt-lower-third": "first-class",
  "x-post": "copy-paste",
  "reddit-post": "copy-paste",
  "macos-notification": "copy-paste",
  "spotify-card": "copy-paste",
  "legacy-text-watermark": "deprecated",
  "texture-mask-text": "deprecated",
};

describe("catalog manifest", () => {
  it("pins required ids and statuses", () => {
    const statuses = Object.fromEntries(manifest.map((entry) => [entry.id, entry.status]));

    expect(statuses).toEqual(expectedStatuses);
  });
});
