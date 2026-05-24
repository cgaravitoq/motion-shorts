import { describe, expect, it, vi } from "vitest";
import { getObject, headObject, isR2Configured, putObject } from "../transport";

const gatewayEnv = {
  R2_ACCOUNT_ID: "account",
  R2_BUCKET: "bucket",
  R2_UPLOAD_GATEWAY_URL: "https://gateway.example",
  R2_UPLOAD_GATEWAY_TOKEN: "token",
};

const directEnv = {
  R2_ACCOUNT_ID: "account",
  R2_BUCKET: "bucket",
  R2_ACCESS_KEY_ID_WRITE: "access",
  R2_SECRET_ACCESS_KEY_WRITE: "secret",
};

describe("R2 transport", () => {
  it("detects complete gateway or direct-S3 configuration", () => {
    expect(isR2Configured({ bucket: "bucket", env: gatewayEnv })).toBe(true);
    expect(isR2Configured({ bucket: "bucket", env: directEnv })).toBe(true);
    expect(isR2Configured({ bucket: "bucket", env: { R2_ACCOUNT_ID: "account", R2_BUCKET: "bucket" } })).toBe(false);
  });

  it("uses gateway transport when configured", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    await putObject({
      bucket: "bucket",
      key: "tts-cache/hash/voice.mp3",
      body: Buffer.from("audio"),
      contentType: "audio/mpeg",
      env: gatewayEnv,
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example/objects/tts-cache/hash/voice.mp3",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("returns null for gateway 404 reads", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(getObject({ bucket: "bucket", key: "missing", env: gatewayEnv, fetchImpl })).resolves.toBeNull();
    await expect(headObject({ bucket: "bucket", key: "missing", env: gatewayEnv, fetchImpl })).resolves.toBeNull();
  });

  it("signs direct-S3 requests", async () => {
    const fetchImpl = vi.fn(async () => new Response("audio", { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const result = await getObject({ bucket: "bucket", key: "tts-cache/hash/voice.mp3", env: directEnv, fetchImpl });
    expect(result?.body.toString("utf8")).toBe("audio");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://account.r2.cloudflarestorage.com/bucket/tts-cache/hash/voice.mp3",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ authorization: expect.stringContaining("AWS4-HMAC-SHA256") }),
      }),
    );
  });
});
