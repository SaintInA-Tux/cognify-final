"""
Math Verifier — F6 Mistake Detection System.

Validates one student step at a time.

Returns structured output per spec:
  { "is_correct": bool, "error_type": str | null, "explanation": str | null }
Plus: corrective_guidance and correct_step (revealed after REVEAL_AFTER_FAILURES failures).

Every step result is persisted and feeds the WeaknessEntry for this student + topic.
"""

import logging
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import ProblemAttempt, StepSubmission, WeaknessEntry, Student
from app.database.schemas import ErrorType, StepCheckRequest, StepCheckResponse
from app.services.llm_service import call_deepseek
from app.utils.prompt_templates import MISTAKE_DETECTION_PROMPT
from app.utils.response_parser import parse_llm_response
from app.utils.auth_middleware import assert_owns_attempt

logger = logging.getLogger(__name__)

# After this many failures on the same step, correct_step is revealed.
REVEAL_AFTER_FAILURES = 2


class _MistakeRaw(BaseModel):
    """Internal parse target — matches MISTAKE_DETECTION_PROMPT JSON schema exactly."""
    is_correct: bool
    error_type: str | None = None
    explanation: str | None = None          # renamed from error_explanation per spec
    corrective_guidance: str | None = None
    correct_step: str | None = None


async def check_step(
    request: StepCheckRequest,
    current_user: Student,
    db: AsyncSession,
) -> StepCheckResponse:
    """
    Validate a single student-submitted step.

    Returns:
      is_correct    — whether the step is mathematically correct
      error_type    — category of error if incorrect (null if correct)
      explanation   — precise explanation of what went wrong (null if correct)
      corrective_guidance — nudge toward the fix without giving the answer
      correct_step  — revealed only after REVEAL_AFTER_FAILURES consecutive failures
    """
    # Load the attempt for problem context
    result = await db.execute(
        select(ProblemAttempt).where(ProblemAttempt.id == request.attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise ValueError(f"Attempt {request.attempt_id} not found.")

    assert_owns_attempt(attempt, current_user)

    # Count prior failures on this specific step (for reveal threshold)
    failure_count_result = await db.execute(
        select(func.count()).where(
            StepSubmission.attempt_id == request.attempt_id,
            StepSubmission.step_number == request.step_number,
            StepSubmission.is_correct == False,  # noqa: E712
        )
    )
    prior_failures = failure_count_result.scalar() or 0

    # Format previous steps for context
    prev_steps_text = (
        "\n".join(f"Step {i + 1}: {s}" for i, s in enumerate(request.previous_steps))
        or "This is the first step."
    )

    raw = await call_deepseek(
        prompt=MISTAKE_DETECTION_PROMPT.format(
            problem=attempt.problem_text,
            subject=attempt.subject or "Unknown",
            topic=attempt.topic or "Unknown",
            subtopic=attempt.subtopic or "Unknown",
            previous_steps=prev_steps_text,
            step_number=request.step_number,
            student_step=request.student_step,
            reveal_after=REVEAL_AFTER_FAILURES,
        ),
        max_tokens=768,
        temperature=0.0,
    )

    parsed = parse_llm_response(raw, _MistakeRaw)

    # Only surface correct_step after the reveal threshold is reached
    correct_step = None
    if not parsed.is_correct and prior_failures >= REVEAL_AFTER_FAILURES:
        correct_step = parsed.correct_step

    # Coerce error_type to the enum (default to conceptual if LLM returns unknown value)
    error_type: ErrorType | None = None
    if parsed.error_type:
        try:
            error_type = ErrorType(parsed.error_type)
        except ValueError:
            logger.warning("Unrecognised error_type from LLM: %s — defaulting to conceptual", parsed.error_type)
            error_type = ErrorType.CONCEPTUAL

    # Persist step submission
    submission = StepSubmission(
        attempt_id=request.attempt_id,
        step_number=request.step_number,
        student_step=request.student_step,
        is_correct=parsed.is_correct,
        error_type=error_type.value if error_type else None,
        error_explanation=parsed.explanation,  # DB column keeps original name
    )
    db.add(submission)

    # Update attempt-level mistake flag
    if not parsed.is_correct:
        attempt.mistake_logged = True
        attempt.error_type = error_type.value if error_type else None

    await db.flush()

    # Update weakness map for this student + topic
    await _update_weakness_map(
        student_id=attempt.student_id,
        subject=attempt.subject,
        topic=attempt.topic,
        is_correct=parsed.is_correct,
        db=db,
    )

    # Return spec-compliant structured output
    return StepCheckResponse(
        attempt_id=request.attempt_id,
        step_number=request.step_number,
        is_correct=parsed.is_correct,
        error_type=error_type,
        explanation=parsed.explanation,         # spec field name
        corrective_guidance=parsed.corrective_guidance,
        correct_step=correct_step,
    )


async def _update_weakness_map(
    student_id: uuid.UUID,
    subject: str | None,
    topic: str | None,
    is_correct: bool,
    db: AsyncSession,
) -> None:
    """Upsert the WeaknessEntry for this student + topic after each step check."""
    if not subject or not topic:
        return

    result = await db.execute(
        select(WeaknessEntry).where(
            WeaknessEntry.student_id == student_id,
            WeaknessEntry.topic == topic,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        entry = WeaknessEntry(student_id=student_id, subject=subject, topic=topic)
        db.add(entry)

    entry.total_attempts = (entry.total_attempts or 0) + 1
    entry.correct_attempts = entry.correct_attempts or 0
    if is_correct:
        entry.correct_attempts += 1

    entry.last_attempted_at = datetime.now(timezone.utc)
    entry.accuracy_pct = int((entry.correct_attempts / entry.total_attempts) * 100)
    sos_count = entry.sos_count or 0
    sos_pct = int((sos_count / entry.total_attempts) * 100)

    if entry.accuracy_pct >= 75 and sos_pct < 20:
        entry.status = "green"
    elif entry.accuracy_pct >= 50:
        entry.status = "yellow"
    else:
        entry.status = "red"

    await db.flush()
