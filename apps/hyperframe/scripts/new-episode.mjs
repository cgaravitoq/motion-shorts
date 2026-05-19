#!/usr/bin/env bun
/**
 * Scaffold a new monolithic episode under `src/episodes/<slug>/`.
 *
 *   bun run scripts/new-episode.mjs <slug> [--width=1080] [--height=1920]
 *
 * Architecture: the episode HTML is a single monolithic file (CSS + HTML +
 * GSAP timeline + captions JSON inlined). Hyperframes' runtime force-applies
 * `position: absolute; inset: 0` on every direct stage child with
 * `data-start`, which collapses sub-composition flex layouts. Therefore
 * `data-composition-src` is intentionally NOT supported — author scenes
 * inline.
 *
 * After scaffold:
 *   1. Drop voice.mp3 + captions.json into src/episodes/<slug>/assets/.
 *   2. Author scenes inline in src/episodes/<slug>/index.html (see
 *      .agents/skills/canonical-short/SKILL.md for the 5-scene template).
 *   3. Run `bun run render:episode <slug>`.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { instantiateEpisodeTemplate, listEpisodeTemplates } from "./lib/template-instantiator.mjs";

// CWD guard — paths in this script (`src/episodes/`, `src/lib/`,
// `brands/`) all resolve relative to process.cwd(). The canonical
// invocation is `bun run new:episode <slug>` from `apps/hyperframe/`.
const expectedCwd = path.resolve(import.meta.dirname, "..");
if (path.resolve(process.cwd()) !== expectedCwd) {
  console.error(
    `new-episode: must run from ${expectedCwd}, got ${process.cwd()}.\n` +
      "Hint: cd apps/hyperframe && bun run new:episode <slug>",
  );
  process.exit(1);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    width: { type: "string", default: "1080" },
    height: { type: "string", default: "1920" },
    handle: { type: "string", default: "@your_handle" },
    brand: { type: "string" },
    template: { type: "string" },
    "template-data": { type: "string" },
    slug: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || (positionals.length === 0 && !values.slug)) {
  console.log(`Usage: bun run scripts/new-episode.mjs <slug> [options]

Options:
  --width=<px>     Episode stage width.  Default 1080.
  --height=<px>    Episode stage height. Default 1920.
  --handle=<text>  Brand-corner @handle. Default "@your_handle".
                   Set BRAND_HANDLE in your env to bake your own default.
                   Ignored when --brand is set (handle comes from brand.json).
  --brand=<slug>   Apply a brand pack from brands/<slug>/brand.json. Emits an
                   episode template that uses var(--brand-*) tokens, sets
                   meta.brand, and adds a <style id="brand-vars"> placeholder
                   that render-episode populates at render time. Without this
                   flag the episode uses theme.css fallbacks (current behaviour).
  --template=<id>  Instantiate an exact template into a monolithic episode.
                   Supported: ${listEpisodeTemplates().join(", ")}.
  --template-data=<file>
                   Optional JSON slot data for --template. Defaults to the
                   template's sample-data.json.
  --slug=<slug>    Episode slug. Alternative to the positional slug.
`);
  process.exit(values.help ? 0 : 1);
}

const slug = values.slug ?? positionals[0];
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(`new-episode: slug must be lowercase kebab-case, got "${slug}"`);
  process.exit(1);
}

const epDir = path.resolve("src/episodes", slug);
if (fs.existsSync(epDir)) {
  const isEmpty = fs.readdirSync(epDir).length === 0;
  if (!isEmpty) {
    console.error(`new-episode: ${epDir} already exists and is non-empty`);
    process.exit(1);
  }
}
fs.mkdirSync(epDir, { recursive: true });
fs.mkdirSync(path.join(epDir, "assets"), { recursive: true });

const w = values.width;
const h = values.height;
const templateId = values.template;

if (templateId && values.brand) {
  console.error("new-episode: --template and --brand cannot be combined yet");
  process.exit(1);
}

let brand = null;
if (values.brand) {
  const brandPath = path.resolve("brands", values.brand, "brand.json");
  if (!fs.existsSync(brandPath)) {
    console.error(`new-episode: --brand="${values.brand}" but ${brandPath} not found`);
    process.exit(1);
  }
  try {
    brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  } catch (err) {
    console.error(`new-episode: ${brandPath} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
}

const handle = brand?.handle ?? process.env.BRAND_HANDLE ?? values.handle;
const brandName = brand?.wordmark ?? process.env.BRAND_NAME ?? "cgaravitoq";
const brandTagline = brand?.tagline ?? process.env.BRAND_TAGLINE ?? "AI Engineering";
// Token names used in the template; switch to var(--brand-*) when a brand pack is active.
const tk = (name, fallback) =>
  brand ? `var(--brand-${name}, ${fallback})` : `var(--${name}, ${fallback})`;

const brandPlaceholder = brand
  ? '<style id="brand-vars">/* render-episode injects :root { --brand-* } from brands/<slug>/brand.json */</style>\n    '
  : "";

