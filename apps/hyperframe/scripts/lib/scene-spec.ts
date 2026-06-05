/**
 * scene-spec — the typed, machine-readable contract every short is authored
 * against. Agents fill params here; they never write HTML. validateSceneSpec
 * is a fast pre-flight (no assembly) used by the CLI and the MCP tools so an
 * agent gets precise, actionable errors before anything renders.
 *
 * Structural shape lives in @cgaravitoq/spec (Effect Schema — single source
 * of truth shared with the MCP tools). The relational checks that need disk
 * access (scene-type resolution, slot-vs-manifest, duplicate ids) stay here.
 */
import { decodeSceneSpec, formatParseError, type SlotDef } from "@cgaravitoq/spec";
import { Either } from "effect";
import { resolveSceneType } from "./scene-instantiator";

export interface SceneSpecValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function validateSlot(
  typeName: string,
  slotName: string,
  def: SlotDef,
  value: unknown,
  errors: string[],
): void {
  if (def.kind === "repeat") {
    if (!Array.isArray(value)) {
      errors.push(`scene "${typeName}" slot "${slotName}" must be an array of ${def.min}-${def.max} items`);
      return;
    }
    if (value.length < def.min || value.length > def.max) {
      errors.push(`scene "${typeName}" slot "${slotName}" has ${value.length} items; allowed range is ${def.min}-${def.max}`);
    }
    value.forEach((item: unknown, i) => {
      for (const [field, fdef] of Object.entries(def.item ?? {})) {
        const fv = (item as Record<string, unknown> | null | undefined)?.[field];
        if ((fv === undefined || fv === null || fv === "") && fdef.required && fdef.default === undefined) {
          errors.push(`scene "${typeName}" slot "${slotName}"[${i}] missing required field "${field}"`);
        }
      }
    });
  } else if ((value === undefined || value === null || value === "") && def.required && def.default === undefined) {
    errors.push(`scene "${typeName}" missing required slot "${slotName}"`);
  }
}

export function validateSceneSpec(
  spec: unknown,
  { hubRoot }: { hubRoot?: string } = {},
): SceneSpecValidation {
  const warnings: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { ok: false, errors: ["spec is not an object"], warnings };
  }

  const errors = Either.match(decodeSceneSpec(spec), {
    onLeft: (parseError) => formatParseError(parseError),
    onRight: () => [] as string[],
  });

  const rawScenes = (spec as { scenes?: unknown }).scenes;
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    return { ok: false, errors, warnings };
  }

  const ids = new Set<unknown>();
  for (const item of rawScenes as unknown[]) {
    const sc = (item ?? {}) as Record<string, unknown>;
    const id = sc.id;
    if (id != null && id !== "") {
      if (ids.has(id)) errors.push(`duplicate scene id "${id}"`);
      else ids.add(id);
    }

    const type = sc.type;
    if (typeof type !== "string" || type === "") continue; // structural error already reported by the schema

    let resolved: ReturnType<typeof resolveSceneType>;
    try {
      resolved = resolveSceneType(type, (sc.version as number | undefined) ?? 1, hubRoot);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }
    const slots = resolved.manifest.slots;
    const params = (sc.slots ?? {}) as Record<string, unknown>;
    for (const [name, def] of Object.entries(slots)) {
      validateSlot(type, name, def, params[name], errors);
    }
    for (const key of Object.keys(params)) {
      if (!(key in slots)) warnings.push(`scene "${id}" (${type}) has unknown param "${key}" — ignored`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
