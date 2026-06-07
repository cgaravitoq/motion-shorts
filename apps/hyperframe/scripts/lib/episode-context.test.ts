import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type CaptionWord, parseCaptionWords, resolveEpisodeContext } from "./episode-context";

const WORDS = [
  { text: "Hello", start: 0.1, end: 0.4, confidence: 1 },
  { text: " world", start: 0.5, end: 0.9, confidence: 1 },
];

type CaptionsFixture = CaptionWord[] | { words: CaptionWord[] };

const setupEpisode = async ({
  captions,
  withRender = true,
}: {
  captions?: CaptionsFixture;
  withRender?: boolean;
} = {}) => {
  const appRoot = await mkdtemp(path.join(tmpdir(), "episode-context-"));
  const episodeDir = path.join(appRoot, "src/episodes/demo-ep");
  await mkdir(path.join(episodeDir, "assets"), { recursive: true });
  await mkdir(path.join(appRoot, "examples"), { recursive: true });
  await writeFile(
    path.join(episodeDir, "meta.json"),
    JSON.stringify({ id: "demo-ep", title: "Demo", tail: 2 }),
  );
  await writeFile(
    path.join(episodeDir, "scene-spec.json"),
    JSON.stringify({ slug: "demo-ep", scenes: [] }),
  );
  await writeFile(
    path.join(appRoot, "examples/demo-ep.txt"),
    'Hello <break time="1.0s" /> world.\n',
  );
  if (captions)
    await writeFile(path.join(episodeDir, "assets/captions.json"), JSON.stringify(captions));
  if (withRender) {
    await writeFile(
      path.join(episodeDir, "render.remote.json"),
      JSON.stringify({
        runId: "2026-06-05T000000Z",
        objects: [
          {
            key: "k/demo-ep.mp4",
            category: "renders",
            contentType: "video/mp4",
            sha256: "f".repeat(64),
            bytes: 10,
          },
        ],
      }),
    );
  }
  return appRoot;
};

describe("parseCaptionWords", () => {
  it("accepts both the bare array and the words wrapper", () => {
    expect(parseCaptionWords(WORDS)).toHaveLength(2);
    expect(parseCaptionWords({ words: WORDS })).toHaveLength(2);
    expect(parseCaptionWords({ segments: [] })).toBeNull();
  });
});

describe("resolveEpisodeContext", () => {
  it("resolves narration, captions duration with tail, and the render pin", async () => {
    const appRoot = await setupEpisode({ captions: WORDS });
    const ctx = resolveEpisodeContext("demo-ep", { appRoot });
    expect(ctx.narration).toBe("Hello  world.");
    expect(ctx.captions).toEqual({ wordCount: 2, endSeconds: 0.9, durationSeconds: 2.9 });
    expect(ctx.renderRef?.sha256).toBe("f".repeat(64));
    expect(ctx.warnings).toEqual([]);
  });

  it("handles the words-wrapper captions shape", async () => {
    const appRoot = await setupEpisode({ captions: { words: WORDS } });
    const ctx = resolveEpisodeContext("demo-ep", { appRoot });
    expect(ctx.captions.wordCount).toBe(2);
  });

  it("collects warnings for missing inputs instead of throwing", async () => {
    const appRoot = await setupEpisode({ withRender: false });
    const ctx = resolveEpisodeContext("demo-ep", { appRoot });
    expect(ctx.renderRef).toBeNull();
    expect(ctx.captions.durationSeconds).toBeNull();
    expect(ctx.warnings.some((w) => w.includes("captions.json"))).toBe(true);
    expect(ctx.warnings.some((w) => w.includes("render.remote.json"))).toBe(true);
  });
});
