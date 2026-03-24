"""
Hint Service — F5 Progressive Hint System.

Sequential gating (server-enforced, not client-enforced):
  Hint 1 — always available for a valid attempt
  Hint 2 — only if Hint 1 has been unlocked
  Hint 3 — only if Hint 2 has been unlocked

State is stored in Redis (keyed by attempt_id) with DB as canonical fallback.
The gating check happens in _assert_level_accessible() before any LLM call.
"""

import logging
import uuid

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis_client import cache_get, cache_set
from app.config import get_settings
from app.database.models import HintUnlock, ProblemAttempt, Student
from app.database.schemas import HintResponse
from app.services.llm_service import call_deepseek
from app.utils.auth_middleware import assert_owns_attempt
from app.utils.prompt_templates import HINT_PROMPT
from app.utils.response_parser import parse_llm_response

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_HINT_LEVEL = 3


class _HintRaw(BaseModel):
    hint_text: str
    is_final_hint: bool


def _hint_session_key(attempt_id: uuid.UUID) -> str:
    return f"hints:{attempt_id}"


async def _get_max_unlocked(attempt_id: uuid.UUID, db: AsyncSession) -> int:
    """
    Return the highest hint level already unlocked for this attempt.
    Redis-first, DB fallback.
    """
    key = _hint_session_key(attempt_id)
    cached = await cache_get(key)
    if cached is not None:
        return int(cached.get("max_unlocked", 0))

    # DB fallback
    result = await db.execute(
        select(HintUnlock)
        .where(HintUnlock.attempt_id == attempt_id)
        .order_by(HintUnlock.hint_level.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    level = row.hint_level if row else 0

    await cache_set(key, {"max_unlocked": level}, settings.hint_session_ttl)
    return level


def _assert_level_accessible(requested: int, max_unlocked: int) -> None:
    """
    Enforce sequential gating with explicit per-level error messages.

    Allowed:  requested == max_unlocked + 1  (next level)
              requested <= max_unlocked       (re-request already unlocked level)
    Rejected: requested > max_unlocked + 1   (skipping a level)
    """
    if requested <= max_unlocked:
        return  # Re-requesting an already-unlocked level is fine

    if requested > max_unlocked + 1:
        # Give a precise message about which level must be unlocked first
        missing = max_unlocked + 1
        level_names = {1: "Concept hint (level 1)", 2: "Approach hint (level 2)"}
        missing_name = level_names.get(missing, f"level {missing}")
        raise ValueError(
            f"Hint level {requested} is locked. "
            f"You must unlock {missing_name} before accessing level {requested}."
        )


async def get_hint(
    attempt_id: uuid.UUID,
    requested_level: int,
    current_user: Student,
    db: AsyncSession,
) -> HintResponse:
    """
    Validate gating, generate the hint, persist the unlock, return the response.

    Level 1 — Concept:   which formula/theorem is relevant
    Level 2 — Approach:  what transformation/substitution to use (requires level 1)
    Level 3 — Direction: specific technique + why, doorstep of first step (requires level 2)
    """
    max_unlocked = await _get_max_unlocked(attempt_id, db)

    # --- Gating check ---
    _assert_level_accessible(requested_level, max_unlocked)

    # Load attempt for problem context
    attempt_result = await db.execute(
        select(ProblemAttempt).where(ProblemAttempt.id == attempt_id)
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        raise ValueError(f"Attempt {attempt_id} not found.")

    # Prevent IDOR
    assert_owns_attempt(attempt, current_user)

    # Build context string of hints already given
    hints_already: list[str] = []
    if max_unlocked >= 1:
        hints_already.append("Concept hint (level 1) already given")
    if max_unlocked >= 2:
        hints_already.append("Approach hint (level 2) already given")
    hints_already_str = "; ".join(hints_already) if hints_already else "None"

    # is_final_hint as a JSON-safe literal for the prompt template
    is_final_hint_str = "true" if requested_level == MAX_HINT_LEVEL else "false"

    raw = await call_deepseek(
        prompt=HINT_PROMPT.format(
            hint_level=requested_level,
            is_final_hint=is_final_hint_str,
            problem=attempt.problem_text,
            subject=attempt.subject or "Unknown",
            topic=attempt.topic or "Unknown",
            subtopic=attempt.subtopic or "Unknown",
            hints_already_given=hints_already_str,
        ),
        max_tokens=512,
        temperature=0.0,
    )

    parsed = parse_llm_response(raw, _HintRaw)

    # Persist new unlock (only if this is a new level, not a re-request)
    if requested_level > max_unlocked:
        db.add(HintUnlock(attempt_id=attempt_id, hint_level=requested_level))
        attempt.hints_used = requested_level
        await db.flush()

        # BUG-08 FIX: Also increment WeaknessEntry.total_hints_used
        if attempt.topic and attempt.subject:
            from app.database.models import WeaknessEntry
            we_result = await db.execute(
                select(WeaknessEntry).where(
                    WeaknessEntry.student_id == attempt.student_id,
                    WeaknessEntry.topic == attempt.topic,
                )
            )
            weakness = we_result.scalar_one_or_none()
            if weakness:
                weakness.total_hints_used = (weakness.total_hints_used or 0) + 1

        await cache_set(
            _hint_session_key(attempt_id),
            {"max_unlocked": requested_level},
            settings.hint_session_ttl,
        )

    return HintResponse(
        attempt_id=attempt_id,
        hint_level=requested_level,
        hint_text=parsed.hint_text,
        is_final_hint=requested_level == MAX_HINT_LEVEL,
        next_hint_available=requested_level < MAX_HINT_LEVEL,
    )
