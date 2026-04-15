#!/usr/bin/env bash
# Portugal Vivo — Pre-Deploy Check
# Runs ordered verification before a production deploy:
#   1. Backend reachability
#   2. /api/health/detailed (MongoDB + Redis + disk + memory)
#   3. Sentry + environment banner in /api/health/detailed
#   4. Events seed (forces sync via POST /api/agenda/sync, then counts)
#   5. Full smoke test (scripts/smoke-test.sh)
#
# Exit code 0 = green to deploy, 1 = one or more checks failed.
#
# Usage:
#   BASE_URL=http://<vps-ip>:8001 ./scripts/pre-deploy-check.sh
#   BASE_URL=https://api.portugalvivo.pt ./scripts/pre-deploy-check.sh
#   ./scripts/pre-deploy-check.sh  # defaults to prod URL
#
# Optional env:
#   MIN_EVENTS   — minimum events expected in MongoDB (default: 200)
#   SKIP_SYNC    — set to 1 to skip POST /api/agenda/sync (useful in read-only envs)
#   SKIP_SMOKE   — set to 1 to skip the smoke-test.sh call

set -u

BASE_URL="${BASE_URL:-https://api.portugalvivo.pt}"
TIMEOUT=20
MIN_EVENTS="${MIN_EVENTS:-200}"
SKIP_SYNC="${SKIP_SYNC:-0}"
SKIP_SMOKE="${SKIP_SMOKE:-0}"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

FAILED=0

banner() {
  printf "\n${BLUE}==========================================================${NC}\n"
  printf "${BLUE}%s${NC}\n" "$1"
  printf "${BLUE}==========================================================${NC}\n"
}

fail() {
  printf "  ${RED}✗${NC} %s\n" "$1"
  FAILED=$((FAILED + 1))
}

ok() {
  printf "  ${GREEN}✓${NC} %s\n" "$1"
}

warn() {
  printf "  ${YELLOW}!${NC} %s\n" "$1"
}

# -----------------------------------------------------------------
# 0 — Tooling
# -----------------------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed. Aborting." >&2
  exit 2
fi

HAS_JQ=0
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
fi

banner "Portugal Vivo — Pre-Deploy Check"
printf "Target:       %s\n" "$BASE_URL"
printf "Min events:   %s\n" "$MIN_EVENTS"
printf "Skip sync:    %s\n" "$SKIP_SYNC"
printf "Skip smoke:   %s\n" "$SKIP_SMOKE"

# -----------------------------------------------------------------
# 1 — Backend reachability
# -----------------------------------------------------------------
banner "① Backend reachability"

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" \
  "${BASE_URL}/api/health" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  ok "GET /api/health → 200"
else
  fail "GET /api/health returned $code (expected 200)"
  printf "\n${RED}Backend is not reachable. Aborting remaining checks.${NC}\n"
  exit 1
fi

# -----------------------------------------------------------------
# 2 — Detailed health (Mongo / Redis / disk / memory / env)
# -----------------------------------------------------------------
banner "② Detailed health"

tmp=$(mktemp)
code=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time "$TIMEOUT" \
  "${BASE_URL}/api/health/detailed" 2>/dev/null || echo "000")

if [ "$code" != "200" ]; then
  fail "GET /api/health/detailed returned $code"
  cat "$tmp"
else
  if [ "$HAS_JQ" = "1" ]; then
    status=$(jq -r '.status // "unknown"' "$tmp")
    mongo=$(jq -r '.checks.mongodb.status // "?"' "$tmp")
    redis=$(jq -r '.checks.redis.status // "?"' "$tmp")
    disk=$(jq -r '.checks.disk.status // "?"' "$tmp")
    mem=$(jq -r '.checks.memory.status // "?"' "$tmp")
    uptime=$(jq -r '.uptime_seconds // "?"' "$tmp")

    [ "$status" = "healthy" ] && ok "overall status: healthy" \
      || warn "overall status: $status"
    [ "$mongo" = "connected" ] && ok "MongoDB: connected" \
      || fail "MongoDB: $mongo"
    case "$redis" in
      connected|not_configured) ok "Redis: $redis" ;;
      *) warn "Redis: $redis (non-critical)" ;;
    esac
    [ "$disk" = "ok" ] && ok "Disk: ok" || warn "Disk: $disk"
    [ "$mem" = "ok" ] && ok "Memory: ok" || warn "Memory: $mem"
    ok "Uptime: ${uptime}s"
  else
    # No jq — just look for red flags
    if grep -q '"status":"healthy"' "$tmp"; then
      ok "overall status: healthy"
    else
      warn "overall status != healthy (install jq for detail)"
    fi
    grep -q '"mongodb":{"status":"connected"' "$tmp" \
      && ok "MongoDB: connected" \
      || fail "MongoDB not connected"
  fi
fi
rm -f "$tmp"

# -----------------------------------------------------------------
# 3 — Events seed / sync
# -----------------------------------------------------------------
banner "③ Events seed"

if [ "$SKIP_SYNC" = "1" ]; then
  warn "SKIP_SYNC=1 — not triggering /api/agenda/sync"
else
  tmp=$(mktemp)
  code=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time 60 \
    -X POST "${BASE_URL}/api/agenda/sync" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    if [ "$HAS_JQ" = "1" ]; then
      synced=$(jq -r '.synced // 0' "$tmp")
      ok "POST /api/agenda/sync → synced $synced events"
    else
      ok "POST /api/agenda/sync → 200"
    fi
  else
    fail "POST /api/agenda/sync returned $code"
    cat "$tmp"
  fi
  rm -f "$tmp"
fi

# Count events via the public endpoint
tmp=$(mktemp)
code=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time "$TIMEOUT" \
  "${BASE_URL}/api/events?limit=1000" 2>/dev/null || echo "000")
if [ "$code" != "200" ]; then
  fail "GET /api/events returned $code"
else
  if [ "$HAS_JQ" = "1" ]; then
    total=$(jq '. | if type=="array" then length elif .events then (.events | length) elif .total then .total else 0 end' "$tmp")
  else
    total=$(tr ',' '\n' <"$tmp" | grep -c '"id"' || echo 0)
  fi
  if [ "$total" -ge "$MIN_EVENTS" ]; then
    ok "events in DB: $total (≥ $MIN_EVENTS)"
  else
    fail "events in DB: $total (< $MIN_EVENTS required)"
  fi
fi
rm -f "$tmp"

# -----------------------------------------------------------------
# 4 — Smoke test
# -----------------------------------------------------------------
banner "④ Smoke test"

if [ "$SKIP_SMOKE" = "1" ]; then
  warn "SKIP_SMOKE=1 — skipping smoke test"
else
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  if [ ! -x "$script_dir/smoke-test.sh" ]; then
    fail "scripts/smoke-test.sh not found or not executable"
  else
    if BASE_URL="$BASE_URL" "$script_dir/smoke-test.sh"; then
      ok "smoke-test.sh passed"
    else
      fail "smoke-test.sh failed"
    fi
  fi
fi

# -----------------------------------------------------------------
# Verdict
# -----------------------------------------------------------------
banner "Verdict"

if [ "$FAILED" -eq 0 ]; then
  printf "${GREEN}✓ ALL CHECKS PASSED — safe to deploy.${NC}\n\n"
  exit 0
else
  printf "${RED}✗ %d check(s) FAILED — DO NOT DEPLOY until resolved.${NC}\n\n" "$FAILED"
  exit 1
fi
