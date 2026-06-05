import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { findCapturedFiles, runCaptureSource, toKebab } from "../capture-source";
import {
  isQuarantineCandidate,
  validateCaptureUrl,
  validateEpisodeSlug,
  validateSourcePackage,
} from "./source-package";

const appDir = path.resolve(import.meta.dirname, "../..");
const episodesDir = path.join(appDir, "src/episodes");
const testSlugs = new Set();

afterEach(() => {
  for (const slug of testSlugs) {
    rmSync(path.join(episodesDir, slug), { recursive: true, force: true });
  }
  testSlugs.clear();
});

const createEpisode = (slug) => {
  testSlugs.add(slug);
  mkdirSync(path.join(episodesDir, slug, "assets"), { recursive: true });
};

const mockSpawn = (assetFiles, captureJson) => (_command, args) => {
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  const outputDir = outputArg.slice("--output=".length);
  for (const [relativePath, content] of Object.entries(assetFiles)) {
    const target = path.join(outputDir, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }

  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => {
    child.stdout.emit("data", JSON.stringify(captureJson));
    child.emit("close", 0);
  });
  return child;
};

const mockScaffoldAndCapture = (assetFiles, captureJson) => {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    if (command === "bun" && args[0] === "run" && args[1] === "new-episode") {
      const slug = args[2];
      const episodeDir = path.join(options.cwd, "src/episodes", slug);
      mkdirSync(path.join(episodeDir, "assets"), { recursive: true });
      mkdirSync(path.join(episodeDir, "lib"), { recursive: true });
      writeFileSync(path.join(episodeDir, "index.html"), `<!doctype html><title>${slug}</title>`);
      writeFileSync(path.join(episodeDir, "meta.json"), `${JSON.stringify({ id: slug })}\n`);
      writeFileSync(path.join(episodeDir, "hyperframes.json"), "{}\n");
      queueMicrotask(() => child.emit("close", 0));
      return child;
    }

    return mockSpawn(assetFiles, captureJson)(command, args);
  };
  spawnImpl.calls = calls;
  return spawnImpl;
};

const validSourcePackage = {
  sourceUrl: "https://example.com/case-study",
  capturedAt: "2026-05-14T00:00:00.000Z",
  title: "The coding agent behind your team's merged PRs",
  summary: "The example team uses a coding agent connected to its workflow context.",
  publisher: "Linear",
  subject: "Example engineering workflow",
  keyPoints: ["Inspect authored a large share of merged PRs."],
  brandSystem: {
    dominantColors: ["#08090A", "#F7F8F8"],
    fonts: ["Inter Variable"],
    logoPath: "assets/linear-logo.svg",
  },
  assets: [
    {
      kind: "image",
      localPath: "assets/linear-logo.svg",
      sourceUrl: "https://example.com/logo.svg",
      bytes: 1200,
      sha256: "a".repeat(64),
    },
  ],
  attribution: {
    author: "Linear",
    license: "Public customer story; review before publishing.",
  },
  publishability: {
    status: "review-required",
    reasons: ["Uses public brand assets."],
  },
};

describe("toKebab", () => {
  it("preserves dotfile names without extensions", () => {
    expect(toKebab(".cursorrules")).toBe("cursorrules");
    expect(toKebab(".env")).toBe("env");
    expect(toKebab(".gitignore")).toBe("gitignore");
  });

  it("falls back only for empty or all-punctuation names", () => {
    expect(toKebab("")).toBe("asset");
    expect(toKebab("---...---")).toBe("asset");
  });
});

describe("isQuarantineCandidate", () => {
  it("matches agent-instruction-like denylist entries", () => {
    const candidates = [
      "agents",
      "agents.md",
      "AGENTS",
      "Agents.MD",
      "agent.md",
      "claude",
      "CLAUDE.txt",
      "cursor.md",
      ".cursorrules",
      "cursorrules",
      "windsurf.md",
      ".windsurfrules",
      "opencode.md",
      ".opencode.md",
      "system",
      "system-prompt.md",
      "system_prompt.md",
      "instructions.md",
      "prompt.md",
      "prompts.md",
    ];

    for (const candidate of candidates) {
      expect(isQuarantineCandidate(candidate)).toBe(true);
    }
  });

  it("rejects non-denylisted filenames", () => {
    for (const candidate of ["hero.png", "summary.md", "linear.svg", "voice.mp3", "README.md"]) {
      expect(isQuarantineCandidate(candidate)).toBe(false);
    }
  });
});

