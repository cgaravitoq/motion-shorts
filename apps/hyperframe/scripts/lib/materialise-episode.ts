/**
 * Shared working-copy materialisation for the scene-qa and render-episode
 * pipelines. Both build a self-contained copy of an episode under
 * `out/episodes/<slug>[/<variant>]/`: the (already-stamped) index.html, a
 * `lib` + `assets` symlink back to the originals, and a favicon so Chromium
 * stops logging 404s. `src/episodes/<slug>/` is never touched.
 *
 * The HTML is the caller's responsibility — render-episode stamps duration,
 * fps, brand vars, and inlines captions; scene-qa inlines captions only. This
 * helper owns the filesystem scaffold the two pipelines share verbatim.
 */
import fs from "node:fs";
import path from "node:path";

// 1x1 transparent GIF served as favicon.ico. Chromium auto-fetches
// /favicon.ico on every page load; without this, each render/snapshot worker
// logs a `[non-blocking] 404` line. Pure console noise.
const FAVICON_GIF_HEX =
  "47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b";

// Recreate every symlink so re-running with a moved repo doesn't keep a stale
// link. lstatSync handles broken symlinks (existsSync wouldn't). `recursive:
// true` covers the rare case where a real directory was dropped in place of
// the symlink.
const ensureSymlink = (linkPath: string, targetAbs: string): void => {
  try {
    fs.lstatSync(linkPath);
    fs.rmSync(linkPath, { force: true, recursive: true });
  } catch {
    // Doesn't exist — nothing to remove.
  }
  if (fs.existsSync(targetAbs)) {
    fs.symlinkSync(path.relative(path.dirname(linkPath), targetAbs), linkPath, "dir");
  }
};

export interface MaterialiseOptions {
  workDir: string;
  html: string;
  libTarget: string;
  assetsTarget: string;
}

/**
 * Write the working-copy scaffold: index.html, lib + assets symlinks, favicon.
 * Returns the resolved workDir for convenience.
 *
 * FOOTGUN: `lib` and `assets` are symlinks pointing back to `src/`. Standard
 * POSIX `rm -rf` removes the symlinks themselves, not their targets — but
 * commands that follow symlinks (`find -delete`, `rsync --delete`, some Node
 * `fs.rm` configs) can nuke src/. To clean a working copy, target the dir
 * explicitly (`rm -rf out/episodes/<slug>`) and never run symlink-following
 * tools on `out/`.
 */
export const materialiseEpisode = ({
  workDir,
  html,
  libTarget,
  assetsTarget,
}: MaterialiseOptions): string => {
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, "index.html"), html);
  ensureSymlink(path.join(workDir, "lib"), libTarget);
  ensureSymlink(path.join(workDir, "assets"), assetsTarget);
  fs.writeFileSync(path.join(workDir, "favicon.ico"), Buffer.from(FAVICON_GIF_HEX, "hex"));
  return workDir;
};
