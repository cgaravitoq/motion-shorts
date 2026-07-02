import { Schema } from "effect";
import { exitToResult } from "./parse-error";

export const ScalarSlotKind = Schema.Literals(["text", "richText", "image"]);
export type ScalarSlotKind = typeof ScalarSlotKind.Type;

const NonNegativeInt = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const PositiveInt = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));

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
  min: NonNegativeInt,
  max: PositiveInt,
  item: Schema.Record(Schema.String, ItemFieldDef),
});
export type RepeatSlotDef = typeof RepeatSlotDef.Type;

export const SlotDef = Schema.Union([ScalarSlotDef, RepeatSlotDef]);
export type SlotDef = typeof SlotDef.Type;

export const SceneTypeManifest = Schema.Struct({
  id: Schema.NonEmptyString,
  type: Schema.NonEmptyString,
  version: PositiveInt,
  label: Schema.NonEmptyString,
  description: Schema.String,
  builder: Schema.NonEmptyString,
  classPrefix: Schema.NonEmptyString,
  defaultDuration: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0)),
  intentTags: Schema.Array(Schema.String),
  slots: Schema.Record(Schema.String, SlotDef),
  validation: Schema.Array(Schema.String),
  fixedTrack: Schema.optional(NonNegativeInt),
  role: Schema.optional(Schema.String),
  layout: Schema.optional(Schema.Literals(["top-left", "centered"])),
});
export type SceneTypeManifest = typeof SceneTypeManifest.Type;

const decode = Schema.decodeUnknownExit(SceneTypeManifest, { errors: "all" });
export const decodeSceneTypeManifest = (input: unknown) => exitToResult(decode(input));
