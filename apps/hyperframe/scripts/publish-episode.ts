#!/usr/bin/env bun
/**
 * Publish an approved episode to a platform (Gate 2 of the distribution flow).
 *
 *   bun run publish:episode <slug> --platform=youtube|instagram [options]
 *
 * Options:
 *   --lang=es|en          Copy language (default: scene-spec lang, else es)
 *   --privacy=private|unlisted|public   YouTube only (default: private)
 *   --confirm             Actually publish. Without it, prints the publish
 *                         plan and exits non-zero (Gate 2 is explicit).
 *
 * Preconditions enforced: the platform's copy is "approved" in
 * distribution.json AND its renderRef.sha256 matches the current
 * render.remote.json — stale approvals never publish. Results land in
 * publish.remote.json (local + R2 manifests).
 *
 * TikTok uses the Upload-as-Draft inbox flow: the video lands in your
 * TikTok inbox and you finish the post in the app (the API takes no
 * caption — the approved caption is printed for pasting). LinkedIn stays
 * manual.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type PublishRecord, readStoredToken, upsertPublishRecord } from "@cgaravitoq/publish";
import { decodePublishLedger, formatParseError, type PublishLedger } from "@cgaravitoq/spec";
import { Result } from "effect";
import { validateDistribution } from "./lib/distribution-spec";
import { resolveEpisodeContext } from "./lib/episode-context";
import { redactPublishError, runPublish } from "./lib/publish-handlers";
import {
  assertR2Config,
  loadWorkspaceEnv,
  objectKeyFor,
  sha256Hex,
  uploadAndVerifyObject,
} from "./lib/r2-artifacts";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`publish-episode: must run from ${expectedCwd}`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: "string" },
    lang: { type: "string" },
    privacy: { type: "string", default: "private" },
    confirm: { type: "boolean", default: false },
  },
});

const slug = positionals[0];
const platformArg = values.platform;
function fail(message: string): never {
  console.error(`publish-episode: ${message}`);
  process.exit(1);
}

if (!slug || !platformArg)
  fail("usage: bun run publish:episode <slug> --platform=youtube|instagram|tiktok [--confirm]");
if (platformArg === "linkedin") {
  fail(
    "linkedin is a manual platform — paste the approved copy from distribution.json (direct posting needs a 60-day OAuth re-consent cycle; see docs/research)",
  );
}
if (platformArg !== "youtube" && platformArg !== "instagram" && platformArg !== "tiktok")
  fail(`unknown platform "${platformArg}"`);
if (!["private", "unlisted", "public"].includes(values.privacy))
  fail(`invalid --privacy=${values.privacy}`);

const platform: "youtube" | "instagram" | "tiktok" = platformArg;
const privacy = values.privacy as "private" | "unlisted" | "public";

loadWorkspaceEnv();
const episodeDir = path.join("src/episodes", slug);
const distPath = path.join(episodeDir, "distribution.json");
if (!fs.existsSync(distPath))
  fail(`no distribution.json at ${distPath} — run generate-distribution-copy first`);
const dist = JSON.parse(fs.readFileSync(distPath, "utf8"));
const block = dist.platforms?.[platform];
if (!block) fail(`distribution.json has no ${platform} copy`);
if (block.status !== "approved")
  fail(`${platform} copy is "${block.status}" — Gate 1 approval required before publishing`);

const context = resolveEpisodeContext(slug);
if (!context.renderRef)
  fail(
    "episode has no rendered mp4 in render.remote.json — publish the render first (--upload=r2)",
  );
const renderRef = context.renderRef;
if (dist.renderRef?.sha256 !== renderRef.sha256) {
  fail(
    "renderRef.sha256 in distribution.json does not match the current render — re-review the copy against the new cut",
  );
}

// Boundary check: an invalid distribution.json never half-publishes. The
// canonical validator (the same one copy:check runs) gates Gate 2 too.
const distValidation = validateDistribution(dist, { renderSha256: renderRef.sha256 });
if (!distValidation.ok) {
  fail(`distribution.json is invalid:\n  ${distValidation.errors.join("\n  ")}`);
}

const lang = values.lang ?? (context.spec?.lang as string | undefined) ?? "es";
const copy = block[lang] as
  | { title: string; description: string; caption: string }
  | undefined;
if (!copy) fail(`${platform} copy has no "${lang}" language block`);

const SECRETS_DIR = path.join(expectedCwd, ".secrets");
const token = readStoredToken(SECRETS_DIR, platform);
if (!token) fail(`no ${platform} credentials — run: bun run publish:auth ${platform}`);

const summary: Record<string, string> = {
  slug,
  platform,
  lang,
  renderSha256: renderRef.sha256,
  r2Key: renderRef.key,
  ...(platform === "youtube"
    ? { privacy }
    : { account: token.username ? `@${token.username}` : (token.igUserId ?? token.openId ?? "") }),
};
console.log("Publish plan:");
for (const [key, value] of Object.entries(summary)) console.log(`  ${key}: ${value}`);
// Gate 2 must be informed: show the exact text that will go live, verbatim.
if (platform === "youtube") {
  console.log(
    `\n--- title (${lang}) ---\n${copy.title}\n--- description (${lang}) ---\n${copy.description}`,
  );
} else {
  console.log(`\n--- caption (${lang}) ---\n${copy.caption}`);
}

if (!values.confirm) {
  console.log(
    "\nGate 2: nothing published. Re-run with --confirm once the user explicitly approves this plan.",
  );
  process.exit(1);
}

const ledgerPath = path.join(episodeDir, "publish.remote.json");
const readLedger = (): PublishLedger | null => {
  if (!fs.existsSync(ledgerPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const decoded = decodePublishLedger(parsed);
  if (Result.isFailure(decoded)) {
    fail(
      `malformed publish ledger at ${ledgerPath}:\n  ${formatParseError(decoded.failure, "ledger").join("\n  ")}`,
    );
  }
  return parsed;
};
const writeLedger = (record: PublishRecord): PublishLedger => {
  const ledger = upsertPublishRecord({
    ledger: readLedger(),
    slug,
    platform,
    record,
    now: new Date(),
  });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  return ledger;
};

// The pin gate only compares manifests; the local file is regenerable cache
// and may be a stale cut. Never upload bytes that don't match the pin.
const verifiedLocalMp4 = async (): Promise<string> => {
  const localMp4 = path.join("renders", `${slug}.mp4`);
  if (!fs.existsSync(localMp4)) {
    fail(`no local mp4 at ${localMp4} — hydrate it first: bun run hydrate:episode ${slug} --final`);
  }
  const localSha = await sha256Hex(localMp4);
  if (localSha !== renderRef.sha256) {
    fail(
      `${localMp4} sha256 (${localSha.slice(0, 12)}…) does not match the pinned render (${renderRef.sha256.slice(0, 12)}…) — re-hydrate: bun run hydrate:episode ${slug} --final`,
    );
  }
  return localMp4;
};

const uploadLedgerToR2 = async (): Promise<void> => {
  const config = assertR2Config(Bun.env);
  await uploadAndVerifyObject({
    config,
    filePath: ledgerPath,
    key: objectKeyFor({ slug, category: "manifests", filename: "publish.remote.json" }),
  });
};

// Idempotent re-run: this exact cut is already live on the platform — only
// re-sync the ledger to R2 (covers a previous run where the video published
// but the ledger upload failed) instead of double-publishing.
const existing = readLedger()?.platforms?.[platform];
if (existing?.status === "published" && existing.renderSha256 === renderRef.sha256) {
  console.log(
    `\nalready published to ${platform} for this exact render${existing.url ? ` — ${existing.url}` : ""}; syncing the ledger to R2`,
  );
  await uploadLedgerToR2();
  console.log(`✓ ledger synced: ${ledgerPath} (+R2)`);
  process.exit(0);
}

let outcome: { id: string; url?: string; privacy?: string; ledgerStatus?: "inbox" };
try {
  // Gate-2 orchestrator: the explicit --confirm above has already passed; this
  // dispatches to the per-platform handler and writes the publish ledger
  // (success or redacted failure) once, centrally.
  outcome = await runPublish({
    platform,
    privacy,
    lang,
    writeLedger,
    handlerCtx: {
      token,
      copy,
      renderRef,
      secretsDir: SECRETS_DIR,
      verifiedLocalMp4,
      env: Bun.env,
      log: (message) => console.log(message),
    },
  });
} catch (err) {
  fail(`publish failed (recorded in ${ledgerPath}): ${redactPublishError(err)}`);
}
const result = outcome;
if (platform === "tiktok") {
  console.log(`\n✓ draft sent to your TikTok inbox (publish_id ${result.id})`);
  console.log(
    "  Open the TikTok app → inbox notification → edit the draft → PASTE this caption → publish:",
  );
  console.log(`\n${copy.caption}\n`);
} else {
  console.log(`\n✓ published ${slug} to ${platform}${result.url ? ` — ${result.url}` : ""}`);
}

try {
  await uploadLedgerToR2();
  console.log(`✓ ledger updated: ${ledgerPath} (+R2)`);
} catch (err) {
  console.error(
    `publish-episode: WARNING — the video is live and the local ledger is updated, but the R2 ledger upload failed: ${redactPublishError(err)}`,
  );
  console.error(
    "  Re-run the same command to sync it — the re-run is idempotent and will NOT re-publish this render.",
  );
}
if (platform === "youtube" && privacy !== "public") {
  console.log(`  note: video is ${privacy} — flip to public in YouTube Studio when ready`);
}
