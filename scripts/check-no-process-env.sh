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

echo "OK"
