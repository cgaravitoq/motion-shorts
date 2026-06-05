/**
 * episode-context — resolves everything distribution copy needs about an
 * episode (narration, spec text, captions timing, rendered-mp4 pin) from the
 * slug-keyed locations it lives in. Tolerates partial episodes: missing
 * inputs land in `warnings`, they never throw.
 */
import fs from "node:fs";
import path from "node:path";

const BREAK_TAG_RE = /<break\b[^>]*>/g;

export interface CaptionWord {
  end: number;
  [key: string]: unknown;
}

// MCP generate_audio writes { words: [...] }; the episode asset is a bare array.
export function parseCaptionWords(json: unknown): CaptionWord[] | null {
  const words = Array.isArray(json) ? json : (json as { words?: unknown } | null)?.words;
  return Array.isArray(words) ? (words as CaptionWord[]) : null;
}

export interface EpisodeRenderRef {
  key: string;
  sha256: string;
  bytes: number;
  runId: string | null;
}

export interface EpisodeContext {
  slug: string;
  meta: Record<string, unknown> | null;
  spec: Record<string, unknown> | null;
  narration: string | null;
  captions: {
    wordCount: number;
    endSeconds: number | null;
    durationSeconds: number | null;
  };
  renderRef: EpisodeRenderRef | null;
  warnings: string[];
}

export function resolveEpisodeContext(
  slug: string,
  { appRoot = process.cwd() }: { appRoot?: string } = {},
): EpisodeContext {
  const episodeDir = path.join(appRoot, "src/episodes", slug);
  const warnings: string[] = [];

  const readJson = (file: string, label: string): Record<string, unknown> | unknown[] | null => {
    if (!fs.existsSync(file)) {
      warnings.push(`${label} not found at ${path.relative(appRoot, file)}`);
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      warnings.push(`${label} is not valid JSON: ${detail}`);
      return null;
    }
  };

  const meta = readJson(path.join(episodeDir, "meta.json"), "meta.json") as Record<
    string,
    unknown
  > | null;
  const spec = readJson(path.join(episodeDir, "scene-spec.json"), "scene-spec.json") as Record<
    string,
    unknown
  > | null;

  const narrationPath = path.join(appRoot, "examples", `${slug}.txt`);
  let narration: string | null = null;
  if (fs.existsSync(narrationPath)) {
    narration = fs.readFileSync(narrationPath, "utf8").replace(BREAK_TAG_RE, "").trim();
  } else {
    warnings.push(`narration not found at examples/${slug}.txt`);
  }

  const captionsJson = readJson(path.join(episodeDir, "assets/captions.json"), "captions.json");
  const words = captionsJson ? parseCaptionWords(captionsJson) : null;
  if (captionsJson && !words)
    warnings.push("captions.json has neither a bare word array nor a words[] wrapper");
  const endSeconds = words?.length ? (words[words.length - 1]?.end ?? null) : null;
  const tail = typeof meta?.tail === "number" ? meta.tail : 0;
  const captions = {
    wordCount: words?.length ?? 0,
    endSeconds,
    durationSeconds: endSeconds != null ? Number((endSeconds + tail).toFixed(3)) : null,
  };

  const renderManifest = readJson(
    path.join(episodeDir, "render.remote.json"),
    "render.remote.json",
  ) as { objects?: Array<Record<string, unknown>>; runId?: string } | null;
  const renderObject = renderManifest?.objects?.find(
    (o) => o.category === "renders" && o.contentType === "video/mp4",
  );
  const renderRef: EpisodeRenderRef | null = renderObject
    ? {
        key: renderObject.key as string,
        sha256: renderObject.sha256 as string,
        bytes: renderObject.bytes as number,
        runId: renderManifest?.runId ?? null,
      }
    : null;
  if (renderManifest && !renderObject)
    warnings.push("render.remote.json has no rendered mp4 object");

  return { slug, meta, spec, narration, captions, renderRef, warnings };
}
