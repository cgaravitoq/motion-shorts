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

    const bucket = yield* Cloudflare.R2Bucket("Renders", isProd ? { name: "renders" } : {}).pipe(
      Alchemy.RemovalPolicy.retain(isProd),
    );

    const gateway = yield* Cloudflare.Worker("Gateway", {
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
