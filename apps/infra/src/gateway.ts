/**
 * upload-gateway Worker entrypoint. Alchemy bundles this file (rolldown)
 * and binds BUCKET (R2) + UPLOAD_TOKEN (secret) per alchemy.run.ts.
 */
import * as Effect from "effect/Effect";
import { type GatewayBucket, handleGatewayRequest } from "./gateway-core";

interface Env {
  readonly BUCKET: GatewayBucket;
  readonly UPLOAD_TOKEN: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return Effect.runPromise(
      handleGatewayRequest(request, { bucket: env.BUCKET, token: env.UPLOAD_TOKEN }),
    );
  },
};
