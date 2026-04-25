"""
Smoke tests for Fase 3 Track A — observability endpoints.

Covers:
  - /api/metrics (Prometheus alias)
  - /api/health/metrics (legacy Prometheus path)
  - /api/health/deep (MongoDB + Redis + LLM probe)
  - X-Request-ID echo + generation
  - request_id propagates into logs via ContextVar
"""
import logging

import pytest

from conftest import requires_db


@pytest.mark.anyio
@requires_db
async def test_metrics_alias_serves_prometheus(client):
    """/api/metrics must return Prometheus exposition (or 503 if client missing)."""
    resp = await client.get("/api/metrics")
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        body = resp.text
        # Should contain at least one of our registered metrics.
        assert ("http_requests_total" in body) or ("# HELP" in body), (
            f"unexpected /api/metrics body: {body[:300]}"
        )


@pytest.mark.anyio
@requires_db
async def test_metrics_legacy_path_still_works(client):
    """Legacy /api/health/metrics must keep serving Prometheus for existing scrapers."""
    resp = await client.get("/api/health/metrics")
    assert resp.status_code in (200, 503)


@pytest.mark.anyio
@requires_db
async def test_deep_health_includes_llm_probe(client):
    """Deep health reports mongo + redis + llm checks (any may be 'not_configured')."""
    resp = await client.get("/api/health/deep")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body
    assert "checks" in body
    assert set(body["checks"].keys()) >= {"mongodb", "redis", "llm"}


@pytest.mark.anyio
@requires_db
async def test_metrics_exposes_rate_limit_and_llm_call_counters(client):
    """The two Fase 4 counters (rate_limit_triggered_total, llm_calls_total) must
    be registered on import, so they appear in /api/metrics even before any
    increments — Prometheus client emits the HELP/TYPE lines for declared
    counters even at zero."""
    resp = await client.get("/api/metrics")
    if resp.status_code != 200:
        pytest.skip("Prometheus client not installed in this environment")
    body = resp.text
    assert "rate_limit_triggered_total" in body, (
        "rate_limit_triggered_total counter not exposed in /api/metrics"
    )
    assert "llm_calls_total" in body, (
        "llm_calls_total counter not exposed in /api/metrics"
    )


@pytest.mark.anyio
@requires_db
async def test_request_id_echoed_when_supplied(client):
    """Inbound X-Request-ID is echoed back in the response."""
    resp = await client.get("/api/health", headers={"X-Request-ID": "test-rid-123"})
    assert resp.headers.get("X-Request-ID") == "test-rid-123"


@pytest.mark.anyio
@requires_db
async def test_request_id_generated_when_missing(client):
    """If no X-Request-ID is supplied, one is generated and exposed."""
    resp = await client.get("/api/health")
    rid = resp.headers.get("X-Request-ID")
    assert rid and len(rid) >= 8


@pytest.mark.anyio
@requires_db
async def test_request_id_propagates_to_logs(client, caplog):
    """A log emitted during a request carries the request_id via ContextVar."""
    from structured_logging import RequestIdFilter

    # caplog doesn't automatically apply filters — attach ours.
    caplog.handler.addFilter(RequestIdFilter())
    caplog.set_level(logging.INFO, logger="server")

    resp = await client.get("/api/health", headers={"X-Request-ID": "log-rid-xyz"})
    assert resp.status_code == 200

    matched = [r for r in caplog.records if getattr(r, "request_id", None) == "log-rid-xyz"]
    assert matched, "no log record carried the request_id via ContextVar"
