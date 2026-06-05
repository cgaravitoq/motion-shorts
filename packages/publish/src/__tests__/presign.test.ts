import { describe, expect, it } from "bun:test";
import { presignGetUrl } from "../presign";

const config = {
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret",
  endpoint: "https://acct.r2.cloudflarestorage.com",
  endpointPrefix: "/renders",
};
const now = new Date("2026-06-05T12:00:00.000Z");

describe("presignGetUrl", () => {
  it("signs only the host header so third-party fetchers can GET the URL", () => {
    const url = new URL(
      presignGetUrl({
        config,
        key: "motion-shorts/episodes/demo/final/renders/demo.mp4",
        expiresSeconds: 7200,
        now,
      }),
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("7200");
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260605T120000Z");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "AKIAEXAMPLE/20260605/auto/s3/aws4_request",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.pathname).toBe("/renders/motion-shorts/episodes/demo/final/renders/demo.mp4");
  });

  it("is deterministic for a fixed clock", () => {
    const args = { config, key: "a/b.mp4", expiresSeconds: 3600, now };
    expect(presignGetUrl(args)).toBe(presignGetUrl(args));
  });
});
