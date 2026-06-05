import { describe, expect, it } from "bun:test";
import type { FetchLike } from "../fetch-like";
import { uploadYoutubeVideo, youtubeAuthUrl } from "../youtube";

describe("youtubeAuthUrl", () => {
  it("requests offline access scoped to youtube.upload only", () => {
    const url = new URL(
      youtubeAuthUrl({ clientId: "cid", redirectUri: "http://127.0.0.1:8975", state: "xyz" }),
    );
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.upload");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("xyz");
  });
});

describe("uploadYoutubeVideo", () => {
  it("runs the resumable init + PUT flow with the required metadata", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      if (calls.length === 1) {
        return new Response(null, {
          status: 200,
          headers: { location: "https://upload.example/session-1" },
        });
      }
      return new Response(JSON.stringify({ id: "vid123", status: { privacyStatus: "private" } }), {
        status: 200,
      });
    };

    const video = new Uint8Array([1, 2, 3, 4]);
    const result = await uploadYoutubeVideo({
      accessToken: "tok",
      video,
      title: "Title",
      description: "Desc",
      privacyStatus: "private",
      fetchImpl,
    });

    expect(result).toEqual({
      videoId: "vid123",
      url: "https://www.youtube.com/shorts/vid123",
      privacyStatus: "private",
    });
    expect(calls).toHaveLength(2);

    const [initCall, uploadCall] = calls;
    const initHeaders = (initCall?.init.headers ?? {}) as Record<string, string>;
    expect(initHeaders["x-upload-content-length"]).toBe("4");
    const metadata = JSON.parse(String(initCall?.init.body));
    expect(metadata.status.selfDeclaredMadeForKids).toBe(false);
    expect(metadata.status.privacyStatus).toBe("private");
    expect(metadata.snippet.categoryId).toBe("28");

    expect(uploadCall?.url).toBe("https://upload.example/session-1");
    expect(uploadCall?.init.method).toBe("PUT");
  });

  it("fails loudly when the session init returns no Location", async () => {
    const fetchImpl: FetchLike = async () => new Response(null, { status: 200 });
    expect(
      uploadYoutubeVideo({
        accessToken: "t",
        video: new Uint8Array(1),
        title: "t",
        description: "d",
        fetchImpl,
      }),
    ).rejects.toThrow("no Location header");
  });
});
