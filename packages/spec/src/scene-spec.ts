import { Schema } from "effect";
import { exitToResult } from "./parse-error";

export const Slug = Schema.String.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/),
).annotate({
  identifier: "Slug",
  message: "must be kebab-case (lowercase letters, digits, hyphens)",
});

const FiniteNumber = Schema.Number.check(Schema.isFinite());
const PositiveSeconds = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0));

export const SceneStatus = Schema.Literals(["draft", "approved"]);
export type SceneStatus = typeof SceneStatus.Type;

export const SceneSpecScene = Schema.Struct({
  id: Slug,
  type: Schema.NonEmptyString,
  version: Schema.optional(Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0))),
  duration: Schema.optional(PositiveSeconds),
  status: Schema.optional(SceneStatus),
  slots: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type SceneSpecScene = typeof SceneSpecScene.Type;

export const SceneSpec = Schema.Struct({
  slug: Slug,
  lang: Schema.optional(Schema.String),
  width: Schema.optional(FiniteNumber),
  height: Schema.optional(FiniteNumber),
  audioDuration: Schema.optional(FiniteNumber),
  palette: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  scenes: Schema.NonEmptyArray(SceneSpecScene),
});
export type SceneSpec = typeof SceneSpec.Type;

const decode = Schema.decodeUnknownExit(SceneSpec, { errors: "all" });
export const decodeSceneSpec = (input: unknown) => exitToResult(decode(input));
