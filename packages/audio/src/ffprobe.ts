import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Read a media file's duration in seconds via ffprobe.
 * Returns -1 when ffprobe is unavailable or the probe fails. Logs a warning
 * with stderr so a missing ffmpeg or a corrupt input is debuggable instead
 * of a silent -1.
 *
 * Async + non-blocking: uses execFile (not spawnSync) so server-side
 * consumers don't stall the event loop. Argument array (no shell) keeps
 * paths with `"`, `;`, `$()`, etc. safe.
 */
export const getAudioDurationSeconds = async (audioPath: string): Promise<number> => {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      audioPath,
    ]);
    const parsed = Number.parseFloat(stdout.trim());
    return Number.isFinite(parsed) ? parsed : -1;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string | Buffer };
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr.trim()
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8").trim()
          : "";
    if (e.code === "ENOENT") {
      console.warn(`[ffprobe] binary not found while probing ${audioPath}. Install ffmpeg.`);
    } else {
      console.warn(
        `[ffprobe] failed for ${audioPath}: ${e.message}${stderr ? ` — ${stderr}` : ""}`,
      );
    }
    return -1;
  }
};
