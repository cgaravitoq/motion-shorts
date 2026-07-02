import { describe, expect, it } from "bun:test";
import { validateDistribution } from "../distribution-spec";

const SHA = "a".repeat(64);
const STALE = "b".repeat(64);

const copy = {
  youtube: {
    title: "Agentes vs workflows: la diferencia que importa (+1 dato real)",
    description: `La mayoría de demos de agentes son workflows.\n\n🔌 Un workflow sigue una ruta fija.\n🔧 Un agente decide el siguiente paso.\n\nFuente: ejemplo.\n\n#AIEngineering #Agents #Workflows #LLM #DevTools`,
  },
  instagram: {
    caption:
      "La mayoría de demos de agentes son workflows. 📌 Dato clave. #AIEngineering #Agents #Workflows #LLM #DevTools",
  },
  tiktok: {
    caption: "¿Agente o workflow? El test en 30s. #AIEngineering #Agents #Workflows #LLM #DevTools",
  },
  linkedin: {
    post: "La mayoría de demos de agentes no son agentes.\n\nSon workflows.\n\n#AIEngineering #Agents",
  },
};

interface PlatformEntry<Copy> {
  status: string;
  es: Copy;
  en?: Copy;
}

interface Dist {
  slug: string;
  renderRef: { sha256: string; key?: string } | null;
  platforms: {
    youtube: PlatformEntry<{ title: string; description: string }>;
    instagram: PlatformEntry<{ caption: string }>;
    tiktok: PlatformEntry<{ caption: string }>;
    linkedin: PlatformEntry<{ post: string }>;
    facebook?: PlatformEntry<{ caption: string }>;
  };
}

const validDist = (overrides: Partial<Dist> = {}): Dist =>
  structuredClone({
    slug: "demo-episode",
    renderRef: {
      sha256: SHA,
      key: "motion-shorts/episodes/demo-episode/final/renders/demo-episode.mp4",
    },
    platforms: {
      youtube: { status: "draft", es: copy.youtube, en: copy.youtube },
      instagram: { status: "draft", es: copy.instagram, en: copy.instagram },
      tiktok: { status: "draft", es: copy.tiktok, en: copy.tiktok },
      linkedin: { status: "draft", es: copy.linkedin, en: copy.linkedin },
    },
    ...overrides,
  });

describe("validateDistribution", () => {
  it("accepts a complete draft distribution", () => {
    const { ok, errors, warnings } = validateDistribution(validDist(), { renderSha256: SHA });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(ok).toBe(true);
  });

  it("rejects hard platform limits", () => {
    const dist = validDist();
    dist.platforms.youtube.es = {
      title: "x".repeat(101),
      description: "desc with <b>html</b> #a #b #c",
    };
    dist.platforms.linkedin.es = { post: `${"x".repeat(3001)} #a #b #c` };
    const { ok, errors } = validateDistribution(dist, { renderSha256: SHA });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("youtube.es.title"))).toBe(true);
    expect(errors.some((e) => e.includes("must not contain < or >"))).toBe(true);
    expect(errors.some((e) => e.includes("linkedin.es.post"))).toBe(true);
  });

  it("measures youtube description in UTF-8 bytes", () => {
    const dist = validDist();
    dist.platforms.youtube.es.description = `${"á".repeat(2600)} #a #b #c`;
    const { ok, errors } = validateDistribution(dist, { renderSha256: SHA });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("UTF-8 bytes"))).toBe(true);
  });

  it("warns on house style without failing", () => {
    const dist = validDist();
    dist.platforms.tiktok.es.caption = "Sin hashtags aquí";
    dist.platforms.tiktok.en = undefined;
    const { ok, warnings } = validateDistribution(dist, { renderSha256: SHA });
    expect(ok).toBe(true);
    expect(warnings.some((w) => w.includes("house style"))).toBe(true);
    expect(warnings.some((w) => w.includes('missing "en"'))).toBe(true);
  });

  it("applies per-platform hashtag bands", () => {
    const dist = validDist();
    dist.platforms.linkedin.es.post = "Texto de prueba con cuatro tags. #a #b #c #d";
    dist.platforms.youtube.es.description = "Texto con pocos tags. #a #b #c #d";
    const { ok, warnings } = validateDistribution(dist, { renderSha256: SHA });
    expect(ok).toBe(true);
    expect(
      warnings.some((w) => w.includes("linkedin.es.post has 4 hashtags; house style is 0-3")),
    ).toBe(true);
    expect(
      warnings.some((w) => w.includes("youtube.es.description has 4 hashtags; house style is 5-7")),
    ).toBe(true);
  });

  it("warns when ES and EN hashtag sets differ", () => {
    const dist = validDist();
    dist.platforms.instagram.en = { caption: "Same text, other tags. #Different #Tags #Here" };
    const { warnings } = validateDistribution(dist, { renderSha256: SHA });
    expect(warnings.some((w) => w.includes("different hashtag sets"))).toBe(true);
  });

  it("blocks approval against a stale or missing render pin", () => {
    const stale = validDist();
    stale.platforms.youtube.status = "approved";
    const { ok, errors } = validateDistribution(stale, { renderSha256: STALE });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("stale render"))).toBe(true);

    const unpinned = validDist({ renderRef: null });
    unpinned.platforms.youtube.status = "approved";
    expect(validateDistribution(unpinned, { renderSha256: SHA }).ok).toBe(false);

    const unrendered = validDist();
    unrendered.platforms.youtube.status = "approved";
    expect(validateDistribution(unrendered, { renderSha256: undefined }).ok).toBe(false);
  });

  it("accepts approval when the pin matches", () => {
    const dist = validDist();
    dist.platforms.youtube.status = "approved";
    const { ok, errors } = validateDistribution(dist, { renderSha256: SHA });
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it("rejects unknown platforms and bad statuses", () => {
    const dist = validDist();
    dist.platforms.facebook = { status: "draft", es: { caption: "x #a #b #c" } };
    dist.platforms.youtube.status = "published";
    const { ok, errors } = validateDistribution(dist, { renderSha256: SHA });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('unknown platform "facebook"'))).toBe(true);
    expect(errors.some((e) => e.includes("status must be one of"))).toBe(true);
  });
});
