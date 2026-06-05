#!/usr/bin/env bun
/**
 * Voice-gate the LinkedIn copy of an episode against the humanizer critic
 * rubric (hybrid contract: LinkedIn is personal voice; the other platforms
 * are channel style and skip this gate).
 *
 *   bun run copy:gate <slug> [--llm-signals=<file>] [--humanizer=<repo-path>]
 *
 * Imports loadVoiceProfile/runCritic from the humanizer repo source (bun
 * transpiles TS in place, resolving humanizer's own workspace deps). Without
 * --llm-signals only the 5 deterministic signals gate (partial verdict); pass
 * the in-session critic agent's JSON output for the full 8-signal verdict.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadWorkspaceEnv } from "./lib/r2-artifacts.mjs";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`copy-voice-gate: must run from ${expectedCwd}`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "llm-signals": { type: "string" },
    humanizer: { type: "string" },
  },
});

const slug = positionals[0];
if (!slug) {
  console.error("usage: bun run copy:gate <slug> [--llm-signals=<file>] [--humanizer=<repo-path>]");
  process.exit(1);
}

const distPath = path.join("src/episodes", slug, "distribution.json");
if (!fs.existsSync(distPath)) {
  console.error(
    `copy-voice-gate: no distribution.json at ${distPath} — run generate-distribution-copy first`,
  );
  process.exit(1);
}
const dist = JSON.parse(fs.readFileSync(distPath, "utf8"));
const linkedin = dist.platforms?.linkedin;
if (!linkedin) {
  console.log("copy-voice-gate: episode has no linkedin copy — nothing to gate");
  process.exit(0);
}

loadWorkspaceEnv();
const expandHome = (p) => (p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);
const humanizerRepo = path.resolve(
  expandHome(
    values.humanizer ??
      process.env.HUMANIZER_REPO_PATH ??
      path.join(os.homedir(), "Developer/humanizer"),
  ),
);
const criticEntry = path.join(humanizerRepo, "packages/critic-rubric/src/index.ts");
const profileEntry = path.join(humanizerRepo, "packages/voice-profile/src/index.ts");
if (!fs.existsSync(criticEntry) || !fs.existsSync(profileEntry)) {
  console.error(
    `copy-voice-gate: humanizer repo not found at ${humanizerRepo} (set --humanizer or HUMANIZER_REPO_PATH)`,
  );
  process.exit(1);
}

const { adaptCriticAgentSignals, runCritic, scoreThresholdsFor } = await import(criticEntry);
const { loadVoiceProfile } = await import(profileEntry);
const voiceProfile = await loadVoiceProfile();

let llmSignals;
if (values["llm-signals"]) {
  const criticOutput = JSON.parse(fs.readFileSync(path.resolve(values["llm-signals"]), "utf8"));
  llmSignals = adaptCriticAgentSignals(criticOutput, scoreThresholdsFor(voiceProfile, "linkedin"));
}

const DETERMINISTIC = [
  "lexical_burstiness",
  "specificity",
  "forbidden_phrases",
  "emoji_density",
  "forced_closing",
];

let failed = 0;
for (const lang of ["es", "en"]) {
  const draft = linkedin[lang]?.post;
  if (!draft) continue;

  const result = runCritic({
    draft,
    voiceProfile,
    platform: "linkedin",
    locale: lang,
    iteration: 1,
    llmSignals,
  });

  const failures = llmSignals
    ? result.failures
    : result.failures.filter((f) => DETERMINISTIC.includes(f.signal));
  const passed = llmSignals ? result.passed : failures.length === 0;
  const mode = llmSignals ? "full 8-signal" : "partial (5 deterministic signals)";

  console.log(`\nlinkedin.${lang} — ${mode} — ${passed ? "✓ PASS" : "✗ FAIL"}`);
  for (const [signal, score] of Object.entries(result.scores)) {
    if (!llmSignals && !DETERMINISTIC.includes(signal)) continue;
    console.log(`    ${signal}: ${score}`);
  }
  if (llmSignals) console.log(`    mean_score: ${result.mean_score} (gate ≥ 7.5)`);
  for (const f of failures) {
    console.log(`    ✗ ${f.signal}: ${f.detail}`);
    if (f.suggested_fix) console.log(`      fix: ${f.suggested_fix}`);
  }
  if (passed && !llmSignals) {
    console.log("    note: run with --llm-signals=<critic-output.json> for the full verdict");
  }
  if (!passed) failed++;
}

process.exit(failed > 0 ? 1 : 0);
