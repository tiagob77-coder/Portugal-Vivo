#!/usr/bin/env bash
# Portugal Vivo — Smoke Test
# Validates critical production endpoints after deploy.
# Exit code 0 = all green, 1 = any failure.
#
# Usage:
#   ./scripts/smoke-test.sh                           # defaults to prod URL
#   BASE_URL=https://staging.portugalvivo.pt ./scripts/smoke-test.sh
#   BASE_URL=http://localhost:8001 ./scripts/smoke-test.sh

set -u

BASE_URL="${BASE_URL:-https://api.portugalvivo.pt}"
TIMEOUT=15
FAILED=0
TOTAL=0

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
NC=$'\033[0m'

# check <name> <path> <expected_status> [min_size_bytes]
check() {
  local name="$1"
  local path="$2"
  local expected="$3"
  local min_size="${4:-0}"

  TOTAL=$((TOTAL + 1))
  local url="${BASE_URL}${path}"
  local tmp; tmp=$(mktemp)
  local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
  local size; size=$(wc -c <"$tmp" | tr -d ' ')
  rm -f "$tmp"

  if [ "$code" = "$expected" ] && [ "$size" -ge "$min_size" ]; then
    printf "  ${GREEN}✓${NC} %-40s %s (%s bytes)\n" "$name" "$code" "$size"
  else
    printf "  ${RED}✗${NC} %-40s %s (expected %s, size %s, min %s)\n" \
      "$name" "$code" "$expected" "$size" "$min_size"
    FAILED=$((FAILED + 1))
  fi
}

echo "============================================================"
echo "Portugal Vivo — Smoke Test"
echo "Target: ${BASE_URL}"
echo "============================================================"

echo
echo "▸ Health"
check "GET  /api/health"               "/api/health"                                 200 5
check "GET  /api/health/detailed"      "/api/health/detailed"                        200 100

echo
echo "▸ Core read endpoints"
check "GET  /api/categories"           "/api/categories"                             200 50
check "GET  /api/stats"                "/api/stats"                                  200 20
check "GET  /api/heritage-items"       "/api/heritage-items?limit=5"                 200 100
check "GET  /api/events"               "/api/events?limit=5"                         200 20

echo
echo "▸ CAOP geo layers"
check "GET  /api/caop/distritos"       "/api/caop/distritos"                         200 500
check "GET  /api/caop/concelhos"       "/api/caop/concelhos?distrito=Porto"          200 100

echo
echo "▸ Map tiles + layers"
check "GET  /api/map-layers/styles"    "/api/map-layers/styles"                      200 100
check "GET  /api/map/items"            "/api/map/items?limit=10"                     200 100

echo
echo "▸ Auth guards (401 expected without token)"
check "GET  /api/auth/me (no token)"   "/api/auth/me"                                401 0
check "GET  /api/favorites (no token)" "/api/favorites"                              401 0

echo
echo "============================================================"
if [ "$FAILED" -eq 0 ]; then
  printf "${GREEN}All %d checks passed.${NC}\n" "$TOTAL"
  exit 0
else
  printf "${RED}%d/%d checks FAILED.${NC}\n" "$FAILED" "$TOTAL"
  exit 1
fi
