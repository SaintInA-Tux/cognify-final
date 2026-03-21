"""
Solution Route — F4 (SOS Mode) + F6 (Mistake Detection)

POST /solution/sos        — full solution, requires prior attempt_id
POST /solution/check-step — validate one step of student's working
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import uuid

from app.database.db import get_db
from app.database.schemas import (
    ErrorResponse,
    SOSModeResponse,
    StepCheckRequest,
    StepCheckResponse,
)
from app.database.models import Student
from app.services.math_verifier import check_step
from app.services.solution_service import handle_sos_request
from app.utils.auth_middleware import get_current_user
from app.utils.rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# F4 — SOS Mode
# ---------------------------------------------------------------------------

class SOSRequest(BaseModel):
    attempt_id: uuid.UUID


@router.post(
    "/solution/sos",
    response_model=SOSModeResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="SOS Mode — full step-by-step solution (deliberate fallback)",
    tags=["SOS Mode"],
)
@limiter.limit("5/minute")
async def sos_mode(
    request: Request, # For limiter
    body: SOSRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SOSModeResponse:
    """
    Returns the complete annotated solution for an existing attempt.

    IMPORTANT: This endpoint requires an existing attempt_id — you must
    call POST /ask first. SOS Mode is a deliberate second step, not a
    shortcut. This friction is intentional per the product spec.

    Usage is recorded on the attempt and feeds the weakness map (F7).
    High SOS frequency on a topic = strong weakness signal.
    """
    try:
        return await handle_sos_request(attempt_id=body.attempt_id, current_user=current_user, db=db)
    except ValueError as exc:
        msg = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=msg)
    except Exception as exc:
        logger.error("SOS Mode failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SOS generation temporarily unavailable. Please try again.",
        )


# ---------------------------------------------------------------------------
# F6 — Step Check (Mistake Detection)
# ---------------------------------------------------------------------------

@router.post(
    "/solution/check-step",
    response_model=StepCheckResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="Mistake Detection — validate a single step of student working",
    tags=["Mistake Detection"],
)
async def check_student_step(
    body: StepCheckRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StepCheckResponse:
    """
    The student submits one line of their working. The system validates it
    and identifies the exact error type if wrong.

    Error taxonomy:
    - conceptual: wrong understanding of the underlying concept
    - computational: arithmetic or algebra slip
    - method_selection: right idea, wrong technique
    - sign_error: sign flip
    - rule_misapplication: formula applied incorrectly
    - algebraic: simplification or manipulation error

    After REVEAL_AFTER_FAILURES consecutive wrong attempts on the same step,
    the correct step is revealed.
    """
    try:
        return await check_step(request=body, current_user=current_user, db=db)
    except ValueError as exc:
        msg = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=msg)
    except Exception as exc:
        logger.error("Step check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Step validation temporarily unavailable. Please try again.",
        )
