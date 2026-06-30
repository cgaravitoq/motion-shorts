#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { assembleEpisode, type EpisodeFormat, type SceneMapEntry } from "./lib/assemble-episode";

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
  console.error(
    `scene-qa: must run from ${expectedCwd}. Hint: cd apps/hyperframe && bun run scripts/scene-qa.ts <slug>`,
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    scenes: { type: "string" },
    frames: { type: "string", default: "1" },
    timeout: { type: "string", default: "10000" },
    format: { type: "string", default: "short" },
  },
  allowPositionals: true,
});

const [slug] = positionals;
if (!slug) {
  console.error("scene-qa: missing <slug>");
  process.exit(1);
}

if (values.format !== "short" && values.format !== "desktop") {
  console.error(`scene-qa: --format must be "short" or "desktop", got "${values.format}"`);
  process.exit(1);
}
const format = values.format as EpisodeFormat;
const isDesktop = format === "desktop";

const episodeDir = path.resolve("src/episodes", slug);
const specPath = path.join(episodeDir, "scene-spec.json");
if (!fs.existsSync(specPath)) {
  console.error(`scene-qa: no scene-spec.json at ${path.relative(process.cwd(), specPath)}`);
  process.exit(1);
}

const spec: { slug?: string } & Record<string, unknown> = JSON.parse(
  fs.readFileSync(specPath, "utf8"),
);
if (!spec.slug) spec.slug = slug;
const built = assembleEpisode(spec, { format });
fs.writeFileSync(
  path.join(episodeDir, isDesktop ? "index.desktop.html" : "index.html"),
  built.html,
);

const workDir = isDesktop
  ? path.resolve("out/episodes", slug, "desktop-1080p")
  : path.resolve("out/episodes", slug);
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

const ensureSymlink = (linkPath: string, targetAbs: string): void => {
  try {
    fs.lstatSync(linkPath);
    fs.rmSync(linkPath, { force: true, recursive: true });
  } catch {}
  if (fs.existsSync(targetAbs))
    fs.symlinkSync(path.relative(path.dirname(linkPath), targetAbs), linkPath, "dir");
};
ensureSymlink(path.join(workDir, "lib"), path.resolve("src/lib"));
ensureSymlink(path.join(workDir, "assets"), path.join(episodeDir, "assets"));
fs.writeFileSync(
  path.join(workDir, "favicon.ico"),
  Buffer.from(
    "47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b",
    "hex",
  ),
);

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
  sc.samples = threeFrames
    ? [
        { phase: "entry", t: round(sc.start + Math.min(1.2, d * 0.35)) },
        { phase: "mid", t: round(sc.start + d / 2) },
        { phase: "late", t: round(sc.start + d - 0.4) },
      ]
    : [{ phase: "final", t: round(sc.start + Math.max(d * 0.6, d - 0.8)) }];
}
const allTimes = [...new Set(scenes.flatMap((s) => s.samples.map((x) => x.t)))].sort(
  (a, b) => a - b,
);

const run = (args: string[]): { status: number | null; stdout: string; stderr: string } => {
  const r = spawnSync("bunx", args, { cwd: expectedCwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

const timeout = values.timeout ?? "10000";

console.log(
  `[scene-qa] ${slug}: ${scenes.length} scene(s), ${allTimes.length} key frames at [${allTimes.join(", ")}]`,
);
const snapDir = path.join(workDir, "snapshots");
fs.rmSync(snapDir, { recursive: true, force: true });
const snap = run([
  "hyperframes",
  "snapshot",
  workDir,
  "--at",
  allTimes.join(","),
  "--timeout",
  timeout,
]);
if (snap.status !== 0) {
  console.error(`[scene-qa] snapshot failed:\n${snap.stderr}`);
  process.exit(1);
}
const insp = run([
  "hyperframes",
  "inspect",
  workDir,
  "--json",
  "--at",
  allTimes.join(","),
  "--timeout",
  timeout,
]);
let inspect: InspectResult | null = null;
try {
  inspect = JSON.parse(insp.stdout.slice(insp.stdout.indexOf("{")));
} catch {
  console.warn("[scene-qa] could not parse inspect JSON");
}

const frameFor = (t: number): string | null => {
  const files = fs.existsSync(snapDir) ? fs.readdirSync(snapDir) : [];
  const exact = files.find((f) => f.includes(`at-${t}s`));
  if (exact) return path.join(snapDir, exact);
  const near = files.find((f) => f.includes(`at-${t.toFixed(1)}s`));
  return near ? path.join(snapDir, near) : null;
};

const qaRoot = path.resolve("renders", isDesktop ? `${slug}-desktop-qa` : `${slug}-qa`);
if (wanted) {
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
  fresh.set(sc.id, {
    id: sc.id,
    type: sc.type,
    track: sc.track,
    window: [sc.start, round(sc.start + sc.duration)],
    frames,
  });
}
for (const sc of built.scenes) {
  const entry = fresh.get(sc.id) ?? previousScenes.find((p) => p.id === sc.id);
  if (entry) report.scenes.push(entry);
}

const sheets = fs.existsSync(snapDir)
  ? fs
      .readdirSync(snapDir)
      .filter((f) => f.startsWith("contact-sheet"))
      .sort()
  : [];
report.contactSheets = sheets.map((f, i) => {
  const dest = path.join(
    qaRoot,
    sheets.length === 1 ? "contact-sheet.jpg" : `contact-sheet-${i + 1}.jpg`,
  );
  fs.copyFileSync(path.join(snapDir, f), dest);
  return path.relative(expectedCwd, dest);
});

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `[scene-qa] wrote ${path.relative(expectedCwd, qaRoot)}/ (report.json + per-scene frames)`,
);
if (report.contactSheets.length) {
  console.log(
    `[scene-qa] contact sheet: ${report.contactSheets.join(", ")} — show it in the chat for review`,
  );
}
console.log(
  `[scene-qa] inspect: ${inspect ? `ok=${inspect.ok} issues=${inspect.issueCount}` : "unavailable"}`,
);
console.table(
  report.scenes.map((s) => ({
    id: s.id,
    type: s.type,
    window: s.window.join("-"),
    frames: s.frames.length,
  })),
);
if (inspect && !inspect.ok) {
  console.log(`[scene-qa] INSPECT ISSUES:\n${JSON.stringify(inspect.issues, null, 2)}`);
}
