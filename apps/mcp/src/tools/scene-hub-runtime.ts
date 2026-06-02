// Bridge to the scene-hub engine that lives in apps/hyperframe. HUB_ROOT is
// resolved relative to this file so the tools work regardless of the server's
// cwd. The engine is plain .mjs (typed via src/scene-hub.d.ts).
import { resolve } from "node:path";

export const HUB_ROOT = resolve(import.meta.dir, "../../../hyperframe");

export { assembleEpisode } from "../../../hyperframe/scripts/lib/assemble-episode.mjs";
export {
  instantiateScene,
  listSceneTypes,
  resolveSceneType,
} from "../../../hyperframe/scripts/lib/scene-instantiator.mjs";
export { validateSceneSpec } from "../../../hyperframe/scripts/lib/scene-spec.mjs";
export { INTENTS, listSceneTypeSummaries, routeIntent } from "../../../hyperframe/scripts/lib/scene-router.mjs";
