"""
Unit tests for ``backend/llm_client.py``.

We don't want to hit a real LLM during tests, so we monkeypatch
``_provider`` and ``httpx.AsyncClient`` to control both the resolved
backend and the wire response.
"""
import json
import os
import sys

import pytest


# Make sure backend/ is on sys.path so ``import llm_client`` works when
# pytest is invoked from the repo root or from backend/.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import llm_client  # noqa: E402


# ── Provider resolution ──────────────────────────────────────────────────

def test_resolve_prefers_openai_when_both_keys_set(monkeypatch):
    """Auto mode must prefer OpenAI when both keys are configured."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-openai")
    monkeypatch.setenv("EMERGENT_LLM_KEY", "emk-test-emergent")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    p = llm_client._resolve_provider()
    assert p["provider"] == "openai"
    assert p["url"] == llm_client._OPENAI_URL
    assert p["api_key"] == "sk-test-openai"


def test_resolve_falls_back_to_emergent_when_only_emergent_set(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("EMERGENT_LLM_KEY", "emk-only")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    p = llm_client._resolve_provider()
    assert p["provider"] == "emergent"
    assert p["url"] == llm_client._EMERGENT_URL
    assert p["api_key"] == "emk-only"


def test_resolve_returns_none_when_no_keys(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    p = llm_client._resolve_provider()
    assert p["provider"] is None
    assert p["url"] is None
    assert p["api_key"] is None


def test_resolve_forced_openai_without_key_returns_none(monkeypatch):
    """LLM_PROVIDER=openai but no OPENAI_API_KEY → not configured (no silent fallback to emergent)."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("EMERGENT_LLM_KEY", "emk")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    p = llm_client._resolve_provider()
    assert p["provider"] is None


def test_resolve_forced_emergent_overrides_openai(monkeypatch):
    """LLM_PROVIDER=emergent must use emergent even when OPENAI_API_KEY is set."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai")
    monkeypatch.setenv("EMERGENT_LLM_KEY", "emk")
    monkeypatch.setenv("LLM_PROVIDER", "emergent")
    p = llm_client._resolve_provider()
    assert p["provider"] == "emergent"


# ── Call surface ─────────────────────────────────────────────────────────

class _FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body or {
            "choices": [{"message": {"content": '{"hello":"world"}'}}]
        }

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class _FakeAsyncClient:
    """Records the last POST so tests can assert on URL + headers + payload."""

    last_call: dict = {}

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers=None, json=None):
        _FakeAsyncClient.last_call = {"url": url, "headers": headers, "json": json}
        return _FakeResponse()


@pytest.mark.anyio
async def test_call_returns_none_when_unconfigured(monkeypatch):
    monkeypatch.setattr(llm_client, "_provider", {"provider": None, "url": None, "api_key": None})
    out = await llm_client.call_chat_completion("hello")
    assert out is None


@pytest.mark.anyio
async def test_call_uses_openai_url_and_key_when_configured(monkeypatch):
    monkeypatch.setattr(
        llm_client,
        "_provider",
        {"provider": "openai", "url": llm_client._OPENAI_URL, "api_key": "sk-x"},
    )
    monkeypatch.setattr(llm_client.httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.last_call = {}

    out = await llm_client.call_chat_completion(
        "ola",
        temperature=0.5,
        response_format={"type": "json_object"},
        max_tokens=42,
    )

    assert out == '{"hello":"world"}'
    call = _FakeAsyncClient.last_call
    assert call["url"] == llm_client._OPENAI_URL
    assert call["headers"]["Authorization"] == "Bearer sk-x"
    assert call["json"]["model"] == "gpt-4o-mini"
    assert call["json"]["messages"] == [{"role": "user", "content": "ola"}]
    assert call["json"]["temperature"] == 0.5
    assert call["json"]["response_format"] == {"type": "json_object"}
    assert call["json"]["max_tokens"] == 42


@pytest.mark.anyio
async def test_call_accepts_explicit_messages(monkeypatch):
    """messages= overrides prompt= and supports system+user shape."""
    monkeypatch.setattr(
        llm_client,
        "_provider",
        {"provider": "openai", "url": llm_client._OPENAI_URL, "api_key": "sk-x"},
    )
    monkeypatch.setattr(llm_client.httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.last_call = {}

    msgs = [
        {"role": "system", "content": "you are helpful"},
        {"role": "user", "content": "hi"},
    ]
    await llm_client.call_chat_completion(messages=msgs)

    assert _FakeAsyncClient.last_call["json"]["messages"] == msgs


@pytest.mark.anyio
async def test_call_swallows_exceptions(monkeypatch):
    """Network / parse failures must return None, never raise."""

    class _Boom:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **kw):
            raise RuntimeError("connection reset")

    monkeypatch.setattr(
        llm_client,
        "_provider",
        {"provider": "openai", "url": llm_client._OPENAI_URL, "api_key": "sk-x"},
    )
    monkeypatch.setattr(llm_client.httpx, "AsyncClient", _Boom)

    out = await llm_client.call_chat_completion("anything")
    assert out is None


@pytest.mark.anyio
async def test_call_requires_prompt_or_messages(monkeypatch):
    """No prompt and no messages is a programmer error → ValueError."""
    monkeypatch.setattr(
        llm_client,
        "_provider",
        {"provider": "openai", "url": llm_client._OPENAI_URL, "api_key": "sk-x"},
    )
    with pytest.raises(ValueError):
        await llm_client.call_chat_completion()
