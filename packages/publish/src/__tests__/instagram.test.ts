import { describe, expect, it } from "bun:test";
import type { FetchLike } from "../fetch-like";
import { publishInstagramReel } from "../instagram";

const scriptedFetch = (responses: Array<Record<string, unknown>>): FetchLike => {
  let call = 0;
  return async () => {
    const body = responses[Math.min(call, responses.length - 1)];
    call++;
    return new Response(JSON.stringify(body), { status: 200 });
  };
};

const noSleep = async (): Promise<void> => {};

describe("publishInstagramReel", () => {
  it("creates the container, polls to FINISHED, publishes, and resolves the permalink", async () => {
    const fetchImpl = scriptedFetch([
      { id: "container-1" },
      { status_code: "IN_PROGRESS" },
      { status_code: "FINISHED" },
      { id: "media-9" },
      { permalink: "https://www.instagram.com/reel/abc/" },
    ]);
    const result = await publishInstagramReel({
      accessToken: "tok",
      igUserId: "178414",
      videoUrl: "https://signed.example/video.mp4",
      caption: "Caption #ai",
      pollIntervalMs: 1,
      fetchImpl,
      sleep: noSleep,
    });
    expect(result).toEqual({
      mediaId: "media-9",
      permalink: "https://www.instagram.com/reel/abc/",
    });
  });

  it("throws when the container ends in ERROR", async () => {
    const fetchImpl = scriptedFetch([{ id: "container-1" }, { status_code: "ERROR" }]);
    expect(
      publishInstagramReel({
        accessToken: "tok",
        igUserId: "1",
        videoUrl: "https://x/v.mp4",
        caption: "c",
        pollIntervalMs: 1,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow("ended in ERROR");
  });

  it("reports HTTP status when the edge returns a non-JSON body", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("<html>rate limited</html>", { status: 429, statusText: "Too Many Requests" });
    expect(
      publishInstagramReel({
        accessToken: "tok",
        igUserId: "1",
        videoUrl: "https://x/v.mp4",
        caption: "c",
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow("429 Too Many Requests");
  });

  it("surfaces Graph API error payloads", async () => {
    const fetchImpl = scriptedFetch([{ error: { message: "Invalid token", code: 190 } }]);
    expect(
      publishInstagramReel({
        accessToken: "bad",
        igUserId: "1",
        videoUrl: "https://x/v.mp4",
        caption: "c",
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow("Invalid token (code 190)");
  });
});
