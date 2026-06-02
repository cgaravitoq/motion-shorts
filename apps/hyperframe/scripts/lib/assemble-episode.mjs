/**
 * assemble-episode — turns a scene-spec into ONE monolithic, render-ready
 * index.html. Deterministic: identical spec => identical bytes (1:1).
 *
 * The assembler OWNS the universal parts (shell CSS, background layers, brand
 * corner, audio/captions tracks, the single paused timeline, global init,
 * inter-scene crossfades, track + window allocation, registry). Each scene-type
 * OWNS only its DOM fragment, scoped CSS, and a build_<x>(tl, t, s, p) entrance
 * fn. Composition is a FLAT timeline of absolute-second offsets (the proven,
 * seek-safe pattern) — no nested timelines.
 */
import fs from "node:fs";
import path from "node:path";
import { instantiateScene } from "./scene-instantiator.mjs";

const shellDir = (hubRoot) => path.resolve(hubRoot ?? process.cwd(), "templates/_shell");

const FADE = 0.55;
const DEFAULT_ACCENT = "#5b6cff";
const DEFAULT_ACCENT2 = "#e9ff00";
const GRAIN_DRIFT = [[-5, 4], [6, -3], [-8, 1], [2, 6], [-4, -4]];
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const round = (n, d = 3) => Number(n.toFixed(d));
const indent = (text, n) => {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
};
// Prevent a text/JSON value from breaking out of the inline <script>.
const scriptSafe = (json) => json.replace(/<\//g, "<\\/");

// Background scenes get 4,5,6,8,9,10,... (7 reserved for the brand outro).
function allocateTracks(scenes) {
  const pool = [];
  for (let i = 4; pool.length < scenes.length + 2 && i < 90; i++) {
    if (i !== 7) pool.push(i);
  }
  let p = 0;
  return scenes.map((sc) =>
    sc.manifest.fixedTrack != null ? sc.manifest.fixedTrack : pool[p++],
  );
}

export function assembleEpisode(spec, { hubRoot } = {}) {
  const warnings = [];
  const slug = spec.slug;
  if (!slug || !SLUG_RE.test(slug)) throw new Error(`spec.slug must be kebab-case, got "${slug}"`);
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    throw new Error("spec.scenes must be a non-empty array");
  }

  const width = spec.width ?? 1080;
  const height = spec.height ?? 1920;
  const lang = spec.lang ?? "es";
  const accent = spec.palette?.accent ?? DEFAULT_ACCENT;
  const accent2 = spec.palette?.accent2 ?? DEFAULT_ACCENT2;

  const ids = new Set();
  for (const s of spec.scenes) {
    if (!s.id || !SLUG_RE.test(s.id)) throw new Error(`scene id must be kebab-case, got "${s.id}"`);
    if (ids.has(s.id)) throw new Error(`duplicate scene id "${s.id}"`);
    ids.add(s.id);
  }

  const scenes = spec.scenes.map((s) => {
    const version = s.version ?? 1;
    const inst = instantiateScene({ type: s.type, version, params: s.slots ?? {}, hubRoot });
    const duration = s.duration ?? inst.manifest.defaultDuration ?? 6;
    return { ...s, version, duration, ...inst };
  });

  // sequential windows
  let cursor = 0;
  for (const sc of scenes) {
    sc.windowStart = round(cursor);
    sc.windowDuration = round(sc.duration);
    cursor = round(cursor + sc.duration);
  }
  const totalDuration = round(cursor, 2);
  const audioDuration = spec.audioDuration ?? totalDuration;

  const tracks = allocateTracks(scenes);
  scenes.forEach((sc, i) => {
    sc.track = tracks[i];
  });

  // sections
  const sections = scenes
    .map((sc) => {
      const inner = indent(sc.html.trimEnd(), 8);
      return `      <section id="scene-${sc.id}" class="scene clip" data-start="${sc.windowStart}" data-duration="${sc.windowDuration}" data-track-index="${sc.track}" style="position:absolute; inset:0;">\n${inner}\n      </section>`;
    })
    .join("\n");

  // distinct scene-type css + builder fns (emitted once each)
  const seen = new Set();
  const cssBlocks = [];
  const builderBlocks = [];
  for (const sc of scenes) {
    const key = `${sc.type}@${sc.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cssBlocks.push(`/* scene-type: ${key} */\n${sc.css.trim()}`);
    builderBlocks.push(sc.timeline.trim());
  }

  // timeline
  const allSel = scenes.map((sc) => `"#scene-${sc.id}"`).join(", ");
  const grainInterval = (totalDuration / GRAIN_DRIFT.length).toFixed(2);
  const lines = [
    `const tl = gsap.timeline({ paused: true });`,
    `const FADE = ${FADE};`,
    `const sceneSel = (id) => (suffix) => (suffix ? "#" + id + " " + suffix : "#" + id);`,
    ``,
    ...builderBlocks.flatMap((b) => [b, ``]),
    `const ALL_SCENES = [${allSel}];`,
    `tl.set(ALL_SCENES, { autoAlpha: 0, scale: 1.02, filter: "blur(8px)" }, 0);`,
    `${JSON.stringify(GRAIN_DRIFT)}.forEach(([gx, gy], i) => { tl.set(".hf-grain-overlay__texture", { "--grain-x": gx + "%", "--grain-y": gy + "%" }, i * ${grainInterval}); });`,
    ``,
  ];

  scenes.forEach((sc, i) => {
    const start = sc.windowStart;
    const sel = `sceneSel("scene-${sc.id}")`;
    const paramsJson = scriptSafe(JSON.stringify(sc.slots ?? {}));
    if (i === 0) {
      lines.push(`tl.set("#scene-${sc.id}", { autoAlpha: 1, scale: 1, filter: "blur(0px)" }, ${start});`);
    } else {
      const prev = scenes[i - 1];
      lines.push(
        `tl.to("#scene-${prev.id}", { autoAlpha: 0, scale: 0.985, filter: "blur(8px)", duration: FADE, ease: "power2.in" }, ${round(start - FADE)});`,
      );
      lines.push(`tl.set("#scene-${prev.id}", { autoAlpha: 0 }, ${start});`);
      lines.push(
        `tl.to("#scene-${sc.id}", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: FADE, ease: "power2.out" }, ${start});`,
      );
    }
    lines.push(`${sc.manifest.builder}(tl, ${start}, ${sel}, ${paramsJson});`);
    lines.push(``);
  });

  lines.push(
    `const captionsData = JSON.parse(document.getElementById("captions-data").textContent || "[]");`,
    `if (captionsData.length > 0 && window.__hf && window.__hf.karaoke) {`,
    `  window.__hf.karaoke(tl, "#captions", captionsData, { maxChars: 28, maxTokens: 5 });`,
    `}`,
    `window.__timelines = window.__timelines || {};`,
    `window.__timelines["${slug}"] = tl;`,
  );
  const timelineJs = indent(lines.join("\n"), 6);

  // fill shell
  let shellCss = fs.readFileSync(path.join(shellDir(hubRoot), "shell.css"), "utf8");
  shellCss = shellCss
    .replaceAll("__ACCENT__", accent)
    .replaceAll("__ACCENT2__", accent2)
    .replaceAll("__WIDTH__", String(width))
    .replaceAll("__HEIGHT__", String(height));

  let shell = fs.readFileSync(path.join(shellDir(hubRoot), "shell.html.tmpl"), "utf8");
  shell = shell
    .replaceAll("__SHELL_CSS__", indent(shellCss.trim(), 6))
    .replaceAll("__SCENE_CSS__", indent(cssBlocks.join("\n\n"), 6))
    .replaceAll("__SCENES__", sections)
    .replaceAll("__TIMELINE_JS__", timelineJs)
    .replaceAll("__LANG__", lang)
    .replaceAll("__WIDTH__", String(width))
    .replaceAll("__HEIGHT__", String(height))
    .replaceAll("__SLUG__", slug)
    .replaceAll("__TOTAL_DURATION__", String(totalDuration))
    .replaceAll("__AUDIO_DURATION__", String(audioDuration));

  const sceneMap = scenes.map((sc) => ({
    id: sc.id,
    type: `${sc.type}@${sc.version}`,
    track: sc.track,
    start: sc.windowStart,
    duration: sc.windowDuration,
    mid: round(sc.windowStart + sc.windowDuration / 2, 2),
  }));

  return { html: shell, scenes: sceneMap, totalDuration, audioDuration, warnings };
}
