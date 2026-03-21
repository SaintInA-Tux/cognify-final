"""
LLM Service — single point of contact with the DeepSeek API.

All prompts are now single strings (system + user merged in prompt_templates.py).
This service sends them as the user message with a minimal system framing.

Responsibilities:
  - Build and send requests to /v1/chat/completions
  - Enforce timeout and retry policy (3 attempts, exponential backoff)
  - Return raw text — all parsing happens in response_parser.py
"""

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_DEFAULT_MAX_TOKENS = 2048
_TIMEOUT_SECONDS = 120.0

# Minimal system message — all domain instructions are in the prompt itself.
_SYSTEM_MESSAGE = (
    "You are a precise AI assistant. Follow the instructions in each prompt exactly. "
    "Return only valid JSON as instructed — no markdown, no text outside the JSON object."
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def call_deepseek(
    prompt: str,
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    temperature: float = 0.0,
    model: str | None = None,
) -> str:
    """
    Send a single prompt to DeepSeek and return the raw assistant response text.

    temperature=0.0 throughout — math problems have one correct approach and
    deterministic output is required for caching and consistent behaviour.

    Retries up to 3 times on transient failures with exponential backoff.
    Raises httpx.HTTPStatusError on persistent 4xx/5xx.
    """
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }

    payload: dict[str, Any] = {
        "model": model or settings.deepseek_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        base_url = settings.deepseek_base_url.rstrip("/")
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()

    data = response.json()
    logger.info("Raw Gemini API Data Dump: %s", data)

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected DeepSeek response shape: %s", data)
        raise ValueError(f"DeepSeek response missing expected fields: {exc}") from exc

import json
from typing import AsyncGenerator

async def call_deepseek_stream(
    prompt: str,
    max_tokens: int = _DEFAULT_MAX_TOKENS,
    temperature: float = 0.0,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Send a prompt to DeepSeek and yield the assistant's response chunks via SSE.
    """
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }
    
    payload: dict[str, Any] = {
        "model": model or settings.deepseek_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        base_url = settings.deepseek_base_url.rstrip("/")
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
                logger.error("DeepSeek stream HTTP error: %s - %s", exc, response.text)
                raise

            async for line in response.aiter_lines():
                line = line.strip()
                if not line:
                    continue
                if line == "data: [DONE]":
                    break
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if "choices" in data and len(data["choices"]) > 0:
                            delta = data["choices"][0].get("delta", {})
                            content = delta.get("content")
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        logger.warning("Failed to decode SSE line: %s", line)
                        continue
