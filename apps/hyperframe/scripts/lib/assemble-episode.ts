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
import {
  decodeSceneSpec,
  formatParseError,
  type SceneSpec,
  SceneSpecInvalid,
  type SceneTypeManifest,
} from "@cgaravitoq/spec";
import { Result } from "effect";
import { brandVarsStyleBlock, EMPTY_BRAND_VARS, loadBrandPack } from "./brand-pack";
import { instantiateScene } from "./scene-instantiator";

const shellDir = (hubRoot?: string): string =>
  path.resolve(hubRoot ?? process.cwd(), "templates/_shell");

const FADE = 0.55;
const DEFAULT_ACCENT = "#5b6cff";
const DEFAULT_ACCENT2 = "#e9ff00";
const GRAIN_DRIFT = [
  [-5, 4],
  [6, -3],
  [-8, 1],
  [2, 6],
  [-4, -4],
];

const round = (n: number, d = 3): number => Number(n.toFixed(d));
const indent = (text: string, n: number): string => {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
};
// Prevent a text/JSON value from breaking out of the inline <script>.
const scriptSafe = (json: string): string => json.replace(/<\//g, "<\\/");

// Background scenes get 4,5,6,8,9,10,... (7 reserved for the brand outro).
function allocateTracks(scenes: ReadonlyArray<{ manifest: SceneTypeManifest }>): number[] {
  const pool: number[] = [];
  for (let i = 4; pool.length < scenes.length + 2 && i < 90; i++) {
    if (i !== 7) pool.push(i);
  }
  let p = 0;
  return scenes.map((sc) => sc.manifest.fixedTrack ?? (pool[p++] as number));
}

export interface SceneMapEntry {
  id: string;
  type: string;
  track: number;
  start: number;
  duration: number;
  mid: number;
}

export interface AssembledEpisode {
  html: string;
  scenes: SceneMapEntry[];
  totalDuration: number;
  audioDuration: number;
  warnings: string[];
}

export function assembleEpisode(
  input: unknown,
  { hubRoot }: { hubRoot?: string } = {},
): AssembledEpisode {
  const warnings: string[] = [];
  const decoded = decodeSceneSpec(input);
  if (Result.isFailure(decoded)) {
    throw new SceneSpecInvalid({ issues: formatParseError(decoded.failure) });
  }
  // keep the raw object (the schema pass is validation-only) so JSON key order
  // — and therefore emitted bytes — cannot drift
  const spec = input as SceneSpec;
  const slug = spec.slug;

  const width = spec.width ?? 1080;
  const height = spec.height ?? 1920;
  const lang = spec.lang ?? "es";
  const accent = spec.palette?.accent ?? DEFAULT_ACCENT;
  const accent2 = spec.palette?.accent2 ?? DEFAULT_ACCENT2;

  const ids = new Set<string>();
  for (const s of spec.scenes) {
    if (ids.has(s.id)) throw new Error(`duplicate scene id "${s.id}"`);
    ids.add(s.id);
  }

  const instantiated = spec.scenes.map((s) => {
    const version = s.version ?? 1;
    const inst = instantiateScene({
      type: s.type,
      version,
      params: (s.slots ?? {}) as Record<string, unknown>,
      hubRoot,
    });
    const duration = s.duration ?? inst.manifest.defaultDuration;
    return { ...s, version, duration, ...inst };
  });

  // sequential windows
  let cursor = 0;
  const windowed = instantiated.map((sc) => {
    const windowStart = round(cursor);
    const windowDuration = round(sc.duration);
    cursor = round(cursor + sc.duration);
    return { ...sc, windowStart, windowDuration };
  });
  const totalDuration = round(cursor, 2);
  const audioDuration = spec.audioDuration ?? totalDuration;

  const tracks = allocateTracks(windowed);
  const scenes = windowed.map((sc, i) => ({ ...sc, track: tracks[i] as number }));

  // sections
  const sections = scenes
    .map((sc) => {
      const inner = indent(sc.html.trimEnd(), 8);
      return `      <section id="scene-${sc.id}" class="scene clip" data-start="${sc.windowStart}" data-duration="${sc.windowDuration}" data-track-index="${sc.track}" style="position:absolute; inset:0;">\n${inner}\n      </section>`;
    })
    .join("\n");

  // distinct scene-type css + builder fns (emitted once each)
  const seen = new Set<string>();
  const cssBlocks: string[] = [];
  const builderBlocks: string[] = [];
  for (const sc of scenes) {
    const key = `${sc.type}@${sc.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cssBlocks.push(`/* scene-type: ${key} */\n${sc.css.trim()}`);
    builderBlocks.push(sc.timeline.trim());
  }

  // timeline
  // The opening scene is excluded from the t=0 hide: a hide + show pair on the
  // same property at the same instant resolves in reverse insertion order when
  // the playhead moves backwards (GSAP), which blanked the first scene under
  // capture engines that pre-seek past it (hyperframes >= 0.6.57 volume probe).
  const laterSel = scenes
    .slice(1)
    .map((sc) => `"#scene-${sc.id}"`)
    .join(", ");
  const grainInterval = (totalDuration / GRAIN_DRIFT.length).toFixed(2);
  const lines = [
    `const tl = gsap.timeline({ paused: true });`,
    `const FADE = ${FADE};`,
    `const sceneSel = (id) => (suffix) => (suffix ? "#" + id + " " + suffix : "#" + id);`,
    ``,
    ...builderBlocks.flatMap((b) => [b, ``]),
    ...(scenes.length > 1
      ? [`tl.set([${laterSel}], { autoAlpha: 0, scale: 1.02, filter: "blur(8px)" }, 0);`]
      : []),
    `${JSON.stringify(GRAIN_DRIFT)}.forEach(([gx, gy], i) => { tl.set(".hf-grain-overlay__texture", { "--grain-x": gx + "%", "--grain-y": gy + "%" }, i * ${grainInterval}); });`,
    ``,
  ];

  let prev: (typeof scenes)[number] | undefined;
  for (const sc of scenes) {
    const start = sc.windowStart;
    const sel = `sceneSel("scene-${sc.id}")`;
    const paramsJson = scriptSafe(JSON.stringify(sc.slots ?? {}));
    if (!prev) {
      lines.push(
        `tl.set("#scene-${sc.id}", { autoAlpha: 1, scale: 1, filter: "blur(0px)" }, ${start});`,
      );
    } else {
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
    prev = sc;
  }

  const karaokeOpts = "{ maxChars: 28, maxTokens: 5 }";
  lines.push(
    `const captionsData = JSON.parse(document.getElementById("captions-data").textContent || "[]");`,
    `if (captionsData.length > 0 && window.__hf && window.__hf.karaoke) {`,
    `  window.__hf.karaoke(tl, "#captions", captionsData, ${karaokeOpts});`,
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
    .replaceAll(
      "__BRAND_VARS__",
      spec.brand
        ? brandVarsStyleBlock(
            loadBrandPack(hubRoot ?? process.cwd(), spec.brand, "assemble-episode"),
          )
        : EMPTY_BRAND_VARS,
    )
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