const brandLogoWatermarkSnippet = fs.readFileSync(
  path.resolve("../../packages/catalog/snippets/brand-logo-watermark.html"),
  "utf8",
);
const brandLogoWatermarkSvg = brandLogoWatermarkSnippet.match(/<svg[\s\S]*<\/svg>/)?.[0];
if (!brandLogoWatermarkSvg) {
  console.error("new-episode: could not read brand-logo-watermark SVG snippet");
  process.exit(1);
}

const indexHtml = templateId
  ? instantiateEpisodeTemplate({
      templateId,
      slug,
      width: w,
      height: h,
      dataPath: values["template-data"],
    })
  : `<!doctype html>
<!-- catalog: [brand-logo-watermark, brand-logo-outro] -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${w}, height=${h}" />
    <link rel="stylesheet" href="lib/theme.css" />
    <link rel="stylesheet" href="lib/easings.css" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap"
    />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    ${brandPlaceholder}<style>
      html, body {
        width: ${w}px; height: ${h}px; margin: 0; padding: 0;
        background: ${tk("ink", "#060912")}; overflow: hidden;
        font-family: "Inter", system-ui, sans-serif;
        color: ${tk("paper", "#f4f6fb")}; -webkit-font-smoothing: antialiased;
      }
      #ep-stage { width: ${w}px; height: ${h}px; position: relative; overflow: hidden; }

      /* Brand corner — visible the whole video. */
      #brand-corner {
        position: absolute; top: 96px; right: 96px;
        width: 96px; opacity: 0.42; z-index: 60; pointer-events: none;
      }
      #brand-corner svg { display: block; width: 100%; height: auto; fill: ${tk("paper", "#f4f6fb")}; }

      .brand-outro {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; background: ${tk("ink", "#060912")};
      }
      .brand-outro__lockup {
        position: relative; display: grid; place-items: center;
        width: 540px; height: 300px; margin-bottom: 34px;
      }
      .brand-outro__aura {
        position: absolute; width: 520px; height: 520px; border-radius: 999px;
        background: radial-gradient(circle, color-mix(in srgb, ${tk("accent", "#34d399")} 18%, transparent), transparent 62%);
        opacity: 0; transform: scale(0.72);
      }
      .brand-outro__mark {
        position: relative; width: 420px; height: auto; overflow: visible;
        filter: drop-shadow(0 26px 80px rgba(0,0,0,0.5));
      }
      .brand-outro__piece { transform-box: fill-box; transform-origin: center; opacity: 0; fill: ${tk("paper", "#f4f6fb")}; }
      .brand-outro__name {
        margin: 0; font-size: 72px; line-height: 1.02; font-weight: 790;
        letter-spacing: 0; color: ${tk("paper", "#f4f6fb")};
      }
      .brand-outro__tagline {
        margin: 28px 0 0; max-width: 780px; color: ${tk("muted", "#94a3b8")};
        font-family: "JetBrains Mono", monospace; font-size: 30px; line-height: 1.2;
        font-weight: 590; letter-spacing: 3px; text-transform: uppercase;
      }
      .brand-outro__name,
      .brand-outro__tagline {
        will-change: opacity, transform, filter;
      }

      /* Captions strip — bottom of the stage. Required block (the runtime
         force-applies inset:0 on the captions clip without it).
         See .agents/skills/canonical-short/SKILL.md for the canonical block. */
      /* Typography roles for source-driven/informative shorts live at
         .agents/skills/canonical-short/references/typography-system.md.
         Use those role sizes/weights instead of inventing local values. */
      #captions {
        position: absolute; left: 0; right: 0; bottom: 4.5%; height: 12%;
        display: flex; align-items: center; justify-content: center;
        font-family: "Inter", system-ui, sans-serif;
        font-size: 60px; font-weight: 900; line-height: 1.1; letter-spacing: -1px;
        color: ${tk("paper", "#f4f6fb")};
        text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95), 0 1px 0 rgba(0, 0, 0, 0.7);
        text-align: center; padding: 0 64px; box-sizing: border-box;
        pointer-events: none; z-index: 50;
      }
      #captions .hf-caption-token {
        opacity: 0.78;
        transition: color 0.06s linear, opacity 0.06s linear, transform 0.06s ease-out;
      }
      #captions .hf-caption-token.--active {
        color: ${tk("accent", "#34d399")};
        opacity: 1;
        transform: scale(1.08);
      }
    </style>
  </head>
  <body>
    <div
      id="ep-stage"
      data-composition-id="${slug}"
      data-start="0"
      data-duration="30"
      data-width="${w}"
      data-height="${h}"
    >
      <div id="brand-corner" class="clip" data-start="0" data-duration="30" data-track-index="97">${brandLogoWatermarkSvg}</div>

      <section id="scene-brand-outro" class="scene clip" data-start="24" data-duration="6" data-track-index="7" style="position:absolute; inset:0;">
        <div class="brand-outro">
          <div class="brand-outro__lockup">
            <div id="brand-aura" class="brand-outro__aura"></div>
            <svg id="brand-mark" class="brand-outro__mark" viewBox="0 0 578 320" role="img" aria-label="${brandName} logo">
              <path id="brand-piece-left" class="brand-outro__piece" d="M30 96h68c16.6 0 30 13.4 30 30v68c0 16.6-13.4 30-30 30H30c-16.6 0-30-13.4-30-30v-68c0-16.6 13.4-30 30-30Z" />
              <path id="brand-piece-top-left" class="brand-outro__piece" d="M180 20h68c16.6 0 30 13.4 30 30v68c0 16.6-13.4 30-30 30h-68c-16.6 0-30-13.4-30-30V50c0-16.6 13.4-30 30-30Z" />
              <path id="brand-piece-bridge" class="brand-outro__piece" d="M330 28h68c16.6 0 30 13.4 30 30v68c0 16.6-13.4 30-30 30h-68c-33.8 0-52 18.2-52 52v60c0 16.6-13.4 30-30 30h-68c-16.6 0-30-13.4-30-30v-68c0-16.6 13.4-30 30-30h68c33.8 0 52-18.2 52-52V58c0-16.6 13.4-30 30-30Z" />
              <path id="brand-piece-bottom-right" class="brand-outro__piece" d="M330 178h68c16.6 0 30 13.4 30 30v68c0 16.6-13.4 30-30 30h-68c-16.6 0-30-13.4-30-30v-68c0-16.6 13.4-30 30-30Z" />
              <path id="brand-piece-right" class="brand-outro__piece" d="M480 100h68c16.6 0 30 13.4 30 30v68c0 16.6-13.4 30-30 30h-68c-16.6 0-30-13.4-30-30v-68c0-16.6 13.4-30 30-30Z" />
            </svg>
          </div>
          <h1 id="brand-name" class="brand-outro__name">${brandName}</h1>
          <p id="brand-tagline" class="brand-outro__tagline">${brandTagline}</p>
        </div>
      </section>

      <!--
        Author scenes inline here. Track-index convention:
          0..3   — background layers (mesh / grid / grain / vignette)
          4..6,8 — scenes (track 7 is reserved for #scene-brand-outro)
          97     — #brand-corner (always visible)
          98     — voiceover audio
          99     — captions overlay

        See .agents/skills/canonical-short/SKILL.md for the 5-scene template.
      -->

      <audio
        id="voiceover"
        class="clip"
        data-start="0"
        data-duration="30"
        data-track-index="98"
        data-volume="1"
        src="assets/voice.mp3"
      ></audio>

      <div id="captions" class="clip" data-start="0" data-duration="30" data-track-index="99"></div>
    </div>

    <!-- Captions inlined as JSON to keep the timeline build SYNCHRONOUS
         (Hyperframes seeks immediately; async construction leaves tweens
         unregistered). Replace the empty array with the contents of
         assets/captions.json before the first render. -->
    <script type="application/json" id="captions-data">[]</script>

    <script src="lib/timeline-helpers.js"></script>
    <script src="lib/captions-karaoke.js"></script>
    <script>
      // Synchronous timeline construction — required by Hyperframes.
      const tl = gsap.timeline({ paused: true });

      const captionsData = JSON.parse(
        document.getElementById("captions-data").textContent || "[]",
      );
      if (captionsData.length > 0) {
        window.__hf.karaoke(tl, "#captions", captionsData, {
          maxChars: 24,
          maxTokens: 5,
        });
      }
      tl.set("#scene-brand-outro", { autoAlpha: 0, scale: 1.02, filter: "blur(8px)" }, 0);
      tl.set(["#brand-name", "#brand-tagline"], { autoAlpha: 0, scale: 0.88, filter: "blur(16px)", transformOrigin: "50% 50%" }, 0);
      tl.to("#brand-corner", { autoAlpha: 0, duration: 0.45, ease: "power2.in" }, 23.45);
      tl.to("#scene-brand-outro", { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 24);
      tl.to("#brand-aura", { autoAlpha: 1, scale: 1, duration: 0.65, ease: "power2.out" }, 24.2);
      tl.to(".brand-outro__piece", { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.55, stagger: 0.08, ease: "back.out(1.6)", startAt: { x: -24, y: 20, scale: 0.92 } }, 24.3);
      tl.to(["#brand-name", "#brand-tagline"], { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.62, stagger: 0.1, ease: "power3.out" }, 24.62);
      tl.to("#brand-mark", { scale: 1.04, duration: 0.32, ease: "power2.out", overwrite: "auto" }, 24.8);
      tl.to("#brand-mark", { scale: 1, duration: 0.34, ease: "power2.inOut", overwrite: "auto" }, 25.12);

      window.__timelines = window.__timelines || {};
      window.__timelines["${slug}"] = tl;
    </script>
  </body>
</html>
`;

