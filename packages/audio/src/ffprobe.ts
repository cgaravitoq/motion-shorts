import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
