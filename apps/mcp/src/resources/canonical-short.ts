import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const canonicalShortResource = {
  uri: "file:///canonical-short/SKILL.md",
  name: "canonical-short",
  description:
    "Authoring guide for vertical 9:16 motion-graphics shorts. The agent should read this resource before composing HTML for render_composition. Covers Hyperframes invariants (single-file HTML, GSAP timeline registry, frame-accurate seek), captions JSON shape, and the canonical layout grid.",
  mimeType: "text/markdown",
};

const canonicalShortSkillPath = fileURLToPath(
  new URL("../../../../.agents/skills/canonical-short/SKILL.md", import.meta.url),
);

export const readCanonicalShortResource = async (): Promise<string> => {
  try {
    return await readFile(canonicalShortSkillPath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `canonical-short resource: SKILL.md not found at ${canonicalShortSkillPath}. Verify the MCP is launched with cwd at the repo root.`,
      );
    }

    throw error;
  }
};
