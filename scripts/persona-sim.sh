#!/usr/bin/env bash
# Persona sim launcher — loads env from local.settings.json, then runs the sim.
# Usage: ./scripts/persona-sim.sh [--count N] [-- <extra tsx args>]
#   --count N   number of random personas to generate (default: 3)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETTINGS="$REPO_ROOT/packages/web/api/local.settings.json"

if [[ ! -f "$SETTINGS" ]]; then
  echo "❌  $SETTINGS not found. Copy local.settings.json.example and fill in your values." >&2
  exit 1
fi

# Load Values from local.settings.json into the environment
eval "$(node -e "
const s = require('$SETTINGS');
Object.entries(s.Values || {}).forEach(([k, v]) => {
  const safe = String(v).replace(/'/g, \"'\\\\''\");
  console.log(\`export \${k}='\${safe}'\`);
});
")"

export KICKSTART_USE_RESPONSES=true

# Inject GitHub token so inspect_repo and GitHub-related tools can authenticate.
# Prefer an already-set GITHUB_TOKEN; fall back to `gh auth token` if gh CLI is available.
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  if command -v gh &>/dev/null; then
    GH_TOKEN_VAL="$(gh auth token 2>/dev/null || true)"
    if [[ -n "$GH_TOKEN_VAL" ]]; then
      export GITHUB_TOKEN="$GH_TOKEN_VAL"
      echo "🔑  GitHub token injected from gh CLI"
    else
      echo "⚠️   gh CLI found but not authenticated — run 'gh auth login' for repo inspection" >&2
    fi
  else
    echo "⚠️   GITHUB_TOKEN not set and gh CLI not found — repo inspection may fail" >&2
  fi
else
  echo "🔑  GITHUB_TOKEN already set"
fi

echo "✅  Env loaded from local.settings.json"
echo "🚀  Launching persona sim…"
echo

exec npx tsx --tsconfig "$REPO_ROOT/tsconfig.scripts.json" "$REPO_ROOT/scripts/persona-sim.ts" "$@"
