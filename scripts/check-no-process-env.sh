#!/usr/bin/env bash
set -euo pipefail

# Known blind spot: destructuring reads like `const { FOO } = process.env`.
OFFENDERS="$(rg "process\.env[\.\[]" apps/ packages/ --type ts | grep -v "/env\.ts:" || true)"

if [[ -n "${OFFENDERS}" ]]; then
  echo "ERROR: process.env reads are only allowed in env.ts files." >&2
  echo "${OFFENDERS}" >&2
  echo "Move env reads into the package's env.ts file. See AGENTS.md for the pattern." >&2
  exit 1
fi

# zod is frozen at the t3-env boundary; domain validation is Effect Schema
# (@cgaravitoq/spec). Catch new zod imports before they grow a second
# validation system.
ZOD_OFFENDERS="$(rg "from \"zod\"" apps/ packages/ --type ts | grep -v "/env\.ts:" || true)"

if [[ -n "${ZOD_OFFENDERS}" ]]; then
  echo "ERROR: zod imports are only allowed in env.ts files (t3-env boundary)." >&2
  echo "${ZOD_OFFENDERS}" >&2
  echo "Use Effect Schema from @cgaravitoq/spec for domain validation." >&2
  exit 1
fi

echo "OK"
