// Ambient types for the scene-hub engine (plain .mjs in apps/hyperframe).
// Lets the MCP import the engine without a build step while keeping tsc green.
declare module "*/scripts/lib/assemble-episode.mjs" {
  export function assembleEpisode(
    spec: unknown,
    opts?: { hubRoot?: string },
  ): {
    html: string;
    scenes: Array<{ id: string; type: string; track: number; start: number; duration: number; mid: number }>;
    totalDuration: number;
    audioDuration: number;
    warnings: string[];
  };
}
