"""
Solution Service — F4 (SOS Mode) exclusively.

This is the ONLY place in the codebase that generates a full solution.
Brain Mode (reasoning_service.py) does not import from here.
SOS Mode does not import from reasoning_service.py.

Responsibilities:
  generate_sos_mode()   — LLM call that produces the full annotated solution
  handle_sos_request()  — DB orchestration: load attempt, mark SOS, update weakness, call LLM
"""

import logging
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ProblemAttempt, WeaknessEntry, Student
from app.database.schemas import (
    ClassificationResult,
    Difficulty,
    SOSModeResponse,
    SolutionStep,
    Subject,
)
from app.services.llm_service import call_deepseek
from app.utils.prompt_templates import SOS_MODE_PROMPT
from app.utils.response_parser import parse_llm_response
from app.utils.auth_middleware import assert_owns_attempt

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Internal parse target for SOS LLM output
# ---------------------------------------------------------------------------

class _SOSRaw(BaseModel):
    solution_steps: list[SolutionStep]
    final_answer: str
    key_concepts_used: list[str]


# ---------------------------------------------------------------------------
# F4 — SOS Mode LLM call
# Called only from handle_sos_request() below.
# Never called from Brain Mode code.
# ---------------------------------------------------------------------------

async def generate_sos_mode(
    problem: str,
    classification: ClassificationResult,
    attempt_id: uuid.UUID,
) -> SOSModeResponse:
    """
    Call the LLM with SOS_MODE_PROMPT and return a complete annotated solution.
    Uses the generic parse_llm_response() — SOS output is allowed to contain final_answer.
    """
    raw = await call_deepseek(
        prompt=SOS_MODE_PROMPT.format(
            problem=problem,
            subject=classification.subject.value,
            topic=classification.topic,
            subtopic=classification.subtopic,
            difficulty=classification.difficulty.value,
        ),
        max_tokens=4096,  # Increased for long step-by-step solutions
        temperature=0.0,
        model=settings.fast_model if classification.difficulty.value in ["easy", "medium"] else settings.deepseek_model,
    )

    parsed = parse_llm_response(raw, _SOSRaw)

    return SOSModeResponse(
        attempt_id=attempt_id,
        classification=classification,
        solution_steps=parsed.solution_steps,
        final_answer=parsed.final_answer,
        key_concepts_used=parsed.key_concepts_used,
        post_sos_prompt="You've seen the full solution. Now try a similar problem in Brain Mode?",
    )


# ---------------------------------------------------------------------------
# F4 — SOS Mode DB orchestration
# Entry point called by routes/solution.py
# ---------------------------------------------------------------------------

async def handle_sos_request(
    attempt_id: uuid.UUID,
    current_user: Student,
    db: AsyncSession,
) -> SOSModeResponse:
    """
    SOS Mode entry point.

    1. Load the attempt — must exist from a prior Brain Mode call via POST /ask.
    2. Mark sos_used = True on the attempt record.
    3. Update the WeaknessEntry SOS signal for this topic.
    4. Call generate_sos_mode() and return the full solution.
    """
    result = await db.execute(
        select(ProblemAttempt).where(ProblemAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise ValueError(
            f"Attempt {attempt_id} not found. "
            "You must submit the problem via POST /v1/ask before requesting SOS Mode."
        )

    assert_owns_attempt(attempt, current_user)

    # Mark SOS usage on the attempt
    attempt.sos_used = True
    attempt.mode_used = "sos"
    attempt.completed_at = datetime.now(timezone.utc)
    await db.flush()

    # Update weakness map — SOS on a topic is a weakness signal (F7)
    if attempt.topic and attempt.subject:
        await _update_weakness_on_sos(
            student_id=attempt.student_id,
            subject=attempt.subject,
            topic=attempt.topic,
            db=db,
        )

    # Reconstruct classification from the stored attempt fields
    classification = ClassificationResult(
        subject=Subject(attempt.subject),
        topic=attempt.topic,
        subtopic=attempt.subtopic or attempt.topic,
        difficulty=Difficulty(attempt.difficulty),
        pattern=attempt.pattern or "Standard",
        confidence=1.0,
    )

    return await generate_sos_mode(
        problem=attempt.problem_text,
        classification=classification,
        attempt_id=attempt_id,
    )


async def _update_weakness_on_sos(
    student_id: uuid.UUID,
    subject: str,
    topic: str,
    db: AsyncSession,
) -> None:
    """Increment the SOS count on the WeaknessEntry for this student + topic."""
    result = await db.execute(
        select(WeaknessEntry).where(
            WeaknessEntry.student_id == student_id,
            WeaknessEntry.topic == topic,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return  # No WeaknessEntry yet — will be created on first step submission

    entry.sos_count = (entry.sos_count or 0) + 1
    entry.last_attempted_at = datetime.now(timezone.utc)
    _recompute_status(entry)
    await db.flush()


def _recompute_status(entry: WeaknessEntry) -> None:
    """
    Recompute red/yellow/green status from accuracy and SOS rate.
      Green:  accuracy >= 75% AND sos_pct < 20%
      Yellow: accuracy >= 50%
      Red:    accuracy < 50%
    """
    if entry.total_attempts == 0:
        entry.status = "red"
        return

    entry.accuracy_pct = int((entry.correct_attempts / entry.total_attempts) * 100)
    sos_pct = int((entry.sos_count / entry.total_attempts) * 100)

    if entry.accuracy_pct >= 75 and sos_pct < 20:
        entry.status = "green"
    elif entry.accuracy_pct >= 50:
        entry.status = "yellow"
    else:
        entry.status = "red"
