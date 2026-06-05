import { Schema } from "effect";

export const Slug = Schema.String.pipe(Schema.pattern(/^[a-z0-9][a-z0-9-]*$/)).annotations({
  identifier: "Slug",
  message: () => "must be kebab-case (lowercase letters, digits, hyphens)",
});

const FiniteNumber = Schema.Number.pipe(Schema.finite());
const PositiveSeconds = Schema.Number.pipe(Schema.finite(), Schema.positive());

export const SceneStatus = Schema.Literal("draft", "approved");
export type SceneStatus = typeof SceneStatus.Type;

export const SceneSpecScene = Schema.Struct({
  id: Slug,
  type: Schema.NonEmptyString,
  version: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  duration: Schema.optional(PositiveSeconds),
  status: Schema.optional(SceneStatus),
  slots: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
export type SceneSpecScene = typeof SceneSpecScene.Type;

export const SceneSpec = Schema.Struct({
  slug: Slug,
  lang: Schema.optional(Schema.String),
  width: Schema.optional(FiniteNumber),
  height: Schema.optional(FiniteNumber),
  audioDuration: Schema.optional(FiniteNumber),
  palette: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  scenes: Schema.NonEmptyArray(SceneSpecScene),
});
export type SceneSpec = typeof SceneSpec.Type;

export const decodeSceneSpec = Schema.decodeUnknownEither(SceneSpec, { errors: "all" });
