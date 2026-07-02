import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

export interface GatewayObject {
  arrayBuffer(): Promise<ArrayBuffer>;
  readonly size: number;
  readonly httpMetadata?: { readonly contentType?: string };
}

export interface GatewayBucket {
  get(key: string): Promise<GatewayObject | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
}

class BucketOpError extends Data.TaggedError("BucketOpError")<{ readonly cause: unknown }> {}

const sha256Hex = (bytes: ArrayBuffer): Effect.Effect<string> =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });

const keyFromPath = (pathname: string): string | null => {
  if (!pathname.startsWith("/objects/")) return null;
  const raw = pathname.slice("/objects/".length);
  if (raw.length === 0) return null;
  try {
    return raw.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
};

const text = (status: number, body: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const handleGatewayRequest = (
  request: Request,
  deps: { bucket: GatewayBucket; token: string },
): Effect.Effect<Response> =>
  Effect.gen(function* () {
    const url = new URL(request.url);
    const key = keyFromPath(url.pathname);
    if (key === null) return text(404, "not found");

    if (request.headers.get("x-upload-token") !== deps.token) {
      return text(401, "invalid upload token");
    }

    const bucketOp = <A>(op: () => Promise<A>) =>
      Effect.tryPromise({ try: op, catch: (cause) => new BucketOpError({ cause }) });

    switch (request.method) {
      case "PUT": {
        const bytes = yield* Effect.promise(() => request.arrayBuffer());
        const declared = request.headers.get("x-content-sha256");
        if (!declared) return text(400, "missing x-content-sha256");
        const actual = yield* sha256Hex(bytes);
        if (actual !== declared) {
          return text(400, `sha256 mismatch: declared=${declared} actual=${actual}`);
        }
        const contentType = request.headers.get("content-type") ?? "application/octet-stream";
        yield* bucketOp(() =>
          deps.bucket.put(key, bytes, {
            httpMetadata: { contentType },
            customMetadata: { sha256: actual },
          }),
        );
        return text(200, "ok");
      }
      case "GET": {
        const object = yield* bucketOp(() => deps.bucket.get(key));
        if (!object) return text(404, "not found");
        const body = yield* Effect.promise(() => object.arrayBuffer());
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "content-length": String(object.size),
          },
        });
      }
      case "HEAD": {
        const object = yield* bucketOp(() => deps.bucket.head(key));
        if (!object) return new Response(null, { status: 404 });
        return new Response(null, {
          status: 200,
          headers: {
            "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "content-length": String(object.size),
          },
        });
      }
      default:
        return text(405, "method not allowed");
    }
  }).pipe(
    Effect.catchTag("BucketOpError", (error) =>
      Effect.succeed(text(500, `bucket operation failed: ${String(error.cause)}`)),
    ),
  );
