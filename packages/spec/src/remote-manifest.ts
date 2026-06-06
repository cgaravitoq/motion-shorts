import { Schema } from "effect";
import { exitToResult } from "./parse-error";

export const Sha256Hex = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)).annotate({
  identifier: "Sha256Hex",
  message: "must be a 64-char lowercase hex sha256",
});

export const RemoteObject = Schema.Struct({
  key: Schema.NonEmptyString,
  bytes: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  sha256: Sha256Hex,
  category: Schema.optional(Schema.String),
  path: Schema.optional(Schema.NullOr(Schema.String)),
  contentType: Schema.optional(Schema.String),
  urlStrategy: Schema.optional(Schema.String),
  url: Schema.optional(Schema.NullOr(Schema.String)),
  signedUrlTtlSeconds: Schema.optional(Schema.NullOr(Schema.Number)),
});
export type RemoteObject = typeof RemoteObject.Type;

export const RemoteManifest = Schema.Struct({
  objects: Schema.Array(RemoteObject),
  provider: Schema.optional(Schema.String),
  bucket: Schema.optional(Schema.String),
  episodeSlug: Schema.optional(Schema.String),
  runId: Schema.optional(Schema.String),
  generatedAt: Schema.optional(Schema.String),
  deleteLocal: Schema.optional(Schema.Boolean),
});
export type RemoteManifest = typeof RemoteManifest.Type;

const decode = Schema.decodeUnknownExit(RemoteManifest, { errors: "all" });
export const decodeRemoteManifest = (input: unknown) => exitToResult(decode(input));
