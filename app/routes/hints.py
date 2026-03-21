"""
Hints Route — F5 Progressive Hint System

POST /hints
  - Accepts attempt_id + requested_level
  - Enforces sequential gating (can't skip from 1 → 3)
  - Returns the hint text for the requested level
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Student
from app.database.schemas import ErrorResponse, HintRequest, HintResponse
from app.services.hint_service import get_hint
from app.utils.auth_middleware import get_current_user
from app.utils.rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/hints",
    response_model=HintResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Hint level locked or out of order"},
        404: {"model": ErrorResponse, "description": "Attempt not found"},
    },
    summary="Request the next hint level (1 → 2 → 3, sequential)",
    tags=["Hints"],
)
@limiter.limit("20/minute")
async def request_hint(
    request: Request, # For limiter
    body: HintRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HintResponse:
    """
    Returns a hint at the requested level.

    Rules enforced by the server:
    - Level 1 is always available.
    - Level 2 requires level 1 to have been unlocked first.
    - Level 3 requires level 2 to have been unlocked first.
    - Once all 3 hints are used, further requests return 400.

    Hint depth by level:
    - 1 (Concept): Which formula/theorem is relevant?
    - 2 (Approach): What transformation or substitution helps?
    - 3 (Direction): Specific technique + why — almost at the first step.
    """
    try:
        result = await get_hint(
            attempt_id=body.attempt_id,
            requested_level=body.requested_level,
            current_user=current_user,
            db=db,
        )
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    except Exception as exc:
        logger.error("Hint generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Hint generation temporarily unavailable. Please try again.",
        )

    return result
