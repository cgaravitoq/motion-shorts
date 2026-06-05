import { describe, expect, it } from "bun:test";
import { upsertPublishRecord } from "../ledger";

const now = new Date("2026-06-05T12:00:00.000Z");
const record = {
  status: "published" as const,
  id: "vid1",
  url: "https://www.youtube.com/shorts/vid1",
  publishedAt: now.toISOString(),
  renderSha256: "a".repeat(64),
  lang: "es",
  privacy: "private",
};

describe("upsertPublishRecord", () => {
  it("creates a ledger from scratch", () => {
    const ledger = upsertPublishRecord({
      ledger: null,
      slug: "demo",
      platform: "youtube",
      record,
      now,
    });
    expect(ledger.slug).toBe("demo");
    expect(ledger.platforms.youtube?.id).toBe("vid1");
  });

  it("preserves other platforms and replaces the same one", () => {
    const first = upsertPublishRecord({
      ledger: null,
      slug: "demo",
      platform: "youtube",
      record,
      now,
    });
    const second = upsertPublishRecord({
      ledger: first,
      slug: "demo",
      platform: "instagram",
      record: { ...record, id: "media-9", url: undefined },
      now,
    });
    const third = upsertPublishRecord({
      ledger: second,
      slug: "demo",
      platform: "youtube",
      record: { ...record, status: "failed", error: "quota" },
      now,
    });
    expect(Object.keys(third.platforms).sort()).toEqual(["instagram", "youtube"]);
    expect(third.platforms.youtube?.status).toBe("failed");
    expect(third.platforms.instagram?.id).toBe("media-9");
  });
});
