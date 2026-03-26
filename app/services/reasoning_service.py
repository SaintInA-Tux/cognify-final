"""
Reasoning Service — F2 (Classification) and F3 (Brain Mode) only.

Responsibilities:
  classify_problem()    — F2: classify subject/topic/subtopic/difficulty/pattern
  generate_brain_mode() — F3: return pattern/method/setup/first_step, never the answer

SOS Mode (F4) lives exclusively in solution_service.py.
Brain Mode never imports from solution_service — the separation is enforced at import level.

Flow guaranteed by ask.py:
  classify_problem() → create ProblemAttempt → generate_brain_mode()
"""

import hashlib
import logging
import uuid

from pydantic import BaseModel

from app.cache.redis_client import cache_get, cache_set
from app.config import get_settings
from app.database.schemas import BrainModeResponse, ClassificationResult
from app.services.llm_service import call_deepseek
from app.utils.prompt_templates import BRAIN_MODE_PROMPT, CLASSIFICATION_PROMPT, GENERAL_CHAT_PROMPT
from app.utils.response_parser import parse_brain_mode_response, parse_llm_response

logger = logging.getLogger(__name__)
settings = get_settings()


def _problem_hash(problem: str) -> str:
    """Stable cache key derived from problem text."""
    return hashlib.sha256(problem.strip().lower().encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# F2 — Classification
# Must be called before Brain Mode or SOS Mode.
# Result is cached for 24 hours — same problem always yields same classification.
# ---------------------------------------------------------------------------

async def classify_problem(problem: str) -> ClassificationResult:
    """
    Classify the problem: subject, topic, subtopic, difficulty, pattern.
    Cached in Redis by problem hash for 24 hours.
    Raises ValueError if the LLM response is malformed or fails schema validation.
    """
    cache_key = f"classification:{_problem_hash(problem)}"

    cached = await cache_get(cache_key)
    if cached:
        logger.debug("Classification cache hit — hash %s", _problem_hash(problem))
        return ClassificationResult.model_validate(cached)

    raw = await call_deepseek(
        prompt=CLASSIFICATION_PROMPT.format(problem=problem),
        max_tokens=512,
        temperature=0.0,
        model=settings.fast_model,
    )

    logger.debug("Raw classification response: %s", raw[:1000])

    result = parse_llm_response(raw, ClassificationResult)
    await cache_set(cache_key, result.model_dump(), settings.classification_cache_ttl)
    return result


# ---------------------------------------------------------------------------
# F3 — Brain Mode
# Receives classification from classify_problem().
# Returns pattern, method, setup, first_step — nothing else.
# Uses parse_brain_mode_response() which rejects any final_answer in output.
# ---------------------------------------------------------------------------

class _BrainModeRaw(BaseModel):
    """Internal parse target — exactly the fields Brain Mode must return."""
    pattern: str
    method: str
    setup: str
    first_step: str
    variables: list[str] | None = None


async def generate_brain_mode(
    problem: str,
    classification: ClassificationResult,
    attempt_id: uuid.UUID,
) -> BrainModeResponse:
    """
    Generate Brain Mode guidance.

    Returns: pattern, method, setup, first_step.
    Never returns: final_answer, solution_steps, derivations, or practice questions.

    Uses parse_brain_mode_response() — any response containing forbidden solution
    fields is rejected before the result is returned.
    """
    raw = await call_deepseek(
        prompt=BRAIN_MODE_PROMPT.format(
            problem=problem,
            subject=classification.subject.value,
            topic=classification.topic,
            subtopic=classification.subtopic,
            difficulty=classification.difficulty.value,
            pattern=classification.pattern,
        ),
        max_tokens=1024,
        temperature=0.0,
        model=settings.fast_model if classification.difficulty.value in ["easy", "medium"] else settings.deepseek_model,
    )

    # parse_brain_mode_response() rejects any JSON containing forbidden fields
    # (final_answer, solution_steps, etc.) before Pydantic validation.
    parsed = parse_brain_mode_response(raw, _BrainModeRaw)

    return BrainModeResponse(
        attempt_id=attempt_id,
        classification=classification,
        pattern=parsed.pattern,
        method=parsed.method,
        setup=parsed.setup,
        first_step=parsed.first_step,
        variables=parsed.variables,
        answer_withheld=True,  # Always True — structural enforcement, not a suggestion
    )


async def generate_general_chat(message: str) -> str:
    """
    Generate a direct, unstructured response for General Mode.
    No JSON parsing needed — returns raw text/markdown from LLM.
    """
    content = await call_deepseek(
        prompt=GENERAL_CHAT_PROMPT.format(message=message),
        max_tokens=2048,
        temperature=0.7,  # Slightly higher for more natural conversation
        model=settings.deepseek_model,
    )
    return content.strip()
