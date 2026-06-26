#!/usr/bin/env bash
set -euo pipefail

# .env.example is a PUBLIC template (this repo is public). It must hold only
# placeholders — never a real deployment URL or secret value. This guards the
# exact class of mistake where a live endpoint (e.g. a *.workers.dev upload
# gateway) gets pinned into the template and leaks through git history.

file=".env.example"
[[ -f "${file}" ]] || { echo "OK (no ${file})"; exit 0; }

offenders="$(
  awk '
    /^[[:space:]]*#/ { next }                 # comment line
    !/^[A-Za-z_][A-Za-z0-9_]*=/ { next }      # not a KEY=VALUE line
    {
      eq  = index($0, "=")
      key = substr($0, 1, eq - 1)
      val = substr($0, eq + 1)
      is_url   = (val ~ /https?:\/\//)
      is_local = (val ~ /:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(com|org|net))/)
      if ((is_url && !is_local) || val ~ /workers\.dev/ || val ~ /r2\.cloudflarestorage\.com/) {
        printf "  %d: %s=%s\n", NR, key, val
        bad = 1
      }
    }
    END { exit bad ? 1 : 0 }
  ' "${file}"
)" || {
  echo "ERROR: ${file} contains a real endpoint URL — it is a PUBLIC template." >&2
  echo "${offenders}" >&2
  echo "Replace the value with an empty placeholder; keep real URLs/secrets in your local .env only." >&2
  exit 1
}

echo "OK"
