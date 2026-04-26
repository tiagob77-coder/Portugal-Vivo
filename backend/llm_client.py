"""
llm_client.py — Central, provider-agnostic LLM call helper.

Why
---
The codebase had 6+ endpoints making direct ``httpx.post`` calls to a
hard-coded Emergent proxy URL with the ``EMERGENT_LLM_KEY`` env var.
Switching the provider, retrying, or even just changing the model meant
editing every file. This module centralises the call so callers say
"give me a JSON response from gpt-4o-mini for this prompt" and don't
care who actually fulfils it.

Provider selection
------------------
At import time we resolve a single ``_provider`` based on env vars,
preferring direct OpenAI when its key is present:

  1. ``OPENAI_API_KEY`` set → OpenAI direct (https://api.openai.com)
  2. ``EMERGENT_LLM_KEY`` set → Emergent proxy (legacy, backwards compat)
  3. Neither → ``call_chat_completion`` returns None and the caller
     should fall back to its static response.

The choice can be overridden explicitly with ``LLM_PROVIDER=openai`` or
``LLM_PROVIDER=emergent``.

What is NOT here
----------------
- Caching: that lives in ``llm_cache.py``. Callers wrap this helper with
  ``cache_get / cache_set`` themselves so we don't accidentally cache
  user-personalised output.
- Metrics: ``record_llm_call`` lives in ``llm_cache.py`` so callers
  emit success/fallback labels at the call site (this module doesn't
  know what "namespace" the call belongs to).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("llm_client")


# ── Provider resolution (one-time, at import) ─────────────────────────────

_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_EMERGENT_URL = "https://llm.lil.re.emergentmethods.ai/v1/chat/completions"


def _resolve_provider() -> Dict[str, Optional[str]]:
    """Pick the active LLM provider based on env vars.

    Returns a dict with ``url``, ``api_key``, and ``provider`` (string
    label for logs / counters). If no key is configured, returns
    ``{provider: None, ...}`` and call_chat_completion will short-circuit.
    """
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    emergent_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    forced = os.environ.get("LLM_PROVIDER", "").strip().lower()

    if forced == "openai":
        if not openai_key:
            logger.warning("LLM_PROVIDER=openai but OPENAI_API_KEY missing")
            return {"provider": None, "url": None, "api_key": None}
        return {"provider": "openai", "url": _OPENAI_URL, "api_key": openai_key}

    if forced == "emergent":
        if not emergent_key:
            logger.warning("LLM_PROVIDER=emergent but EMERGENT_LLM_KEY missing")
            return {"provider": None, "url": None, "api_key": None}
        return {"provider": "emergent", "url": _EMERGENT_URL, "api_key": emergent_key}

    # Auto: prefer OpenAI direct, fall back to Emergent for legacy envs.
    if openai_key:
        return {"provider": "openai", "url": _OPENAI_URL, "api_key": openai_key}
    if emergent_key:
        return {"provider": "emergent", "url": _EMERGENT_URL, "api_key": emergent_key}
    return {"provider": None, "url": None, "api_key": None}


_provider = _resolve_provider()
if _provider["provider"]:
    logger.info("LLM client using provider=%s", _provider["provider"])
else:
    logger.info("LLM client: no API key configured; calls will short-circuit to fallback")


def is_configured() -> bool:
    """Quick boolean check callers can use to skip prompt building entirely."""
    return _provider["provider"] is not None


def active_provider() -> Optional[str]:
    """Return the active provider label ('openai' / 'emergent' / None)."""
    return _provider["provider"]


# ── Public call API ───────────────────────────────────────────────────────

async def call_chat_completion(
    prompt: Optional[str] = None,
    *,
    messages: Optional[list] = None,
    model: str = "gpt-4o-mini",
    temperature: float = 0.4,
    response_format: Optional[Dict[str, Any]] = None,
    timeout: float = 15.0,
    max_tokens: Optional[int] = None,
) -> Optional[str]:
    """Make a chat-completion call and return the assistant's content.

    Pass either ``prompt`` (single user message) or ``messages`` (full
    list, e.g. ``[{"role": "system", ...}, {"role": "user", ...}]``).
    Returns ``None`` if no provider is configured or the call raises.
    The caller is responsible for parsing the content (usually
    ``json.loads(...)`` when ``response_format={"type": "json_object"}``)
    and for emitting success / fallback metrics.

    Keeping the signature minimal on purpose — the call sites that need
    fancier features (function calling, streaming) can call ``httpx``
    directly until the helper grows organically.
    """
    if not is_configured():
        return None
    if messages is None:
        if prompt is None:
            raise ValueError("call_chat_completion requires either prompt or messages")
        messages = [{"role": "user", "content": prompt}]

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format is not None:
        payload["response_format"] = response_format
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    headers = {
        "Authorization": f"Bearer {_provider['api_key']}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(_provider["url"], headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return content
    except Exception as exc:
        # Log at WARNING — the caller will record_llm_call("...", "fallback")
        # and serve a static response, so this is operational noise, not a
        # user-visible error.
        logger.warning("LLM call failed (provider=%s): %s", _provider["provider"], exc)
        return None
