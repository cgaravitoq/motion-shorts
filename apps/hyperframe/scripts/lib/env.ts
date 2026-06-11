import fs from "node:fs";
import path from "node:path";

type RuntimeEnv = Record<string, string | undefined>;

const parseDotenv = (source: string): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
};

const findWorkspaceEnvPath = (startDir: string = import.meta.dirname): string | null => {
  let current = path.resolve(startDir);
  while (true) {
    const envPath = path.join(current, ".env");
    const hasWorkspaceMarker = ["turbo.json", "bun.lockb", "bun.lock"].some((marker) =>
      fs.existsSync(path.join(current, marker)),
    );
    if (hasWorkspaceMarker && fs.existsSync(envPath)) {
      return envPath;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const loadWorkspaceEnv = (runtimeEnv: RuntimeEnv): RuntimeEnv => {
  const envPath = findWorkspaceEnvPath();
  if (!envPath) return runtimeEnv;

  const source = fs.readFileSync(envPath, "utf8");
  for (const [key, value] of parseDotenv(source)) {
    if (!runtimeEnv[key]) {
      runtimeEnv[key] = value;
    }
  }
  return runtimeEnv;
};

loadWorkspaceEnv(process.env);

const read = (name: string): string | undefined => process.env[name] || undefined;

export const env = {
  brandName: read("BRAND_NAME"),
  brandTagline: read("BRAND_TAGLINE"),
};
