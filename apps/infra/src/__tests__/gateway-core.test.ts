import { describe, expect, it } from "bun:test";
import * as Effect from "effect/Effect";
import { type GatewayBucket, handleGatewayRequest } from "../gateway-core";

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const memoryBucket = (): GatewayBucket & {
  store: Map<string, { bytes: ArrayBuffer; contentType?: string; meta?: Record<string, string> }>;
} => {
  const store = new Map<
    string,
    { bytes: ArrayBuffer; contentType?: string; meta?: Record<string, string> }
  >();
  return {
    store,
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        arrayBuffer: async () => entry.bytes,
        size: entry.bytes.byteLength,
        httpMetadata: { contentType: entry.contentType },
      };
    },
    async put(key, value, options) {
      store.set(key, {
        bytes: value,
        contentType: options?.httpMetadata?.contentType,
        meta: options?.customMetadata,
      });
    },
    async head(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return { size: entry.bytes.byteLength, httpMetadata: { contentType: entry.contentType } };
    },
  };
};

const TOKEN = "secret-token";
const KEY = "motion-shorts/episodes/demo-short/final/renders/demo short.mp4";
const encodedKey = KEY.split("/").map(encodeURIComponent).join("/");
const urlFor = (key: string) => `https://gw.test/objects/${key}`;

const run = (request: Request, bucket: GatewayBucket) =>
  Effect.runPromise(handleGatewayRequest(request, { bucket, token: TOKEN }));

describe("upload-gateway contract", () => {
  it("rejects a missing or wrong token with 401", async () => {
    const bucket = memoryBucket();
    const noToken = await run(new Request(urlFor(encodedKey), { method: "GET" }), bucket);
    expect(noToken.status).toBe(401);
    const badToken = await run(
      new Request(urlFor(encodedKey), { method: "GET", headers: { "x-upload-token": "nope" } }),
      bucket,
    );
    expect(badToken.status).toBe(401);
  });

  it("rejects paths outside /objects/ with 404", async () => {
    const bucket = memoryBucket();
    const response = await run(
      new Request("https://gw.test/health", {
        method: "GET",
        headers: { "x-upload-token": TOKEN },
      }),
      bucket,
    );
    expect(response.status).toBe(404);
  });

  it("PUT verifies sha256, stores content-type and round-trips through GET", async () => {
    const bucket = memoryBucket();
    const body = new TextEncoder().encode("video-bytes");
    const hash = await sha256(body);

    const put = await run(
      new Request(urlFor(encodedKey), {
        method: "PUT",
        headers: {
          "x-upload-token": TOKEN,
          "x-content-sha256": hash,
          "content-type": "video/mp4",
        },
        body,
      }),
      bucket,
    );
    expect(put.status).toBe(200);
    expect(bucket.store.get(KEY)?.meta?.sha256).toBe(hash);

    const get = await run(
      new Request(urlFor(encodedKey), { method: "GET", headers: { "x-upload-token": TOKEN } }),
      bucket,
    );
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toBe("video/mp4");
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(body);
  });

  it("PUT fails with 400 on sha256 mismatch and stores nothing", async () => {
    const bucket = memoryBucket();
    const response = await run(
      new Request(urlFor(encodedKey), {
        method: "PUT",
        headers: {
          "x-upload-token": TOKEN,
          "x-content-sha256": "0".repeat(64),
          "content-type": "video/mp4",
        },
        body: new TextEncoder().encode("video-bytes"),
      }),
      bucket,
    );
    expect(response.status).toBe(400);
    expect(bucket.store.size).toBe(0);
  });

  it("PUT fails with 400 when x-content-sha256 is missing", async () => {
    const bucket = memoryBucket();
    const response = await run(
      new Request(urlFor(encodedKey), {
        method: "PUT",
        headers: { "x-upload-token": TOKEN },
        body: new TextEncoder().encode("x"),
      }),
      bucket,
    );
    expect(response.status).toBe(400);
  });

  it("GET returns 404 for a missing key", async () => {
    const bucket = memoryBucket();
    const response = await run(
      new Request(urlFor(encodedKey), { method: "GET", headers: { "x-upload-token": TOKEN } }),
      bucket,
    );
    expect(response.status).toBe(404);
  });

  it("HEAD reports size and content-type without a body", async () => {
    const bucket = memoryBucket();
    const body = new TextEncoder().encode("audio-bytes");
    await bucket.put(KEY, body.buffer as ArrayBuffer, {
      httpMetadata: { contentType: "audio/mpeg" },
    });

    const found = await run(
      new Request(urlFor(encodedKey), { method: "HEAD", headers: { "x-upload-token": TOKEN } }),
      bucket,
    );
    expect(found.status).toBe(200);
    expect(found.headers.get("content-length")).toBe(String(body.byteLength));
    expect(found.headers.get("content-type")).toBe("audio/mpeg");

    const missing = await run(
      new Request("https://gw.test/objects/nope", {
        method: "HEAD",
        headers: { "x-upload-token": TOKEN },
      }),
      bucket,
    );
    expect(missing.status).toBe(404);
  });

  it("rejects unsupported methods with 405", async () => {
    const bucket = memoryBucket();
    const response = await run(
      new Request(urlFor(encodedKey), { method: "DELETE", headers: { "x-upload-token": TOKEN } }),
      bucket,
    );
    expect(response.status).toBe(405);
  });

  it("returns 500 when the bucket binding fails", async () => {
    const broken: GatewayBucket = {
      get: () => Promise.reject(new Error("binding exploded")),
      put: () => Promise.reject(new Error("binding exploded")),
      head: () => Promise.reject(new Error("binding exploded")),
    };
    const response = await run(
      new Request(urlFor(encodedKey), { method: "GET", headers: { "x-upload-token": TOKEN } }),
      broken,
    );
    expect(response.status).toBe(500);
  });
});