// `tail` is the padding past end-of-audio so the brand-card lockup can
// hold for reading. Override per-render via `--tail=<seconds>`; render
// also accepts a CLI flag that takes priority over this value.
const metaPayload = { id: slug, name: slug, description: "", tail: 3 };
if (brand) {
  metaPayload.brand = brand.slug;
}
if (templateId) {
  metaPayload.template = templateId;
}
const metaJson = `${JSON.stringify(metaPayload, null, 2)}\n`;

const hyperframesJson = `${JSON.stringify(
  {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: {
      assets: "assets",
    },
  },
  null,
  2,
)}\n`;

fs.writeFileSync(path.join(epDir, "index.html"), indexHtml);
fs.writeFileSync(path.join(epDir, "meta.json"), metaJson);
fs.writeFileSync(path.join(epDir, "hyperframes.json"), hyperframesJson);
fs.writeFileSync(path.join(epDir, "assets", ".gitkeep"), "");

// Symlink lib so the project's relative `lib/...` imports resolve. The
// Hyperframes engine serves the project from <slug>/ as root, so anything
// outside returns 404. The symlink keeps the shared lib in scope and
// survives nested layouts (e.g. src/episodes/season-01/short-09).
//
// Always recreate so a broken/stale link from a previous failed scaffold
// gets repaired (lstatSync on a broken symlink succeeds, so the old "if
// missing then create" pattern silently kept the bad link alive).
const libLink = path.join(epDir, "lib");
const libTarget = path.relative(epDir, path.resolve("src/lib"));
try {
  fs.lstatSync(libLink);
  fs.rmSync(libLink, { force: true, recursive: true });
} catch {
  // Link doesn't exist yet — nothing to remove.
}
fs.symlinkSync(libTarget, libLink, "dir");

console.log(`Created ${epDir}/`);
console.log(
  `  index.html (${w}x${h}, handle=${handle}${brand ? `, brand=${brand.slug}` : ""}${templateId ? `, template=${templateId}` : ""})`,
);
console.log("  meta.json");
console.log("  hyperframes.json");
console.log("  assets/");
if (brand && brand.publishable === false) {
  console.log("");
  console.log(
    `  WARNING: brand "${brand.slug}" is marked publishable=false. ${brand.notes || "Internal use only."}`,
  );
}
console.log("\nNext steps:");
console.log(`  1. cp public/voice/${slug}/voice.mp3 ${epDir}/assets/voice.mp3`);
console.log(`     cp public/voice/${slug}/captions.json ${epDir}/assets/captions.json`);
console.log(`  2. Extend the catalog comment in ${epDir}/index.html per the routed intent skill`);
console.log(
  templateId
    ? `  3. Fill template slots by rerunning with --template-data or edit inline copy in ${epDir}/index.html`
    : `  3. Author scenes inline in ${epDir}/index.html (see canonical-short skill)`,
);
console.log(`  4. bun run render:episode ${slug}`);
