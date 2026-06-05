import { describe, expect, it } from "bun:test";
import { Effect, Either } from "effect";
import { fetchWithRetry, fetchWithRetryPromise, type FetchLike } from "./http";

const scripted = (responses: Array<() => Response | Error>): { fetchImpl: FetchLike; calls: () => number } => {
  let call = 0;
  return {
    fetchImpl: async () => {
      const next = responses[Math.min(call, responses.length - 1)];
      call++;
      const result = next?.();
      if (result instanceof Error) throw result;
      if (!result) throw new Error("script exhausted");
      return result;
    },
    calls: () => call,
  };
};

const fast = { baseDelayMs: 1, timeoutMs: 1000 };

describe("fetchWithRetry", () => {
  it("retries transient 5xx and resolves with the eventual success", async () => {
    const { fetchImpl, calls } = scripted([
      () => new Response("boom", { status: 500 }),
      () => new Response("boom", { status: 502 }),
      () => new Response("ok", { status: 200 }),
    ]);
    const response = await Effect.runPromise(fetchWithRetry("https://x.test/a", undefined, { ...fast, fetchImpl }));
    expect(response.status).toBe(200);
    expect(calls()).toBe(3);
  });

  it("retries 429 rate limits", async () => {
    const { fetchImpl, calls } = scripted([
      () => new Response("slow down", { status: 429 }),
      () => new Response("ok", { status: 200 }),
    ]);
    const response = await Effect.runPromise(fetchWithRetry("https://x.test/b", undefined, { ...fast, fetchImpl }));
    expect(response.status).toBe(200);
    expect(calls()).toBe(2);
  });

  it("does not retry client errors — resolves with the 4xx response", async () => {
    const { fetchImpl, calls } = scripted([() => new Response("nope", { status: 404 })]);
    const response = await Effect.runPromise(fetchWithRetry("https://x.test/c", undefined, { ...fast, fetchImpl }));
    expect(response.status).toBe(404);
    expect(calls()).toBe(1);
  });

  it("resolves with the last transient response once retries are exhausted", async () => {
    const { fetchImpl, calls } = scripted([() => new Response("busy", { status: 503 })]);
    const response = await Effect.runPromise(
      fetchWithRetry("https://x.test/d", undefined, { ...fast, retries: 2, fetchImpl }),
    );
    expect(response.status).toBe(503);
    expect(calls()).toBe(3);
  });

  it("fails with a tagged HttpRequestError on persistent network failure", async () => {
    const { fetchImpl, calls } = scripted([() => new Error("ECONNRESET")]);
    const result = await Effect.runPromise(
      Effect.either(fetchWithRetry("https://x.test/e", undefined, { ...fast, retries: 1, fetchImpl })),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("HttpRequestError");
      expect(result.left.message).toContain("ECONNRESET");
    }
    expect(calls()).toBe(2);
  });

  it("recovers when the network heals mid-retry", async () => {
    const { fetchImpl } = scripted([
      () => new Error("ECONNRESET"),
      () => new Response("ok", { status: 200 }),
    ]);
    const response = await Effect.runPromise(fetchWithRetry("https://x.test/f", undefined, { ...fast, fetchImpl }));
    expect(response.status).toBe(200);
  });

  it("fails with a tagged HttpTimeoutError when every attempt times out", async () => {
    const never: FetchLike = () => new Promise<Response>(() => {});
    const result = await Effect.runPromise(
      Effect.either(
        fetchWithRetry("https://x.test/g", undefined, { baseDelayMs: 1, timeoutMs: 10, retries: 1, fetchImpl: never }),
      ),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("HttpTimeoutError");
    }
  });

  it("rethrows the original tagged error through the Promise bridge", async () => {
    const { fetchImpl } = scripted([() => new Error("ENOTFOUND")]);
    await expect(
      fetchWithRetryPromise("https://x.test/h", undefined, { ...fast, retries: 0, fetchImpl }),
    ).rejects.toThrow("ENOTFOUND");
  });
});
