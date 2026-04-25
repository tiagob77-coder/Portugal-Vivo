"""
verify_observability.py — Post-deploy smoke test for the Portugal Vivo
observability stack.

Checks that the live backend is exposing every counter and probe the
Grafana dashboard expects, so we catch regressions before they show up
as missing panels in production.

Run after a deploy:

    python scripts/verify_observability.py --base-url https://api.portugalvivo.pt

Exit code 0 ⇢ everything healthy.
Exit code 1 ⇢ at least one expected metric or probe is missing.
"""
from __future__ import annotations

import argparse
import sys
from typing import List, Tuple

import httpx


# Counters and histograms that must appear in /api/metrics. We don't
# assert they're non-zero — a fresh process legitimately starts at zero.
EXPECTED_METRICS = [
    "http_requests_total",
    "http_request_duration_seconds",
    "http_5xx_errors_total",
    "http_status_alerts_total",
    "llm_cache_hits_total",
    "llm_cache_misses_total",
    "llm_cache_errors_total",
    "rate_limit_triggered_total",  # new in PR #116
    "llm_calls_total",              # new in PR #116
]

# Probes that /api/health/deep must report (status may be 'reachable',
# 'ok', 'unreachable', or 'not_configured' — we just want all keys present).
EXPECTED_PROBES = ["mongodb", "redis", "llm"]


def _check_metrics(base_url: str, timeout: float) -> Tuple[bool, List[str]]:
    """Hit /api/metrics and return (all_ok, list_of_missing_metrics)."""
    url = base_url.rstrip("/") + "/api/metrics"
    try:
        resp = httpx.get(url, timeout=timeout)
    except httpx.RequestError as exc:
        return False, [f"<request failed: {exc}>"]
    if resp.status_code == 503:
        return False, ["<prometheus_client not installed on backend>"]
    if resp.status_code != 200:
        return False, [f"<HTTP {resp.status_code}: {resp.text[:200]}>"]
    body = resp.text
    missing = [m for m in EXPECTED_METRICS if m not in body]
    return (len(missing) == 0), missing


def _check_health_deep(base_url: str, timeout: float) -> Tuple[bool, List[str]]:
    """Hit /api/health/deep and return (all_ok, list_of_missing_or_failing_probes)."""
    url = base_url.rstrip("/") + "/api/health/deep"
    try:
        resp = httpx.get(url, timeout=timeout)
    except httpx.RequestError as exc:
        return False, [f"<request failed: {exc}>"]
    if resp.status_code != 200:
        return False, [f"<HTTP {resp.status_code}: {resp.text[:200]}>"]
    payload = resp.json()
    checks = payload.get("checks", {})
    issues: List[str] = []
    for probe in EXPECTED_PROBES:
        if probe not in checks:
            issues.append(f"{probe}: missing from response")
            continue
        status = checks[probe].get("status", "unknown")
        # "not_configured" is acceptable (e.g. LLM key absent in staging).
        # We only flag truly broken probes.
        if status not in {"ok", "reachable", "not_configured"}:
            issues.append(f"{probe}: status={status}")
    return (len(issues) == 0), issues


def _check_request_id_echo(base_url: str, timeout: float) -> Tuple[bool, List[str]]:
    """The X-Request-ID header must be echoed (or generated) on every response."""
    url = base_url.rstrip("/") + "/api/health"
    try:
        resp = httpx.get(url, timeout=timeout)
    except httpx.RequestError as exc:
        return False, [f"<request failed: {exc}>"]
    rid = resp.headers.get("x-request-id") or resp.headers.get("X-Request-ID")
    if not rid:
        return False, ["X-Request-ID header missing from response"]
    return True, []


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Portugal Vivo observability surface.")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8001",
        help="Backend base URL (default: http://localhost:8001)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="HTTP timeout in seconds (default: 10)",
    )
    args = parser.parse_args()

    print(f"\nVerifying observability against {args.base_url}\n")

    rows: List[Tuple[str, bool, List[str]]] = []

    ok, issues = _check_metrics(args.base_url, args.timeout)
    rows.append(("/api/metrics", ok, issues))

    ok, issues = _check_health_deep(args.base_url, args.timeout)
    rows.append(("/api/health/deep probes", ok, issues))

    ok, issues = _check_request_id_echo(args.base_url, args.timeout)
    rows.append(("X-Request-ID header", ok, issues))

    width = max(len(r[0]) for r in rows) + 2
    print(f"{'CHECK'.ljust(width)}  RESULT")
    print(f"{'-' * width}  ------")
    any_failed = False
    for name, ok, issues in rows:
        marker = "PASS" if ok else "FAIL"
        print(f"{name.ljust(width)}  {marker}")
        if not ok:
            any_failed = True
            for issue in issues:
                print(f"  · {issue}")

    print()
    if any_failed:
        print("One or more checks failed. Investigate before promoting this build.")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
