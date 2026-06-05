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
import { decodeSceneSpec, formatParseError } from "@cgaravitoq/spec";
import { Either } from "effect";
import { resolveSceneType } from "./scene-instantiator.mjs";

function validateSlot(typeName, slotName, def, value, errors) {
  if (def.kind === "repeat") {
    if (!Array.isArray(value)) {
      errors.push(`scene "${typeName}" slot "${slotName}" must be an array of ${def.min}-${def.max} items`);
      return;
    }
    if (value.length < def.min || value.length > def.max) {
      errors.push(`scene "${typeName}" slot "${slotName}" has ${value.length} items; allowed range is ${def.min}-${def.max}`);
    }
    value.forEach((item, i) => {
      for (const [field, fdef] of Object.entries(def.item ?? {})) {
        const fv = item?.[field];
        if ((fv === undefined || fv === null || fv === "") && fdef.required && fdef.default === undefined) {
          errors.push(`scene "${typeName}" slot "${slotName}"[${i}] missing required field "${field}"`);
        }
      }
    });
  } else if ((value === undefined || value === null || value === "") && def.required && def.default === undefined) {
    errors.push(`scene "${typeName}" missing required slot "${slotName}"`);
  }
}

export function validateSceneSpec(spec, { hubRoot } = {}) {
  const warnings = [];

  if (!spec || typeof spec !== "object") return { ok: false, errors: ["spec is not an object"], warnings };

  const errors = Either.match(decodeSceneSpec(spec), {
    onLeft: (parseError) => formatParseError(parseError),
    onRight: () => [],
  });

  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    return { ok: false, errors, warnings };
  }

  const ids = new Set();
  for (const sc of spec.scenes) {
    const id = sc?.id;
    if (id != null && id !== "") {
      if (ids.has(id)) errors.push(`duplicate scene id "${id}"`);
      else ids.add(id);
    }

    const type = sc?.type;
    if (typeof type !== "string" || type === "") continue; // structural error already reported by the schema

    let resolved;
    try {
      resolved = resolveSceneType(type, sc.version ?? 1, hubRoot);
    } catch (err) {
      errors.push(err.message);
      continue;
    }
    const slots = resolved.manifest.slots ?? {};
    const params = sc.slots ?? {};
    for (const [name, def] of Object.entries(slots)) {
      validateSlot(type, name, def, params[name], errors);
    }
    for (const key of Object.keys(params)) {
      if (!(key in slots)) warnings.push(`scene "${id}" (${type}) has unknown param "${key}" — ignored`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
