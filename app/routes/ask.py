"""
Ask Route — F1 (Problem Input) + F2 (Classification) + F3 (Brain Mode)

POST /ask
  - Accepts the problem (text or image)
  - Runs classification (F2)
  - Creates a ProblemAttempt record
  - Returns Brain Mode guidance (F3) — the primary learning experience

This is the main entry point. Every other feature (hints, SOS, step-check)
operates on an attempt_id returned from this endpoint.
"""

import base64
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.db import get_db
from app.database.models import ProblemAttempt, Student, ChatMessage, ChatSession
from app.database.schemas import AskRequest, BrainModeResponse, ErrorResponse, DirectAskRequest, SOSModeResponse
from app.services.reasoning_service import classify_problem, generate_brain_mode
from app.services.solution_service import generate_sos_mode
from app.utils.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()


# ---------------------------------------------------------------------------
# Text / LaTeX input
# ---------------------------------------------------------------------------

@router.post(
    "/ask",
    response_model=BrainModeResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Submit a problem (text) — returns Brain Mode guidance",
    tags=["Brain Mode"],
)
async def ask(
    body: AskRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrainModeResponse:
    """
    Primary endpoint. The student submits a problem in text/LaTeX form.

    Returns Brain Mode output (F3):
    - Pattern recognition
    - Method selection with reasoning
    - Setup instructions
    - First step guidance
    - Final answer is NEVER included
    """
    return await _process_problem(
        problem=body.problem,
        student_id=current_user.id,
        session_id=body.session_id,
        input_method=body.input_method.value,
        db=db,
    )


# ---------------------------------------------------------------------------
# Image input (MathPix OCR → LaTeX → Brain Mode)
# ---------------------------------------------------------------------------

@router.post(
    "/ask/image",
    response_model=BrainModeResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Submit a problem as an image — OCR then Brain Mode",
    tags=["Brain Mode"],
)
async def ask_image(
    session_id: uuid.UUID | None = Form(None),
    image: UploadFile = File(..., description="Photo of the math problem"),
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrainModeResponse:
    """
    Image input path (F1). Uploads image → MathPix OCR → LaTeX string → Brain Mode.
    Falls back gracefully if MathPix is not configured.
    """
    image_bytes = await image.read()

    if len(image_bytes) > 5 * 1024 * 1024:  # 5 MB cap
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be under 5 MB.",
        )

    # Validate image via magic bytes
    mime_type = magic.from_buffer(image_bytes, mime=True)
    if not mime_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid file format. Only images are accepted.",
        )

    try:
        latex = await _ocr_to_latex(image_bytes, mime_type)
    except Exception as exc:
        logger.error("OCR failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Image processing failed.",
        )

    return await _process_problem(
        problem=latex,
        student_id=current_user.id,
        session_id=session_id,
        input_method="image",
        db=db,
    )


# ---------------------------------------------------------------------------
# Shared processing pipeline
# ---------------------------------------------------------------------------

@router.post(
    "/ask/direct",
    response_model=SOSModeResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Submit a problem (text) — returns SOS Mode direct solution",
    tags=["SOS Mode"],
)
async def ask_direct(
    body: DirectAskRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SOSModeResponse:
    """
    Direct SOS Mode. The student submits a problem and requests full solution instantly.
    """
    try:
        classification = await classify_problem(body.problem)
    except Exception as exc:
        logger.error("Classification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Classification service temporarily unavailable.",
        )

    attempt = ProblemAttempt(
        student_id=current_user.id,
        problem_text=body.problem,
        input_method=body.input_method.value,
        subject=classification.subject.value,
        topic=classification.topic,
        subtopic=classification.subtopic,
        difficulty=classification.difficulty.value,
        pattern=classification.pattern,
        mode_used="sos",
        sos_used=True,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    await db.flush()

    try:
        response = await generate_sos_mode(
            problem=body.problem,
            classification=classification,
            attempt_id=attempt.id,
        )
    except Exception as exc:
        logger.error("SOS Mode generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SOS Mode generation temporarily unavailable.",
        )
        
    if body.session_id:
        user_msg = ChatMessage(session_id=body.session_id, role="user", content=body.problem, mode="sos")
        # Format a full response string
        responseText = []
        for step in response.solution_steps:
            responseText.append(f"**Step {step.step_number}:** {step.expression}\n_{step.explanation}_")
        responseText.append(f"**Final Answer:** {response.final_answer}")
        
        asst_msg = ChatMessage(session_id=body.session_id, role="assistant", content="\n\n".join(responseText), mode="sos")
        db.add_all([user_msg, asst_msg])
        await db.commit()

    return response

# ---------------------------------------------------------------------------
# Shared processing pipeline
# ---------------------------------------------------------------------------

async def _process_problem(
    problem: str,
    student_id: uuid.UUID,
    session_id: uuid.UUID | None,
    input_method: str,
    db: AsyncSession,
) -> BrainModeResponse:
    """
    Shared pipeline: classify → create attempt → generate Brain Mode.
    All three steps happen here so the attempt is always created
    before hint/SOS endpoints are called.
    """
    try:
        classification = await classify_problem(problem)
    except Exception as exc:
        logger.error("Classification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Classification service temporarily unavailable. Please try again.",
        )

    # Create the attempt record
    attempt = ProblemAttempt(
        student_id=student_id,
        problem_text=problem,
        input_method=input_method,
        subject=classification.subject.value,
        topic=classification.topic,
        subtopic=classification.subtopic,
        difficulty=classification.difficulty.value,
        pattern=classification.pattern,
        mode_used="brain",
        started_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    await db.flush()  # Gets the UUID without committing

    try:
        response = await generate_brain_mode(
            problem=problem,
            classification=classification,
            attempt_id=attempt.id,
        )
    except Exception as exc:
        logger.error("Brain Mode generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Brain Mode generation temporarily unavailable. Please try again.",
        )
        
    if session_id:
        user_msg = ChatMessage(session_id=session_id, role="user", content=problem, mode="brain")
        responseText = [
            f"**Pattern:** {response.pattern}",
            f"**Method:** {response.method}",
            f"**Setup:** {response.setup}",
            f"**First Step:** {response.first_step}",
        ]
        asst_msg = ChatMessage(session_id=session_id, role="assistant", content="\n\n".join(responseText), mode="brain")
        db.add_all([user_msg, asst_msg])
        await db.commit()

    return response


# ---------------------------------------------------------------------------
# MathPix OCR helper
# ---------------------------------------------------------------------------

async def _ocr_to_latex(image_bytes: bytes, content_type: str) -> str:
    """
    Call MathPix API to convert an image to LaTeX.
    Returns the raw LaTeX string.
    Raises on API error.
    """
    if not settings.mathpix_app_id or not settings.mathpix_app_key:
        raise ValueError(
            "MathPix credentials not configured. "
            "Set MATHPIX_APP_ID and MATHPIX_APP_KEY in .env"
        )

    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.mathpix.com/v3/text",
            headers={
                "app_id": settings.mathpix_app_id,
                "app_key": settings.mathpix_app_key,
                "Content-Type": "application/json",
            },
            json={
                "src": data_url,
                "formats": ["latex_simplified"],
                "math_inline_delimiters": ["$", "$"],
            },
        )
        resp.raise_for_status()

    result = resp.json()

    if "error" in result:
        raise ValueError(f"MathPix error: {result['error']}")

    latex = result.get("latex_simplified") or result.get("text", "")
    if not latex:
        raise ValueError("MathPix returned empty result.")

    return latex
