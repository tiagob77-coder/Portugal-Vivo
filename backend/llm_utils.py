"""
llm_utils.py — Shared LLM helpers for all backend modules.

Usage:
    from llm_utils import llm_chat

    result = await llm_chat(messages, max_tokens=800)
    if result is None:
        # use fallback
"""
import asyncio
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

LLM_URL = "https://llm.lil.re.emergentmethods.ai/v1/chat/completions"
LLM_MODEL = "gpt-4o-mini"

# Retry config: 3 attempts, 2 s / 4 s backoff (429 / 5xx only)
_MAX_RETRIES = 3
_RETRY_STATUSES = {429, 500, 502, 503, 504}
_BASE_DELAY = 2.0


def _get_key() -> str:
    return os.environ.get("EMERGENT_LLM_KEY", "")


async def llm_chat(
    messages: list,
    *,
    max_tokens: int = 800,
    temperature: float = 0.7,
    timeout: float = 25.0,
) -> Optional[str]:
    """POST to Emergent LLM with exponential-backoff retry.

    Returns the assistant text on success, None when:
      - EMERGENT_LLM_KEY is unset
      - all retries exhausted (caller must use a structured fallback)
    """
    key = _get_key()
    if not key:
        logger.warning("[LLM] EMERGENT_LLM_KEY not set — skipping")
        return None

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    last_exc: Optional[Exception] = None
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(LLM_URL, headers=headers, json=payload)
                if resp.status_code in _RETRY_STATUSES:
                    delay = _BASE_DELAY * (2 ** attempt)
                    logger.warning("[LLM] status %s on attempt %d — retrying in %.0fs", resp.status_code, attempt + 1, delay)
                    await asyncio.sleep(delay)
                    continue
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_exc = exc
            delay = _BASE_DELAY * (2 ** attempt)
            logger.warning("[LLM] network error on attempt %d (%s) — retrying in %.0fs", attempt + 1, exc, delay)
            await asyncio.sleep(delay)
        except Exception as exc:
            last_exc = exc
            break  # non-retriable

    logger.warning("[LLM] all attempts failed: %s", last_exc)
    return None
