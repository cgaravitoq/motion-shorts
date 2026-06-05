import fs from "node:fs";
import path from "node:path";

export type PublishPlatform = "youtube" | "instagram";

export interface StoredToken {
  platform: PublishPlatform;
  accessToken: string;
  refreshToken?: string;
  igUserId?: string;
  username?: string;
  obtainedAt: string;
  expiresAt?: string;
}

export const tokenPath = (secretsDir: string, platform: PublishPlatform): string =>
  path.join(secretsDir, `${platform}-token.json`);

export const readStoredToken = (
  secretsDir: string,
  platform: PublishPlatform,
): StoredToken | null => {
  const file = tokenPath(secretsDir, platform);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as StoredToken;
};

export const writeStoredToken = (secretsDir: string, token: StoredToken): string => {
  fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  const file = tokenPath(secretsDir, token.platform);
  fs.writeFileSync(file, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
  return file;
};
