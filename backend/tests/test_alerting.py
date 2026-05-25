"""Pure-function tests for alerting.py — the in-process sliding-window
metrics + threshold evaluator + webhook payload formatter that fires
Slack/Discord/generic alerts when error rate or latency degrade.

The webhook send loop itself (`send_webhook`, `check_and_alert`) is
async + httpx-bound and out of scope here; we cover everything that's
deterministic given (time, status_code, duration_ms) tuples."""
import time
from unittest.mock import patch

import pytest

import alerting
from alerting import (
    _avg_response_ms,
    _error_rate,
    _format_payload,
    _prune,
    build_db_alert,
    evaluate_alerts,
    record_request,
)


@pytest.fixture(autouse=True)
def _reset_alerting_state():
    """Clean slate per test — the request log + last-alert dict are
    module globals so cross-test leakage is real."""
    alerting._request_log.clear()
    alerting._last_alert_ts.clear()
    yield
    alerting._request_log.clear()
    alerting._last_alert_ts.clear()


# ── record_request + _prune ──────────────────────────────────────────────────

def test_record_request_appends_to_log():
    record_request(200, 50.0)
    assert len(alerting._request_log) == 1


def test_record_request_stores_timestamp_status_duration_tuple():
    record_request(404, 123.4)
    ts, status, duration = alerting._request_log[0]
    assert status == 404
    assert duration == 123.4
    assert ts == pytest.approx(time.time(), abs=2)


def test_prune_drops_entries_older_than_window():
    # Inject a stale entry directly with a timestamp 120 s ago.
    alerting._request_log.append((time.time() - 120, 200, 10.0))
    alerting._request_log.append((time.time() - 30, 500, 50.0))
    _prune()
    # Only the recent entry survives.
    assert len(alerting._request_log) == 1
    assert alerting._request_log[0][1] == 500


def test_prune_keeps_entries_inside_window():
    for _ in range(5):
        record_request(200, 10.0)
    _prune()
    assert len(alerting._request_log) == 5


def test_prune_on_empty_log_does_not_raise():
    _prune()  # must not throw.


def test_record_request_triggers_prune():
    # Inject a stale entry, then record a fresh one — the stale must be
    # dropped automatically without an explicit _prune().
    alerting._request_log.append((time.time() - 120, 500, 10.0))
    record_request(200, 5.0)
    # Only the fresh entry remains.
    assert len(alerting._request_log) == 1
    assert alerting._request_log[0][1] == 200


# ── _error_rate ──────────────────────────────────────────────────────────────

def test_error_rate_empty_log_returns_none():
    assert _error_rate() is None


def test_error_rate_all_success_is_zero():
    for _ in range(10):
        record_request(200, 50.0)
    assert _error_rate() == 0.0


def test_error_rate_partial_500_proportional():
    for _ in range(8):
        record_request(200, 10.0)
    for _ in range(2):
        record_request(500, 10.0)
    assert _error_rate() == 0.2


def test_error_rate_4xx_is_not_an_error():
    # 4xx (client errors) don't count as service errors — only 5xx do.
    record_request(404, 10.0)
    record_request(401, 10.0)
    record_request(200, 10.0)
    assert _error_rate() == 0.0


def test_error_rate_includes_5xx_above_500():
    for sc in (500, 502, 503, 504):
        record_request(sc, 10.0)
    assert _error_rate() == 1.0


def test_error_rate_excludes_499_includes_500_boundary():
    record_request(499, 10.0)   # client-side timeout, not 5xx
    record_request(500, 10.0)
    assert _error_rate() == 0.5


# ── _avg_response_ms ────────────────────────────────────────────────────────

def test_avg_response_empty_log_returns_none():
    assert _avg_response_ms() is None


def test_avg_response_single_request():
    record_request(200, 123.0)
    assert _avg_response_ms() == 123.0


def test_avg_response_multiple_requests():
    record_request(200, 100.0)
    record_request(200, 200.0)
    record_request(200, 300.0)
    assert _avg_response_ms() == 200.0


def test_avg_response_includes_errors_in_average():
    record_request(200, 100.0)
    record_request(500, 1000.0)  # slow error also counts.
    assert _avg_response_ms() == 550.0


# ── evaluate_alerts ──────────────────────────────────────────────────────────

def test_evaluate_empty_log_returns_no_alerts():
    assert evaluate_alerts() == []


def test_evaluate_high_error_rate_fires():
    # 100% error → way above default 5% threshold.
    for _ in range(10):
        record_request(500, 10.0)
    alerts = evaluate_alerts()
    types = {a["type"] for a in alerts}
    assert "high_error_rate" in types


