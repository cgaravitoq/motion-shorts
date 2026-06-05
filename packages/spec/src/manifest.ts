import { Schema } from "effect";

export const ScalarSlotKind = Schema.Literal("text", "richText");
export type ScalarSlotKind = typeof ScalarSlotKind.Type;

export const ItemFieldDef = Schema.Struct({
  kind: ScalarSlotKind,
  required: Schema.optional(Schema.Boolean),
  default: Schema.optional(Schema.String),
});
export type ItemFieldDef = typeof ItemFieldDef.Type;

export const ScalarSlotDef = Schema.Struct({
  kind: ScalarSlotKind,
  required: Schema.optional(Schema.Boolean),
  default: Schema.optional(Schema.String),
});
export type ScalarSlotDef = typeof ScalarSlotDef.Type;

export const RepeatSlotDef = Schema.Struct({
  kind: Schema.Literal("repeat"),
  min: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  max: Schema.Number.pipe(Schema.int(), Schema.positive()),
  item: Schema.Record({ key: Schema.String, value: ItemFieldDef }),
});
export type RepeatSlotDef = typeof RepeatSlotDef.Type;

export const SlotDef = Schema.Union(ScalarSlotDef, RepeatSlotDef);
export type SlotDef = typeof SlotDef.Type;

export const SceneTypeManifest = Schema.Struct({
  id: Schema.NonEmptyString,
  type: Schema.NonEmptyString,
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  label: Schema.NonEmptyString,
  description: Schema.String,
  builder: Schema.NonEmptyString,
  classPrefix: Schema.NonEmptyString,
  defaultDuration: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  intentTags: Schema.Array(Schema.String),
  slots: Schema.Record({ key: Schema.String, value: SlotDef }),
  validation: Schema.Array(Schema.String),
  fixedTrack: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  role: Schema.optional(Schema.String),
});
export type SceneTypeManifest = typeof SceneTypeManifest.Type;

export const decodeSceneTypeManifest = Schema.decodeUnknownEither(SceneTypeManifest, {
  errors: "all",
});
