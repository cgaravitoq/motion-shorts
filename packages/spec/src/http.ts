import { Data, Duration, Effect, Schedule } from "effect";
import { runPromiseOrThrow } from "./run";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class HttpRequestError extends Data.TaggedError("HttpRequestError")<{
  readonly url: string;
  readonly cause: unknown;
}> {
  override get message(): string {
    const detail = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `request to ${this.url} failed: ${detail}`;
  }
}

export class HttpTimeoutError extends Data.TaggedError("HttpTimeoutError")<{
  readonly url: string;
  readonly timeoutMs: number;
}> {
  override get message(): string {
    return `request to ${this.url} timed out after ${this.timeoutMs}ms`;
  }
}

// Internal: a 429/5xx response modeled as a failure so Schedule drives the
// retries; converted back to the plain Response once retries are exhausted.
class RetryableStatus extends Data.TaggedError("RetryableStatus")<{
  readonly response: Response;
}> {}

export const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

export interface FetchRetryOptions {
  /** Per-attempt timeout. Default 60s. */
  readonly timeoutMs?: number;
  /** Extra attempts after the first one. Default 4. */
  readonly retries?: number;
  /** Seed for the exponential backoff (doubles each retry, jittered). Default 500ms. */
  readonly baseDelayMs?: number;
  readonly fetchImpl?: FetchLike;
}

/**
 * fetch with per-attempt timeout and exponential backoff + jitter on
 * transient failures (network errors, timeouts, 429/5xx). Resolves with the
 * final Response — callers keep their own response.ok handling, so this is a
 * drop-in replacement for a bare fetch/fetchWithTimeout.
 */
export const fetchWithRetry = (
  url: string,
  init?: RequestInit,
  { timeoutMs = 60_000, retries = 4, baseDelayMs = 500, fetchImpl = fetch }: FetchRetryOptions = {},
): Effect.Effect<Response, HttpRequestError | HttpTimeoutError> => {
  const attempt = Effect.tryPromise({
    try: (signal) => fetchImpl(url, { ...init, signal }),
    catch: (cause) => new HttpRequestError({ url, cause }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: Duration.millis(timeoutMs),
      orElse: () => Effect.fail(new HttpTimeoutError({ url, timeoutMs })),
    }),
    Effect.filterOrFail(
      (response) => !isRetryableStatus(response.status),
      (response) => new RetryableStatus({ response }),
    ),
  );

  const backoff = Schedule.exponential(Duration.millis(baseDelayMs)).pipe(
    Schedule.jittered,
    Schedule.both(Schedule.recurs(retries)),
  );

  return attempt.pipe(
    Effect.retry(backoff),
    Effect.catchTag("RetryableStatus", (error) => Effect.succeed(error.response)),
  );
};

/** Promise bridge for the imperative pipeline scripts; rethrows the original tagged error. */
export const fetchWithRetryPromise = (
  url: string,
  init?: RequestInit,
  options?: FetchRetryOptions,
): Promise<Response> => runPromiseOrThrow(fetchWithRetry(url, init, options));