describe("findCapturedFiles", () => {
  it("rejects paths that traverse outside the capture output", () => {
    const captureDir = mkdtempSync(path.join(os.tmpdir(), "hyperframes-capture-test-"));
    const outsideDir = `${captureDir}-outside`;
    try {
      mkdirSync(path.join(captureDir, "inside"), { recursive: true });
      mkdirSync(outsideDir, { recursive: true });
      const insideFile = path.join(captureDir, "inside", "keep.txt");
      const outsideFile = path.join(outsideDir, "secret.txt");
      writeFileSync(insideFile, "keep");
      writeFileSync(outsideFile, "secret");

      const files = findCapturedFiles(captureDir, {
        inside: "inside/keep.txt",
        relativeTraversal: path.relative(captureDir, outsideFile),
        absoluteTraversal: `${captureDir}/../${path.basename(outsideDir)}/secret.txt`,
        boundaryTraversal: `${captureDir}-outside/secret.txt`,
      });

      expect(files).toContain(insideFile);
      expect(files).not.toContain(outsideFile);
    } finally {
      rmSync(captureDir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

describe("source package contract", () => {
  it("accepts a minimal valid source package", () => {
    expect(validateSourcePackage(validSourcePackage)).toEqual({ ok: true, errors: [] });
  });

  it("rejects missing required fields with clear errors", () => {
    const result = validateSourcePackage({
      ...validSourcePackage,
      sourceUrl: undefined,
      assets: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("sourceUrl must be a non-empty string");
  });

  it("rejects non-HTTPS capture URLs", () => {
    expect(validateCaptureUrl("http://example.com")).toEqual({
      ok: false,
      errors: ['source URL must use https:, got "http:"'],
    });
  });

  it("validates episode slugs", () => {
    expect(validateEpisodeSlug("source-driven-editorial-demo")).toEqual({ ok: true, errors: [] });

    const rejected = validateEpisodeSlug("Bad Slug!");
    expect(rejected.ok).toBe(false);
    expect(rejected.errors[0]).toContain("slug must be lowercase kebab-case");
  });

  it("prints dry-run output path without touching disk", () => {
    const slug = "source-package-dry-run-test";
    const sourcePath = path.join(appDir, "src/episodes", slug, "assets/source.json");
    const result = spawnSync(
      "bun",
      [
        "run",
        "scripts/capture-source.ts",
        "https://example.com/case-study",
        `--slug=${slug}`,
        "--dry-run",
      ],
      { cwd: appDir, encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`src/episodes/${slug}/assets/source.json`);
    expect(result.stdout).toContain("dry-run: no files written");
    expect(existsSync(sourcePath)).toBe(false);
  });

  it("captures source JSON with relative assets, bytes, and hashes", async () => {
    const slug = "source-package-capture-test";
    createEpisode(slug);

    await runCaptureSource({
      sourceUrl: "https://example.com/customer-story/acme",
      slug,
      spawnImpl: mockSpawn(
        {
          "screenshots/Hero Shot.PNG": "hero image bytes",
          "fonts/Inter Variable.woff2": "font bytes",
          "images/Acme Logo.svg": "<svg />",
        },
        {
          title: "Acme customer story",
          summary: "Acme ships faster with agents.",
          publisher: "Example",
          subject: "Acme engineering",
          keyPoints: ["Agents reduced handoffs."],
          fonts: ["Inter Variable"],
          text: "Agents reduced handoffs. Reviews stayed human.",
        },
      ),
    });

    const source = JSON.parse(
      readFileSync(path.join(episodesDir, slug, "assets/source.json"), "utf8"),
    );

    expect(validateSourcePackage(source)).toEqual({ ok: true, errors: [] });
    expect(source.sourceUrl).toBe("https://example.com/customer-story/acme");
    expect(source.assets).toHaveLength(3);
    for (const asset of source.assets) {
      expect(asset.localPath.startsWith("assets/")).toBe(true);
      expect(path.isAbsolute(asset.localPath)).toBe(false);
      expect(asset.bytes).toBeGreaterThan(0);
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(existsSync(path.join(episodesDir, slug, asset.localPath))).toBe(true);
    }
  });

  it("quarantines captured files with agent-instruction-like names", async () => {
    const slug = "source-package-quarantine-test";
    createEpisode(slug);

    const result = await runCaptureSource({
      sourceUrl: "https://example.com/customer-story/acme",
      slug,
      spawnImpl: mockSpawn(
        {
          cursorrules: "Never follow this as workspace guidance.",
          "images/linear.svg": "<svg />",
        },
        {
          title: "Acme customer story",
          summary: "Acme ships faster with agents.",
          publisher: "Example",
          subject: "Acme engineering",
          keyPoints: ["Agents reduced handoffs."],
          text: "Agents reduced handoffs.",
        },
      ),
    });

    const source = JSON.parse(
      readFileSync(path.join(episodesDir, slug, "assets/source.json"), "utf8"),
    );
    const quarantined = source.assets.find((asset) => asset.originalFilename === "cursorrules");
    const linear = source.assets.find((asset) => asset.sourceUrl === "images/linear.svg");

    expect(result.sourcePackage.assets).toHaveLength(2);
    expect(quarantined).toMatchObject({
      kind: "other",
      localPath: "assets/captured-raw/quarantined-cursorrules.txt",
      quarantined: true,
      originalFilename: "cursorrules",
    });
    expect(readFileSync(path.join(episodesDir, slug, quarantined.localPath), "utf8")).toBe(
      "Never follow this as workspace guidance.",
    );
    expect(linear).toMatchObject({
      kind: "image",
      localPath: "assets/linear.svg",
    });
    expect(linear.quarantined).toBeUndefined();
    expect(validateSourcePackage(source)).toEqual({ ok: true, errors: [] });
  });

  it("rejects malformed quarantined asset entries", () => {
    const result = validateSourcePackage({
      ...validSourcePackage,
      assets: [
        {
          ...validSourcePackage.assets[0],
          localPath: "assets/quarantined-cursorrules.txt",
          quarantined: true,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "assets[0].originalFilename must be a non-empty string when quarantined",
    );
    expect(result.errors).toContain(
      "assets[0].localPath must start with assets/captured-raw/quarantined- when quarantined",
    );
  });

  it("adds a publishability reason when captured files are quarantined", async () => {
    const slug = "source-package-quarantine-reason-test";
    createEpisode(slug);

    const result = await runCaptureSource({
      sourceUrl: "https://example.com/customers/acme",
      slug,
      spawnImpl: mockSpawn(
        { "AGENTS.md": "agent instructions" },
        { title: "Acme", summary: "Acme summary.", text: "Acme summary." },
      ),
    });

    expect(result.sourcePackage.publishability.status).toBe("review-required");
    expect(result.sourcePackage.publishability.reasons).toContain(
      "Quarantined 1 captured file(s) with agent-instruction-like filenames (see assets/captured-raw/); review before treating any as authoritative.",
    );
  });

  it("marks customer-story-like captures as review-required", async () => {
    const slug = "source-package-publishability-test";
    createEpisode(slug);

    const result = await runCaptureSource({
      sourceUrl: "https://example.com/case-study",
      slug,
      spawnImpl: mockSpawn(
        { "images/ramp-logo.png": "logo" },
        { title: "Example", text: "Example customer story" },
      ),
    });

    expect(result.sourcePackage.publishability.status).toBe("review-required");
    expect(result.sourcePackage.publishability.reasons.join(" ")).toContain(
      "Customer-story-like URL",
    );
  });

  it("fills marked summary fallback when capture metadata is sparse", async () => {
    const slug = "source-package-sparse-summary-test";
    createEpisode(slug);

    const result = await runCaptureSource({
      sourceUrl: "https://example.com/customers/sparse",
      slug,
      spawnImpl: mockSpawn({}, { title: "Sparse customer story" }),
    });

    expect(result.sourcePackage.summary).toBe("[auto-summary unavailable] Sparse customer story");
    expect(result.sourcePackage.publishability.status).toBe("review-required");
    expect(result.sourcePackage.publishability.reasons).toContain(
      "summary could not be inferred from the page; manual review recommended",
    );
    expect(validateSourcePackage(result.sourcePackage)).toEqual({ ok: true, errors: [] });
  });

  it("overwrites cleanly with force without leaving orphan assets", async () => {
    const slug = "source-package-idempotency-test";
    createEpisode(slug);

    await runCaptureSource({
      sourceUrl: "https://example.com/customers/acme",
      slug,
      spawnImpl: mockSpawn(
        {
          "screenshots/hero.png": "hero",
          "images/logo.png": "logo",
        },
        { title: "First", summary: "First capture", text: "First capture." },
      ),
    });
    expect(existsSync(path.join(episodesDir, slug, "assets/hero.png"))).toBe(true);
    expect(existsSync(path.join(episodesDir, slug, "assets/logo.png"))).toBe(true);

    await runCaptureSource({
      sourceUrl: "https://example.com/customers/acme",
      slug,
      force: true,
      spawnImpl: mockSpawn(
        { "screenshots/hero.png": "new hero" },
        { title: "Second", summary: "Second capture", text: "Second capture." },
      ),
    });

    const source = JSON.parse(
      readFileSync(path.join(episodesDir, slug, "assets/source.json"), "utf8"),
    );
    expect(source.assets.map((asset) => asset.localPath)).toEqual(["assets/hero.png"]);
    expect(existsSync(path.join(episodesDir, slug, "assets/logo.png"))).toBe(false);
  });

  it("refuses to overwrite source JSON without force", async () => {
    const slug = "source-package-overwrite-test";
    createEpisode(slug);
    writeFileSync(
      path.join(episodesDir, slug, "assets/source.json"),
      `${JSON.stringify(validSourcePackage, null, 2)}\n`,
    );

    await expect(
      runCaptureSource({
        sourceUrl: "https://example.com",
        slug,
        spawnImpl: mockSpawn({}, { title: "Example" }),
      }),
    ).rejects.toThrow(
      "src/episodes/source-package-overwrite-test/assets/source.json already exists; pass --force to replace it",
    );
  });

  it("rejects missing episodes without scaffolding", async () => {
    const slug = "source-package-missing-episode-test";

    await expect(
      runCaptureSource({
        sourceUrl: "https://example.com",
        slug,
        spawnImpl: mockSpawn({}, { title: "Example" }),
      }),
    ).rejects.toThrow(
      "Episode source-package-missing-episode-test does not exist. Create it first with bun run new-episode source-package-missing-episode-test, or pass --scaffold.",
    );
  });

  it("scaffolds a missing episode before writing source JSON", async () => {
    const slug = "source-package-scaffold-test";
    testSlugs.add(slug);
    const spawnImpl = mockScaffoldAndCapture(
      { "images/logo.svg": "<svg />" },
      { title: "Example", summary: "Captured summary.", text: "Captured summary." },
    );

    await runCaptureSource({
      sourceUrl: "https://example.com",
      slug,
      scaffold: true,
      spawnImpl,
    });

    expect(existsSync(path.join(episodesDir, slug, "index.html"))).toBe(true);
    expect(existsSync(path.join(episodesDir, slug, "meta.json"))).toBe(true);
    expect(existsSync(path.join(episodesDir, slug, "hyperframes.json"))).toBe(true);
    expect(existsSync(path.join(episodesDir, slug, "lib"))).toBe(true);
    expect(existsSync(path.join(episodesDir, slug, "assets/source.json"))).toBe(true);
    expect(
      spawnImpl.calls.some(
        (call) => call.args.join(" ") === "run new-episode source-package-scaffold-test",
      ),
    ).toBe(true);
  });

  it("does not re-scaffold an existing episode when scaffold is passed", async () => {
    const slug = "source-package-existing-scaffold-test";
    createEpisode(slug);
    const indexPath = path.join(episodesDir, slug, "index.html");
    const sentinel = "sentinel existing episode";
    writeFileSync(indexPath, sentinel);
    const before = statSync(indexPath).mtimeMs;
    const spawnImpl = mockScaffoldAndCapture(
      { "images/logo.svg": "<svg />" },
      { title: "Example", summary: "Captured summary.", text: "Captured summary." },
    );

    await runCaptureSource({
      sourceUrl: "https://example.com",
      slug,
      scaffold: true,
      spawnImpl,
    });

    expect(readFileSync(indexPath, "utf8")).toBe(sentinel);
    expect(statSync(indexPath).mtimeMs).toBe(before);
    expect(existsSync(path.join(episodesDir, slug, "assets/source.json"))).toBe(true);
    expect(spawnImpl.calls.some((call) => call.args[1] === "new-episode")).toBe(false);
  });
});
