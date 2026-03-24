"""
LLM Service — single point of contact with the Groq API.

Groq uses the same OpenAI-compatible /v1/chat/completions endpoint.
All prompts are sent as the user message with a minimal system framing.

Responsibilities:
  - Build and send requests to Groq /openai/v1/chat/completions
  - Enforce timeout and retry policy (3 attempts, exponential backoff)
  - Return raw text — all parsing happens in response_parser.py

Note: Groq does not emit <think>...</think> blocks — response_parser.py
strips them anyway so this is safe either way.
"""

import json
import logging
from typing import Any, AsyncGenerator

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_DEFAULT_MAX_TOKENS = 2048
_TIMEOUT_SECONDS = 30.0  # Groq is fast — 30s is generous

_SYSTEM_MESSAGE = (
    "You are a precise AI assistant. Follow the instructions in each prompt exactly. "
    "Return only valid JSON as instructed — no markdown, no text outside the JSON object."
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def call_llm(
    prompt: str,
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    temperature: float = 0.0,
    model: str | None = None,
) -> str:
    """
    Send a prompt to Groq and return the raw assistant response text.

    temperature=0.0 — math problems need deterministic output.
    Retries up to 3 times on transient failures with exponential backoff.
    """
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model or settings.groq_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        base_url = settings.groq_base_url.rstrip("/")
        # Prevent double /v1 if the user put it in .env
        if not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"
        
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()

    data = response.json()
    logger.debug(
        "Groq response received (model=%s, tokens=%s)",
        data.get("model"),
        data.get("usage", {}).get("total_tokens"),
    )

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Groq response shape: %s", data)
        raise ValueError(f"Groq response missing expected fields: {exc}") from exc


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type(httpx.HTTPStatusError),
    reraise=True,
)
async def call_llm_stream(
    prompt: str,
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    temperature: float = 0.0,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Send a prompt to Groq and yield response chunks via SSE.
    Used for streaming Brain Mode responses to the frontend.
    """
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model or settings.groq_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        base_url = settings.groq_base_url.rstrip("/")
        if not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"

        async with client.stream(
            "POST",
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as response:
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                await response.aread()
                logger.error("Groq stream HTTP error: %s - %s", exc, response.text)
                raise

            async for line in response.aiter_lines():
                line = line.strip()
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        content = data.get("choices", [{}])[0].get("delta", {}).get("content")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        logger.warning("Failed to decode SSE line: %s", line)
                        continue


# ---------------------------------------------------------------------------
# Backwards-compatible aliases
# Any file that still imports call_deepseek will work without changes
# ---------------------------------------------------------------------------
call_deepseek = call_llm
call_deepseek_stream = call_llm_stream
