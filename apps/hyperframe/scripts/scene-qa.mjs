#!/usr/bin/env bun
/**
 * Per-scene visual QA for the scene-hub — the engine behind the HITL loop.
 *
 *   bun run scripts/scene-qa.mjs <slug> [--scenes=id1,id2] [--frames=3]
 *
 * Pipeline (NO full mp4 render):
 *   1. (re)assemble index.html from scene-spec.json
 *   2. materialise a working copy under out/episodes/<slug> (symlink lib+assets,
 *      inline captions if present) — does NOT touch src/
 *   3. hyperframes snapshot  -> per-scene PNG key frames (entry / mid / late)
 *   4. hyperframes inspect --json -> mechanical overflow/overlap verdict
 *   5. sort frames into renders/<slug>-qa/<scene-id>/ and write report.json
 *
 * --scenes limits work to specific scene ids (iterate ONLY rejected scenes).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { assembleEpisode } from "./lib/assemble-episode.mjs";

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`scene-qa: must run from ${expectedCwd}. Hint: cd apps/hyperframe && bun run scripts/scene-qa.mjs <slug>`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    scenes: { type: "string" },
    frames: { type: "string", default: "3" },
    timeout: { type: "string", default: "10000" },
  },
  allowPositionals: true,
});

const [slug] = positionals;
if (!slug) {
  console.error("scene-qa: missing <slug>");
  process.exit(1);
}

const episodeDir = path.resolve("src/episodes", slug);
const specPath = path.join(episodeDir, "scene-spec.json");
if (!fs.existsSync(specPath)) {
  console.error(`scene-qa: no scene-spec.json at ${path.relative(process.cwd(), specPath)}`);
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
if (!spec.slug) spec.slug = slug;
const built = assembleEpisode(spec);
fs.writeFileSync(path.join(episodeDir, "index.html"), built.html);

// ── materialise (catalog-free, src/ untouched) ────────────────────────────
const workDir = path.resolve("out/episodes", slug);
fs.mkdirSync(workDir, { recursive: true });
let html = built.html;
const captionsPath = path.join(episodeDir, "assets", "captions.json");
if (fs.existsSync(captionsPath)) {
  const raw = fs.readFileSync(captionsPath, "utf8").trim();
  if (raw) {
    const safe = JSON.stringify(JSON.parse(raw)).replace(/<\//g, "<\\/");
    html = html.replace(
      /(<script[^>]*id="captions-data"[^>]*>)([\s\S]*?)(<\/script>)/,
      `$1${safe}$3`,
    );
  }
}
fs.writeFileSync(path.join(workDir, "index.html"), html);

const ensureSymlink = (linkPath, targetAbs) => {
  try {
    fs.lstatSync(linkPath);
    fs.rmSync(linkPath, { force: true, recursive: true });
  } catch {}
  if (fs.existsSync(targetAbs)) fs.symlinkSync(path.relative(path.dirname(linkPath), targetAbs), linkPath, "dir");
};
ensureSymlink(path.join(workDir, "lib"), path.resolve("src/lib"));
ensureSymlink(path.join(workDir, "assets"), path.join(episodeDir, "assets"));
fs.writeFileSync(
  path.join(workDir, "favicon.ico"),
  Buffer.from("47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b", "hex"),
);

// ── pick scenes + sample timestamps ───────────────────────────────────────
const wanted = values.scenes ? new Set(values.scenes.split(",").map((s) => s.trim())) : null;
const scenes = built.scenes.filter((s) => !wanted || wanted.has(s.id));
if (scenes.length === 0) {
  console.error(`scene-qa: no matching scenes (have: ${built.scenes.map((s) => s.id).join(", ")})`);
  process.exit(1);
}

const round = (n) => Number(n.toFixed(2));
for (const sc of scenes) {
  const d = sc.duration;
  sc.samples = [
    { phase: "entry", t: round(sc.start + Math.min(1.2, d * 0.35)) },
    { phase: "mid", t: round(sc.start + d / 2) },
    { phase: "late", t: round(sc.start + d - 0.4) },
  ];
}
const allTimes = [...new Set(scenes.flatMap((s) => s.samples.map((x) => x.t)))].sort((a, b) => a - b);

// ── snapshot + inspect (one Chromium launch each) ─────────────────────────
const run = (args) => {
  const r = spawnSync("bunx", args, { cwd: expectedCwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

console.log(`[scene-qa] ${slug}: ${scenes.length} scene(s), ${allTimes.length} key frames at [${allTimes.join(", ")}]`);
const snap = run(["hyperframes", "snapshot", workDir, "--at", allTimes.join(","), "--timeout", values.timeout]);
if (snap.status !== 0) {
  console.error(`[scene-qa] snapshot failed:\n${snap.stderr}`);
  process.exit(1);
}
const insp = run(["hyperframes", "inspect", workDir, "--json", "--at", allTimes.join(","), "--timeout", values.timeout]);
let inspect = null;
try {
  inspect = JSON.parse(insp.stdout.slice(insp.stdout.indexOf("{")));
} catch {
  console.warn("[scene-qa] could not parse inspect JSON");
}

// ── sort frames into per-scene folders ────────────────────────────────────
const snapDir = path.join(workDir, "snapshots");
const frameFor = (t) => {
  const files = fs.existsSync(snapDir) ? fs.readdirSync(snapDir) : [];
  // hyperframes names frames frame-NN-at-<t>s.png (t may be rounded to 1 dp)
  const exact = files.find((f) => f.includes(`at-${t}s`));
  if (exact) return path.join(snapDir, exact);
  const near = files.find((f) => f.includes(`at-${t.toFixed(1)}s`));
  return near ? path.join(snapDir, near) : null;
};

const qaRoot = path.resolve("renders", `${slug}-qa`);
fs.rmSync(qaRoot, { recursive: true, force: true });
fs.mkdirSync(qaRoot, { recursive: true });

const report = { slug, total: built.totalDuration, inspectOk: inspect?.ok ?? null, inspectIssues: inspect?.issueCount ?? null, scenes: [] };
for (const sc of scenes) {
  const dir = path.join(qaRoot, sc.id);
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  for (const s of sc.samples) {
    const src = frameFor(s.t);
    if (src) {
      const dest = path.join(dir, `${s.phase}-${s.t}s.png`);
      fs.copyFileSync(src, dest);
      frames.push(path.relative(expectedCwd, dest));
    }
  }
  report.scenes.push({ id: sc.id, type: sc.type, track: sc.track, window: [sc.start, round(sc.start + sc.duration)], frames });
}

fs.writeFileSync(path.join(qaRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`[scene-qa] wrote ${path.relative(expectedCwd, qaRoot)}/ (report.json + per-scene frames)`);
console.log(`[scene-qa] inspect: ${inspect ? `ok=${inspect.ok} issues=${inspect.issueCount}` : "unavailable"}`);
console.table(report.scenes.map((s) => ({ id: s.id, type: s.type, window: s.window.join("-"), frames: s.frames.length })));
if (inspect && !inspect.ok) {
  console.log(`[scene-qa] INSPECT ISSUES:\n${JSON.stringify(inspect.issues, null, 2)}`);
}
