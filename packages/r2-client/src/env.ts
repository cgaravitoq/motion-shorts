import fs from "node:fs";
import path from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export type RuntimeEnv = Record<string, string | undefined>;

export const parseDotenv = (source: string): Array<[string, string]> => {
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

export const findWorkspaceEnvPath = (startDir: string = import.meta.dirname): string | null => {
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

export const loadWorkspaceEnv = (
  runtimeEnv: RuntimeEnv,
  startDir: string = import.meta.dirname,
): { runtimeEnv: RuntimeEnv; loaded: boolean } => {
  const envPath = findWorkspaceEnvPath(startDir);
  if (!envPath) return { runtimeEnv, loaded: false };

  const source = fs.readFileSync(envPath, "utf8");
  for (const [key, value] of parseDotenv(source)) {
    if (!runtimeEnv[key]) {
      runtimeEnv[key] = value;
    }
  }
  return { runtimeEnv, loaded: true };
};

export const env = createEnv({
  server: {
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    R2_ENDPOINT_URL: z.string().min(1).optional(),
    R2_PUBLIC_BASE_URL: z.string().min(1).optional(),
    R2_PUBLIC_URL_BASE: z.string().min(1).optional(),
    R2_SIGNED_URL_TTL_SECONDS: z.string().min(1).optional(),
    R2_REQUEST_TIMEOUT_MS: z.string().min(1).optional(),
    R2_UPLOAD_GATEWAY_URL: z.string().min(1).optional(),
    R2_UPLOAD_GATEWAY_TOKEN: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID_WRITE: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY_WRITE: z.string().min(1).optional(),
  },
  emptyStringAsUndefined: true,
  runtimeEnv: loadWorkspaceEnv(process.env).runtimeEnv,
});
