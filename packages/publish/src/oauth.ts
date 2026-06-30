import type { FetchLike } from "./fetch-like";

/**
 * Shared OAuth transport for the publish clients. All three platforms exchange
 * and refresh tokens by POSTing a form-urlencoded body to a token endpoint and
 * reading a JSON token response; the only per-platform variation is the JSON
 * shape and how failures are surfaced. `postTokenForm` centralises the
 * transport and lets each client plug in its own response parser so existing
 * error contracts stay byte-identical.
 */
export const postTokenForm = async <T>({
  endpoint,
  body,
  fetchImpl = fetch,
  parse,
}: {
  endpoint: string;
  body: URLSearchParams;
  fetchImpl?: FetchLike;
  parse: (response: Response) => Promise<T>;
}): Promise<T> => {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return parse(response);
};

/**
 * Reads a JSON body, throwing a `${what} failed: <status> <text>` error on a
 * non-2xx response. Shared by the clients whose token endpoints return a flat
 * JSON success body and a plain HTTP error (YouTube). Endpoints with envelope
 * error shapes (TikTok, Instagram) keep their own parsers.
 */
export const assertOkJson = async <T>(response: Response, what: string): Promise<T> => {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${what} failed: ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
    );
  }
  return (await response.json()) as T;
};
