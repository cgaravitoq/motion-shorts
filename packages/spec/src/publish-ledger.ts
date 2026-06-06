import { Schema } from "effect";
import { exitToResult } from "./parse-error";

export const PublishRecord = Schema.Struct({
  status: Schema.Literals(["published", "inbox", "failed"]),
  id: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  publishedAt: Schema.optional(Schema.String),
  renderSha256: Schema.String,
  lang: Schema.String,
  privacy: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});
export type PublishRecord = typeof PublishRecord.Type;

export const PublishLedger = Schema.Struct({
  slug: Schema.String,
  updatedAt: Schema.String,
  platforms: Schema.Record(Schema.String, PublishRecord),
});
export type PublishLedger = typeof PublishLedger.Type;

const decode = Schema.decodeUnknownExit(PublishLedger, { errors: "all" });
export const decodePublishLedger = (input: unknown) => exitToResult(decode(input));
