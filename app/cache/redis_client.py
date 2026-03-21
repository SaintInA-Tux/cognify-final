"""
Redis Client — optional cache layer.

If REDIS_ENABLED=false in .env (the default for local dev),
all cache operations are no-ops. The app works correctly without Redis —
classifications just aren't cached between restarts.

Set REDIS_ENABLED=true when Redis is running locally or in production.
"""

import json
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis = None


async def get_redis():
    global _redis
    if not settings.redis_enabled:
        return None
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            _redis = await aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            await _redis.ping()
            logger.info("Redis connected at %s", settings.redis_url)
        except Exception as exc:
            logger.warning("Redis unavailable (%s) — running without cache", exc)
            _redis = None
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    r = await get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl, json.dumps(value))
    except Exception as exc:
        logger.warning("Redis SET failed for key=%s: %s", key, exc)


async def cache_get(key: str) -> Any | None:
    r = await get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.warning("Redis GET failed for key=%s: %s", key, exc)
        return None


async def cache_delete(key: str) -> None:
    r = await get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception as exc:
        logger.warning("Redis DELETE failed for key=%s: %s", key, exc)
