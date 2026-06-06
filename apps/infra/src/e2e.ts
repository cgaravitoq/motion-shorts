#!/usr/bin/env bun
/**
 * E2E contract check against a DEPLOYED upload-gateway (e2e stage).
 *
 *   bun run deploy:e2e                # prints gatewayUrl in the stack output
 *   GATEWAY_URL=https://... bun run e2e
 *
 * Exercises the exact consumer contract (r2-artifacts/r2-client) over the
 * network: auth, PUT+sha256 verify, GET round-trip, HEAD, 404. Uses plain
 * fetch on purpose — independent from the pipeline code under test.
 */
const gatewayUrl = (Bun.env.GATEWAY_URL ?? "").replace(/\/$/, "");
const token = Bun.env.R2_UPLOAD_GATEWAY_TOKEN ?? "";
if (!gatewayUrl || !token) {
  console.error("e2e: set GATEWAY_URL and R2_UPLOAD_GATEWAY_TOKEN");
  process.exit(1);
}

const key = `e2e/${Date.now()}/clip one.mp4`;
const objectUrl = `${gatewayUrl}/objects/${key.split("/").map(encodeURIComponent).join("/")}`;
const body = new TextEncoder().encode(`e2e-bytes-${Date.now()}`);
const digest = await crypto.subtle.digest("SHA-256", body);
const hash = Array.from(new Uint8Array(digest))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const unauthorized = await fetch(objectUrl, { method: "GET" });
check("GET without token is 401", unauthorized.status === 401, `got ${unauthorized.status}`);

const badSha = await fetch(objectUrl, {
  method: "PUT",
  headers: {
    "x-upload-token": token,
    "x-content-sha256": "0".repeat(64),
    "content-type": "video/mp4",
  },
  body,
});
check("PUT with wrong sha256 is 400", badSha.status === 400, `got ${badSha.status}`);

const put = await fetch(objectUrl, {
  method: "PUT",
  headers: { "x-upload-token": token, "x-content-sha256": hash, "content-type": "video/mp4" },
  body,
});
check("PUT with valid sha256 is 200", put.status === 200, `got ${put.status}`);

const get = await fetch(objectUrl, { method: "GET", headers: { "x-upload-token": token } });
const remote = new Uint8Array(await get.arrayBuffer());
check("GET round-trips the exact bytes", get.status === 200 && Buffer.compare(remote, body) === 0);
check("GET preserves content-type", get.headers.get("content-type") === "video/mp4");

const head = await fetch(objectUrl, { method: "HEAD", headers: { "x-upload-token": token } });
check(
  "HEAD reports content-length",
  head.status === 200 && head.headers.get("content-length") === String(body.byteLength),
);

const missing = await fetch(`${gatewayUrl}/objects/e2e/does-not-exist`, {
  method: "GET",
  headers: { "x-upload-token": token },
});
check("GET for a missing key is 404", missing.status === 404, `got ${missing.status}`);

console.log(failures === 0 ? "\ne2e contract: ALL GREEN" : `\ne2e contract: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

export {};
