#!/usr/bin/env bash
# eas_prebuild_check.sh — verify EAS build prerequisites locally.
#
# Run before triggering an EAS build (especially production) so we catch
# missing tokens / misconfigured envs in 5 seconds instead of 5 minutes
# into a queued build.
#
# Usage:
#   ./scripts/eas_prebuild_check.sh [profile]
#
# Default profile is "production".

set -euo pipefail

PROFILE="${1:-production}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "EAS pre-build check — profile=$PROFILE"
echo "----------------------------------------"

fail=0
warn() { echo "  ! $1"; fail=1; }
ok()   { echo "  ✓ $1"; }

# --- Tooling ---------------------------------------------------------------
if ! command -v eas >/dev/null 2>&1; then
  warn "eas CLI not found — install with: npm install -g eas-cli"
else
  ok "eas CLI present ($(eas --version 2>&1 | head -1))"
fi

if ! command -v node >/dev/null 2>&1; then
  warn "node not found"
else
  ok "node $(node --version)"
fi

# --- eas.json --------------------------------------------------------------
if [ ! -f "$FRONTEND_DIR/eas.json" ]; then
  warn "$FRONTEND_DIR/eas.json missing"
else
  if ! node -e "JSON.parse(require('fs').readFileSync('$FRONTEND_DIR/eas.json','utf8'))" 2>/dev/null; then
    warn "eas.json is not valid JSON"
  else
    if node -e "const c=require('$FRONTEND_DIR/eas.json'); process.exit(c.build && c.build['$PROFILE'] ? 0 : 1)"; then
      ok "profile '$PROFILE' found in eas.json"
    else
      warn "profile '$PROFILE' NOT found in eas.json"
    fi
  fi
fi

# --- app.json --------------------------------------------------------------
if [ -f "$FRONTEND_DIR/app.json" ]; then
  slug=$(node -e "console.log(require('$FRONTEND_DIR/app.json').expo.slug || '')")
  if [ -z "$slug" ]; then
    warn "app.json: expo.slug is empty (run: cd frontend && eas init)"
  else
    ok "app.json slug = '$slug'"
  fi
fi

# --- Env vars (production only) -------------------------------------------
if [ "$PROFILE" = "production" ]; then
  expected_envs=("EXPO_PUBLIC_BACKEND_URL")
  for var in "${expected_envs[@]}"; do
    if node -e "
      const c = require('$FRONTEND_DIR/eas.json');
      const env = (c.build && c.build['$PROFILE'] && c.build['$PROFILE'].env) || {};
      process.exit(env['$var'] ? 0 : 1);
    "; then
      ok "$var configured in eas.json::build.$PROFILE.env"
    else
      warn "$var missing from eas.json::build.$PROFILE.env"
    fi
  done
fi

# --- EXPO_TOKEN (only if running outside a logged-in eas session) ---------
if [ -z "${EXPO_TOKEN:-}" ] && ! eas whoami >/dev/null 2>&1; then
  warn "Not logged into EAS (no EXPO_TOKEN env and 'eas whoami' fails). Run: eas login"
elif [ -n "${EXPO_TOKEN:-}" ]; then
  ok "EXPO_TOKEN env var present (CI mode)"
else
  ok "Logged into EAS as $(eas whoami 2>/dev/null)"
fi

echo "----------------------------------------"
if [ "$fail" -eq 0 ]; then
  echo "All checks passed. Ready to run:"
  echo "  cd frontend && eas build --profile $PROFILE --platform all"
else
  echo "Some checks failed. Fix the items above before launching the build."
  exit 1
fi
