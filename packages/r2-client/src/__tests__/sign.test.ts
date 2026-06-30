import { describe, expect, it } from "vitest";
import { createCanonicalRequest, createStringToSign, signRequest } from "../sign";

const config = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  endpoint: "https://example.r2.cloudflarestorage.com",
  endpointPrefix: "/bucket",
};
const now = new Date("2015-08-30T12:36:00.000Z");
const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("signRequest", () => {
  it("builds a deterministic canonical request and string-to-sign", () => {
    const { canonicalRequest, amzDate } = createCanonicalRequest({
      config,
      method: "PUT",
      key: "tts-cache/hash/voice.mp3",
      payloadHash,
      headers: { "content-type": "audio/mpeg" },
      now,
    });
    expect(canonicalRequest).toBe(
      [
        "PUT",
        "/bucket/tts-cache/hash/voice.mp3",
        "",
        "content-type:audio/mpeg\nhost:example.r2.cloudflarestorage.com\nx-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nx-amz-date:20150830T123600Z\n",
        "content-type;host;x-amz-content-sha256;x-amz-date",
        payloadHash,
      ].join("\n"),
    );
    expect(createStringToSign(canonicalRequest, amzDate)).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20150830T123600Z",
        "20150830/auto/s3/aws4_request",
        "8f4405c7d016534670f3733aca2a17b9497a390af22617a696b7a859118fad56",
      ].join("\n"),
    );
  });

  it("adds SigV4 authorization headers", () => {
    const signed = signRequest({
      config,
      method: "GET",
      key: "folder/file name.json",
      payloadHash: "UNSIGNED-PAYLOAD",
      now,
    });
    expect(signed.url).toBe(
      "https://example.r2.cloudflarestorage.com/bucket/folder/file%20name.json",
    );
    expect(signed.headers.authorization).toContain(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/auto/s3/aws4_request",
    );
    expect(signed.headers.authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date",
    );
  });

  it("uses one timestamp for default-now signing", () => {
    const signed = signRequest({
      config,
      method: "GET",
      key: "folder/file name.json",
      payloadHash: "UNSIGNED-PAYLOAD",
    });
    const authorization = signed.headers.authorization ?? "";
    const amzDate = signed.headers["x-amz-date"] ?? "";
    const credentialScope = authorization.match(/Credential=AKIDEXAMPLE\/(\d{8})\//)?.[1];

    expect(amzDate).toMatch(/^\d{8}T\d{6}Z$/);
    expect(amzDate.slice(0, 8)).toBe(credentialScope);
  });
});
