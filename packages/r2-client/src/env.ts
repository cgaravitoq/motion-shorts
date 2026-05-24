import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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
  runtimeEnv: process.env,
});
