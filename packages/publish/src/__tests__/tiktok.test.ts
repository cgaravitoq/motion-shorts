import { describe, expect, it } from "bun:test";
import type { FetchLike } from "../fetch-like";
import {
  exchangeTiktokCode,
  refreshTiktokToken,
  tiktokAuthUrl,
  tiktokChunkPlan,
  uploadTiktokDraft,
} from "../tiktok";

const oauthConfig = { clientKey: "ck", clientSecret: "cs" };

const noSleep = async (): Promise<void> => {};

describe("tiktokAuthUrl", () => {
  it("requests only the video.upload scope", () => {
    const url = new URL(
      tiktokAuthUrl({ clientKey: "ck", redirectUri: "https://example.com/cb", state: "xyz" }),
    );
    expect(url.searchParams.get("scope")).toBe("video.upload");
    expect(url.searchParams.get("client_key")).toBe("ck");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});

describe("tiktok token endpoints (flat OAuth2 shape)", () => {
  it("parses a flat success body", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          open_id: "oid",
          expires_in: 86400,
          refresh_expires_in: 31536000,
        }),
        { status: 200 },
      );
    const tokens = await refreshTiktokToken({
      config: oauthConfig,
      refreshToken: "old",
      fetchImpl,
    });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.openId).toBe("oid");
  });

  it("surfaces flat string errors with error_description on 4xx", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token is invalid or expired.",
          log_id: "l9",
        }),
        { status: 400 },
      );
    expect(
      exchangeTiktokCode({
        config: oauthConfig,
        code: "c",
        redirectUri: "https://x/cb",
        fetchImpl,
      }),
    ).rejects.toThrow("invalid_grant: Refresh token is invalid or expired. (log_id l9)");
  });

  it("treats a flat error with HTTP 200 as failure too", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({ error: "invalid_request", error_description: "Bad redirect" }),
        {
          status: 200,
        },
      );
    expect(
      refreshTiktokToken({ config: oauthConfig, refreshToken: "rt", fetchImpl }),
    ).rejects.toThrow("invalid_request: Bad redirect");
  });
});

describe("tiktokChunkPlan", () => {
  it("uploads files up to 64MB as a single whole chunk", () => {
    expect(tiktokChunkPlan(25_000_000)).toEqual({ chunkSize: 25_000_000, totalChunkCount: 1 });
    expect(tiktokChunkPlan(64 * 1024 * 1024)).toEqual({
      chunkSize: 64 * 1024 * 1024,
      totalChunkCount: 1,
    });
  });

  it("lets the final chunk absorb the remainder for larger files", () => {
    const plan = tiktokChunkPlan(100 * 1024 * 1024);
    expect(plan.totalChunkCount).toBe(1);
    expect(plan.chunkSize).toBe(64 * 1024 * 1024);
  });
});

describe("uploadTiktokDraft", () => {
  it("runs init, single-chunk PUT with Content-Range, and polls to SEND_TO_USER_INBOX", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      if (calls.length === 1) {
        return new Response(
          JSON.stringify({
            data: { publish_id: "pub-1", upload_url: "https://upload.tiktok.example/u1" },
            error: { code: "ok" },
          }),
          { status: 200 },
        );
      }
      if (calls.length === 2) return new Response(null, { status: 201 });
      if (calls.length === 3) {
        return new Response(
          JSON.stringify({ data: { status: "PROCESSING_UPLOAD" }, error: { code: "ok" } }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ data: { status: "SEND_TO_USER_INBOX" }, error: { code: "ok" } }),
        { status: 200 },
      );
    };

    const video = new Uint8Array(10);
    const result = await uploadTiktokDraft({
      accessToken: "tok",
      video,
      pollIntervalMs: 1,
      fetchImpl,
      sleep: noSleep,
    });

    expect(result).toEqual({ publishId: "pub-1", status: "SEND_TO_USER_INBOX" });
    const [initCall, putCall] = calls;
    const initBody = JSON.parse(String(initCall?.init.body));
    expect(initBody.source_info).toEqual({
      source: "FILE_UPLOAD",
      video_size: 10,
      chunk_size: 10,
      total_chunk_count: 1,
    });
    const putHeaders = (putCall?.init.headers ?? {}) as Record<string, string>;
    expect(putHeaders["content-range"]).toBe("bytes 0-9/10");
    expect(putCall?.init.method).toBe("PUT");
  });

  it("surfaces TikTok error envelopes (code != ok)", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          error: { code: "spam_risk_too_many_posts", message: "Daily cap reached", log_id: "l1" },
        }),
        { status: 200 },
      );
    expect(
      uploadTiktokDraft({ accessToken: "t", video: new Uint8Array(1), fetchImpl, sleep: noSleep }),
    ).rejects.toThrow("Daily cap reached");
  });

  it("throws when processing ends FAILED", async () => {
    const responses = [
      { data: { publish_id: "p", upload_url: "https://u" }, error: { code: "ok" } },
      null,
      {
        data: { status: "FAILED", fail_reason: "video_format_check_failed" },
        error: { code: "ok" },
      },
    ];
    let call = 0;
    const fetchImpl: FetchLike = async () => {
      const body = responses[Math.min(call, responses.length - 1)];
      call++;
      return body === null
        ? new Response(null, { status: 201 })
        : new Response(JSON.stringify(body), { status: 200 });
    };
    expect(
      uploadTiktokDraft({
        accessToken: "t",
        video: new Uint8Array(1),
        pollIntervalMs: 1,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toThrow("video_format_check_failed");
  });
});
