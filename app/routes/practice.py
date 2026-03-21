"""
Practice Route — F7 Weakness Tracking Dashboard

GET /practice/dashboard/{student_id}
  - Returns the student's full weakness map
  - Red / Yellow / Green per topic
  - Accuracy, hint dependency, SOS rates
  - Recommendation for what to practice next
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import WeaknessEntry
from app.database.schemas import (
    ErrorResponse,
    Subject,
    TopicWeakness,
    WeaknessDashboardResponse,
    WeaknessStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/practice/dashboard/{student_id}",
    response_model=WeaknessDashboardResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Weakness Dashboard — full topic performance breakdown (F7)",
    tags=["Dashboard"],
)
async def get_dashboard(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> WeaknessDashboardResponse:
    """
    Returns the student's weakness map across all topics they've attempted.

    Status meanings:
    - Red    (accuracy < 50%)  — needs focused practice
    - Yellow (accuracy 50–74%) — improving, keep going
    - Green  (accuracy ≥ 75%, sos < 20%) — strong topic

    Recommendation is generated from the worst-performing active topic.
    """
    result = await db.execute(
        select(WeaknessEntry)
        .where(WeaknessEntry.student_id == student_id)
        .order_by(WeaknessEntry.accuracy_pct.asc())
    )
    entries = result.scalars().all()

    if not entries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No practice data found for student {student_id}. Submit a problem first.",
        )

    weakest = []
    improving = []
    strong = []

    for entry in entries:
        hint_dep_pct = (
            int((entry.total_hints_used / entry.total_attempts) * 100)
            if entry.total_attempts > 0
            else 0
        )
        sos_pct = (
            int((entry.sos_count / entry.total_attempts) * 100)
            if entry.total_attempts > 0
            else 0
        )

        topic_weakness = TopicWeakness(
            subject=Subject(entry.subject),
            topic=entry.topic,
            total_attempts=entry.total_attempts,
            accuracy_pct=entry.accuracy_pct,
            hints_dependency_pct=hint_dep_pct,
            sos_pct=sos_pct,
            status=WeaknessStatus(entry.status),
            last_attempted_at=entry.last_attempted_at,
        )

        if entry.status == "red":
            weakest.append(topic_weakness)
        elif entry.status == "yellow":
            improving.append(topic_weakness)
        else:
            strong.append(topic_weakness)

    recommendation = _build_recommendation(weakest, improving)

    return WeaknessDashboardResponse(
        student_id=student_id,
        generated_at=datetime.now(timezone.utc),
        weakest_topics=weakest,
        improving_topics=improving,
        strong_topics=strong,
        recommendation=recommendation,
    )


def _build_recommendation(
    weakest: list[TopicWeakness],
    improving: list[TopicWeakness],
) -> str:
    """
    Generate a simple, actionable recommendation.
    Prioritises the weakest red topic. Falls back to improving topics.
    """
    if weakest:
        worst = weakest[0]  # already sorted by accuracy asc
        return (
            f"Your weakest area is {worst.topic} ({worst.subject.value}) "
            f"at {worst.accuracy_pct}% accuracy. "
            f"Recommended: 5 targeted Brain Mode problems on {worst.topic}."
        )

    if improving:
        focus = improving[0]
        return (
            f"{focus.topic} is at {focus.accuracy_pct}% — you're improving. "
            f"Push to 75% with 3 more Brain Mode problems today."
        )

    return (
        "All attempted topics are strong. "
        "Challenge yourself with JEE Advanced level problems."
    )
