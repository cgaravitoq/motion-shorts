/**
 * Cloudflare infra as Effect code (Alchemy v2).
 *
 *   bun run plan          preview (stage dev_<user> by default)
 *   bun run deploy:e2e    deploy the e2e stage (own bucket + worker, disposable)
 *   bun run destroy:e2e   tear the e2e stage down
 *   bun alchemy deploy alchemy.run.ts --stage prod --adopt
 *                         take over the EXISTING production bucket "renders"
 *                         (retain policy: destroy never deletes it)
 *
 * Auth: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars, or `bun alchemy login`.
 * The worker secret comes from R2_UPLOAD_GATEWAY_TOKEN.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "motion-shorts",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const isProd = stage === "prod";

    // prod adopts the EXISTING bucket holding the published finals — retained
    // forever (destroy removes it from state, never from Cloudflare). Other
    // stages get their own auto-named disposable bucket.
    const bucket = yield* Cloudflare.R2Bucket("Renders", isProd ? { name: "renders" } : {}).pipe(
      Alchemy.RemovalPolicy.retain(isProd),
    );

    const gateway = yield* Cloudflare.Worker("UploadGateway", {
      main: "./src/gateway.ts",
      env: {
        BUCKET: bucket,
        UPLOAD_TOKEN: Config.redacted("R2_UPLOAD_GATEWAY_TOKEN"),
      },
      url: true,
    });

    return {
      bucketName: bucket.bucketName,
      gatewayUrl: gateway.url,
    };
  }),
);
