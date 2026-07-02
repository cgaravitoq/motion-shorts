#!/usr/bin/env bun
/**
 * Per-scene visual QA for the scene-hub — the engine behind the HITL loop.
 *
 *   bun run scripts/scene-qa.ts <slug> [--scenes=id1,id2] [--frames=1|3]
 *
 * Pipeline (NO full mp4 render):
 *   1. (re)assemble index.html from scene-spec.json
 *   2. materialise a working copy under out/episodes/<slug> (symlink lib+assets,
 *      inline captions if present) — does NOT touch src/
 *   3. hyperframes snapshot  -> one settled "final" PNG per scene (default), plus
 *      a contact-sheet.jpg grid of every sampled scene for one-glance review.
 *      --frames=3 restores entry/mid/late key frames for motion debugging.
 *   4. hyperframes inspect --json -> mechanical overflow/overlap verdict
 *   5. sort frames into renders/<slug>-qa/<scene-id>/ and write report.json
 *
 * --scenes limits work to specific scene ids (iterate ONLY rejected scenes);
 * other scenes' frames and report entries are preserved and merged.
 *
 * HITL contract: the reviewing agent shows contact-sheet.jpg (or the per-scene
 * frame) directly in the chat/session — the user never browses folders.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { assembleEpisode, type SceneMapEntry } from "./lib/assemble-episode";
import { materialiseEpisode } from "./lib/materialise-episode";

interface Sample {
  phase: string;
  t: number;
}

type QaScene = SceneMapEntry & { samples: Sample[] };

interface ReportScene {
  id: string;
  type: string;
  track: number;
  window: number[];
  frames: string[];
}

interface InspectResult {
  ok?: boolean;
  issueCount?: number;
  issues?: unknown;
}

interface Report {
  slug: string;
  total: number;
  inspectOk: boolean | null;
  inspectIssues: number | null;
  scenes: ReportScene[];
  contactSheets: string[];
}

const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(`scene-qa: must run from ${expectedCwd}. Hint: cd apps/hyperframe && bun run scripts/scene-qa.ts <slug>`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    scenes: { type: "string" },
    frames: { type: "string", default: "1" },
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

const spec: { slug?: string } & Record<string, unknown> = JSON.parse(fs.readFileSync(specPath, "utf8"));
if (!spec.slug) spec.slug = slug;
const built = assembleEpisode(spec);
fs.writeFileSync(path.join(episodeDir, "index.html"), built.html);

// ── materialise (catalog-free, src/ untouched) ────────────────────────────
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
const workDir = materialiseEpisode({
  workDir: path.resolve("out/episodes", slug),
  html,
  libTarget: path.resolve("src/lib"),
  assetsTarget: path.join(episodeDir, "assets"),
});

// ── pick scenes + sample timestamps ───────────────────────────────────────
const wanted = values.scenes ? new Set(values.scenes.split(",").map((s) => s.trim())) : null;
const scenes = built.scenes.filter((s) => !wanted || wanted.has(s.id)) as QaScene[];
if (scenes.length === 0) {
  console.error(`scene-qa: no matching scenes (have: ${built.scenes.map((s) => s.id).join(", ")})`);
  process.exit(1);
}

const round = (n: number): number => Number(n.toFixed(2));
const threeFrames = values.frames === "3";
for (const sc of scenes) {
  const d = sc.duration;
  // "final" = fully revealed but before the outgoing crossfade (starts at end-0.55s)
  sc.samples = threeFrames
    ? [
        { phase: "entry", t: round(sc.start + Math.min(1.2, d * 0.35)) },
        { phase: "mid", t: round(sc.start + d / 2) },
        { phase: "late", t: round(sc.start + d - 0.4) },
      ]
    : [{ phase: "final", t: round(sc.start + Math.max(d * 0.6, d - 0.8)) }];
}
const allTimes = [...new Set(scenes.flatMap((s) => s.samples.map((x) => x.t)))].sort((a, b) => a - b);

// ── snapshot + inspect (one Chromium launch each) ─────────────────────────
const run = (args: string[]): { status: number | null; stdout: string; stderr: string } => {
  const r = spawnSync("bunx", args, { cwd: expectedCwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

const timeout = values.timeout ?? "10000";

console.log(`[scene-qa] ${slug}: ${scenes.length} scene(s), ${allTimes.length} key frames at [${allTimes.join(", ")}]`);
const snapDir = path.join(workDir, "snapshots");
fs.rmSync(snapDir, { recursive: true, force: true });
const snap = run(["hyperframes", "snapshot", workDir, "--at", allTimes.join(","), "--timeout", timeout]);
if (snap.status !== 0) {
  console.error(`[scene-qa] snapshot failed:\n${snap.stderr}`);
  process.exit(1);
}
const insp = run(["hyperframes", "inspect", workDir, "--json", "--at", allTimes.join(","), "--timeout", timeout]);
let inspect: InspectResult | null = null;
try {
  inspect = JSON.parse(insp.stdout.slice(insp.stdout.indexOf("{")));
} catch {
  console.warn("[scene-qa] could not parse inspect JSON");
}

// ── sort frames into per-scene folders ────────────────────────────────────
const frameFor = (t: number): string | null => {
  const files = fs.existsSync(snapDir) ? fs.readdirSync(snapDir) : [];
  // hyperframes names frames frame-NN-at-<t>s.png (t may be rounded to 1 dp)
  const exact = files.find((f) => f.includes(`at-${t}s`));
  if (exact) return path.join(snapDir, exact);
  const near = files.find((f) => f.includes(`at-${t.toFixed(1)}s`));
  return near ? path.join(snapDir, near) : null;
};

const qaRoot = path.resolve("renders", `${slug}-qa`);
if (wanted) {
  // subset run: refresh only the re-QA'd scenes, keep the rest
  for (const sc of scenes) fs.rmSync(path.join(qaRoot, sc.id), { recursive: true, force: true });
  for (const f of fs.existsSync(qaRoot) ? fs.readdirSync(qaRoot) : [])
    if (f.startsWith("contact-sheet")) fs.rmSync(path.join(qaRoot, f), { force: true });
} else {
  fs.rmSync(qaRoot, { recursive: true, force: true });
}
fs.mkdirSync(qaRoot, { recursive: true });

const reportPath = path.join(qaRoot, "report.json");
let previousScenes: ReportScene[] = [];
if (wanted && fs.existsSync(reportPath)) {
  try {
    previousScenes = JSON.parse(fs.readFileSync(reportPath, "utf8")).scenes ?? [];
  } catch {}
}

const report: Report = {
  slug,
  total: built.totalDuration,
  inspectOk: inspect?.ok ?? null,
  inspectIssues: inspect?.issueCount ?? null,
  scenes: [],
  contactSheets: [],
};
const fresh = new Map<string, ReportScene>();
for (const sc of scenes) {
  const dir = path.join(qaRoot, sc.id);
  fs.mkdirSync(dir, { recursive: true });
  const frames: string[] = [];
  for (const s of sc.samples) {
    const src = frameFor(s.t);
    if (src) {
      const dest = path.join(dir, `${s.phase}-${s.t}s.png`);
      fs.copyFileSync(src, dest);
      frames.push(path.relative(expectedCwd, dest));
    }
  }
  fresh.set(sc.id, { id: sc.id, type: sc.type, track: sc.track, window: [sc.start, round(sc.start + sc.duration)], frames });
}
// merged report keeps the episode's scene order; stale entries survive subset runs
for (const sc of built.scenes) {
  const entry = fresh.get(sc.id) ?? previousScenes.find((p) => p.id === sc.id);
  if (entry) report.scenes.push(entry);
}

const sheets = fs.existsSync(snapDir)
  ? fs.readdirSync(snapDir).filter((f) => f.startsWith("contact-sheet")).sort()
  : [];
report.contactSheets = sheets.map((f, i) => {
  const dest = path.join(qaRoot, sheets.length === 1 ? "contact-sheet.jpg" : `contact-sheet-${i + 1}.jpg`);
  fs.copyFileSync(path.join(snapDir, f), dest);
  return path.relative(expectedCwd, dest);
});

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[scene-qa] wrote ${path.relative(expectedCwd, qaRoot)}/ (report.json + per-scene frames)`);
if (report.contactSheets.length) {
  console.log(`[scene-qa] contact sheet: ${report.contactSheets.join(", ")} — show it in the chat for review`);
}
console.log(`[scene-qa] inspect: ${inspect ? `ok=${inspect.ok} issues=${inspect.issueCount}` : "unavailable"}`);
console.table(report.scenes.map((s) => ({ id: s.id, type: s.type, window: s.window.join("-"), frames: s.frames.length })));
if (inspect && !inspect.ok) {
  console.log(`[scene-qa] INSPECT ISSUES:\n${JSON.stringify(inspect.issues, null, 2)}`);
}
