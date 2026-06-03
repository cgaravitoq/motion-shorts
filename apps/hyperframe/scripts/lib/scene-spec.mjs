/**
 * scene-spec — the typed, machine-readable contract every short is authored
 * against. Agents fill params here; they never write HTML. validateSceneSpec
 * is a fast pre-flight (no assembly) used by the CLI and the MCP tools so an
 * agent gets precise, actionable errors before anything renders.
 *
 * Spec shape:
 *   {
 *     slug: "kebab-case",
 *     lang?: "es"|"en", width?: 1080, height?: 1920,
 *     palette?: { accent, accent2 },
 *     audioDuration?: number,
 *     scenes: [
 *       { id: "kebab", type: "<scene-type>", version?: 1, duration?: number,
 *         status?: "draft"|"approved", slots: { ... } }
 *     ]
 *   }
 */
import { resolveSceneType } from "./scene-instantiator.mjs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

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
  const errors = [];
  const warnings = [];

  if (!spec || typeof spec !== "object") return { ok: false, errors: ["spec is not an object"], warnings };
  if (!spec.slug || !SLUG_RE.test(spec.slug)) errors.push(`spec.slug must be kebab-case, got "${spec.slug}"`);
  for (const key of ["width", "height", "audioDuration"]) {
    if (spec[key] != null && (typeof spec[key] !== "number" || !Number.isFinite(spec[key]))) {
      errors.push(`spec.${key} must be a finite number`);
    }
  }
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    errors.push("spec.scenes must be a non-empty array");
    return { ok: false, errors, warnings };
  }

  const ids = new Set();
  for (const sc of spec.scenes) {
    if (!sc.id || !SLUG_RE.test(sc.id)) errors.push(`scene id must be kebab-case, got "${sc.id}"`);
    else if (ids.has(sc.id)) errors.push(`duplicate scene id "${sc.id}"`);
    else ids.add(sc.id);

    if (typeof sc.type !== "string" || sc.type === "") {
      errors.push(`scene "${sc.id}" type must be a non-empty string`);
      continue;
    }

    let resolved;
    try {
      resolved = resolveSceneType(sc.type, sc.version ?? 1, hubRoot);
    } catch (err) {
      errors.push(err.message);
      continue;
    }
    const slots = resolved.manifest.slots ?? {};
    const params = sc.slots ?? {};
    for (const [name, def] of Object.entries(slots)) {
      validateSlot(sc.type, name, def, params[name], errors);
    }
    for (const key of Object.keys(params)) {
      if (!(key in slots)) warnings.push(`scene "${sc.id}" (${sc.type}) has unknown param "${key}" — ignored`);
    }
    if (sc.duration != null && (typeof sc.duration !== "number" || !Number.isFinite(sc.duration) || sc.duration <= 0)) {
      errors.push(`scene "${sc.id}" duration must be a positive number`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
