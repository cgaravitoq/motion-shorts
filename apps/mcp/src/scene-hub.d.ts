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
declare module "*/scripts/lib/scene-instantiator.mjs" {
  export function instantiateScene(args: {
    type: string;
    version?: number;
    params?: Record<string, unknown>;
    hubRoot?: string;
  }): { html: string; css: string; timeline: string; manifest: Record<string, unknown> };
  export function resolveSceneType(
    type: string,
    version?: number,
    hubRoot?: string,
  ): { dir: string; manifest: Record<string, unknown>; fragment: string; styles: string; timeline: string };
  export function listSceneTypes(
    hubRoot?: string,
  ): Array<{ type: string; version: number; manifest: Record<string, unknown> }>;
}
declare module "*/scripts/lib/scene-spec.mjs" {
  export function validateSceneSpec(
    spec: unknown,
    opts?: { hubRoot?: string },
  ): { ok: boolean; errors: string[]; warnings: string[] };
}
declare module "*/scripts/lib/scene-router.mjs" {
  export const INTENTS: string[];
  export function routeIntent(
    intent: string,
    opts?: { hubRoot?: string },
  ): { intent: string; skeleton: string[]; recommended: unknown[]; structural: string[] };
  export function listSceneTypeSummaries(hubRoot?: string): Array<{
    type: string;
    version: number;
    id: string;
    label: string;
    description: string;
    defaultDuration: number;
    intentTags: string[];
    slots: string;
  }>;
}