def test_evaluate_error_rate_at_threshold_does_not_fire():
    # Threshold is 0.05; > 0.05 fires (strict). Exactly 0.05 (5/100)
    # should NOT fire.
    for _ in range(95):
        record_request(200, 10.0)
    for _ in range(5):
        record_request(500, 10.0)
    alerts = evaluate_alerts()
    types = {a["type"] for a in alerts}
    assert "high_error_rate" not in types


def test_evaluate_slow_response_fires():
    record_request(200, 5000.0)  # 5s > 2s default
    alerts = evaluate_alerts()
    types = {a["type"] for a in alerts}
    assert "slow_response" in types


def test_evaluate_alert_payload_includes_value_and_threshold():
    record_request(200, 5000.0)
    alerts = evaluate_alerts()
    slow = next(a for a in alerts if a["type"] == "slow_response")
    assert "value" in slow
    assert "threshold" in slow
    assert slow["value"] == 5000.0


def test_evaluate_both_alerts_can_fire_together():
    # High latency AND high error rate.
    for _ in range(10):
        record_request(500, 5000.0)
    alerts = evaluate_alerts()
    types = {a["type"] for a in alerts}
    assert "high_error_rate" in types
    assert "slow_response" in types


def test_evaluate_cooldown_suppresses_duplicate_alerts():
    # Set the last-alert timestamp to "just now" so cooldown is active.
    alerting._last_alert_ts["high_error_rate"] = time.time()
    for _ in range(10):
        record_request(500, 10.0)
    alerts = evaluate_alerts()
    assert all(a["type"] != "high_error_rate" for a in alerts)


def test_evaluate_cooldown_expired_allows_realert():
    # Last alert 10 minutes ago → cooldown (default 300s) expired.
    alerting._last_alert_ts["high_error_rate"] = time.time() - 600
    for _ in range(10):
        record_request(500, 10.0)
    alerts = evaluate_alerts()
    assert any(a["type"] == "high_error_rate" for a in alerts)


def test_evaluate_respects_monkeypatched_thresholds(monkeypatch):
    # Tighten the latency threshold; a fast request now exceeds it.
    monkeypatch.setattr(alerting, "ALERT_THRESHOLD_RESPONSE_MS", 1.0)
    record_request(200, 5.0)
    alerts = evaluate_alerts()
    assert any(a["type"] == "slow_response" for a in alerts)


# ── build_db_alert ───────────────────────────────────────────────────────────

def test_build_db_alert_shape():
    out = build_db_alert("mongo", "connection refused")
    assert out["type"] == "db_connection_failure"
    assert out["service"] == "mongo"
    assert "connection refused" in out["message"]


def test_build_db_alert_message_format():
    out = build_db_alert("redis", "timeout")
    assert out["message"] == "redis connection failed: timeout"


# ── _format_payload ─────────────────────────────────────────────────────────

_ALERT = {"type": "high_error_rate", "message": "Error rate 12.3%"}


def test_format_payload_slack_shape(monkeypatch):
    monkeypatch.setattr(alerting, "ALERT_WEBHOOK_URL", "https://hooks.slack.com/services/X/Y")
    out = _format_payload(_ALERT)
    assert set(out.keys()) == {"text"}
    assert "HIGH_ERROR_RATE" in out["text"]
    assert "Error rate 12.3%" in out["text"]


def test_format_payload_slack_keyword_match(monkeypatch):
    # Any URL containing "slack" should route to Slack shape, even on a
    # proxied / custom host (e.g. on-prem Mattermost-Slack mode).
    monkeypatch.setattr(alerting, "ALERT_WEBHOOK_URL", "https://my-slack-proxy.example/hook")
    assert "text" in _format_payload(_ALERT)


def test_format_payload_discord_shape(monkeypatch):
    monkeypatch.setattr(alerting, "ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/abc/xyz")
    out = _format_payload(_ALERT)
    assert set(out.keys()) == {"content"}
    assert "HIGH_ERROR_RATE" in out["content"]


def test_format_payload_generic_shape(monkeypatch):
    monkeypatch.setattr(alerting, "ALERT_WEBHOOK_URL", "https://my-monitoring.example/alerts")
    out = _format_payload(_ALERT)
    assert set(out.keys()) == {"alert", "timestamp", "service"}
    assert out["alert"] == _ALERT
    assert out["service"] == "patrimonio-backend"


def test_format_payload_text_includes_iso_timestamp(monkeypatch):
    monkeypatch.setattr(alerting, "ALERT_WEBHOOK_URL", "https://hooks.slack.com/x")
    out = _format_payload(_ALERT)
    # ISO 8601 includes 'T' and ends with timezone info — 'at YYYY-MM-DDT…'
    assert "T" in out["text"]
