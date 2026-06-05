import { Schema } from "effect";

export const PublishRecord = Schema.Struct({
  status: Schema.Literal("published", "inbox", "failed"),
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
  platforms: Schema.Record({ key: Schema.String, value: PublishRecord }),
});
export type PublishLedger = typeof PublishLedger.Type;

export const decodePublishLedger = Schema.decodeUnknownEither(PublishLedger, { errors: "all" });
