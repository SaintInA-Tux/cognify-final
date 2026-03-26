"""
Ask Route — F1 (Problem Input) + F2 (Classification) + F3 (Brain Mode)

POST /ask       — text/LaTeX problem → Brain Mode response
POST /ask/image — image upload → OCR → Brain Mode response
POST /ask/direct — text problem → SOS Mode direct solution
"""

import base64
import io
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Request
from PIL import Image  # FIX: replaced magic.from_buffer() with Pillow (already in requirements)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.db import get_db
from app.database.models import ProblemAttempt, Student, ChatMessage, ChatSession
from app.database.schemas import (
    AskRequest, 
    BrainModeResponse, 
    ErrorResponse, 
    DirectAskRequest, 
    SOSModeResponse,
    GeneralChatRequest,
    GeneralChatResponse
)
from app.services.reasoning_service import classify_problem, generate_brain_mode, generate_general_chat
from app.services.solution_service import generate_sos_mode
from app.utils.auth_middleware import get_current_user
from app.utils.rate_limiter import limiter

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()


# ---------------------------------------------------------------------------
# Session ownership helper — FIX: prevents IDOR (cross-user session injection)
# ---------------------------------------------------------------------------

async def _validate_session_ownership(
    session_id: uuid.UUID,
    student_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Verify the chat session belongs to this student. Raises 403 if not."""
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found.")
    if session.student_id != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this chat session.")


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
@limiter.limit("10/minute")
async def ask(
    request: Request,
    body: AskRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrainModeResponse:
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
@limiter.limit("10/minute")
async def ask_image(
    request: Request,
    session_id: uuid.UUID | None = Form(None),
    image: UploadFile = File(..., description="Photo of the math problem"),
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrainModeResponse:
    # SEC-10 FIX: Check size BEFORE reading into memory
    if image.size and image.size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be under 5 MB.",
        )

    image_bytes = await image.read()

    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be under 5 MB.",
        )

    # FIX: use Pillow instead of magic.from_buffer() (magic was never imported)
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
        mime_type = Image.MIME.get(img.format, "application/octet-stream")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid file format. Only images are accepted.",
        )

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
# General Chat
# ---------------------------------------------------------------------------

@router.post(
    "/ask/general",
    response_model=GeneralChatResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="General chat interaction — returns unstructured direct response",
    tags=["General Chat"],
)
@limiter.limit("20/minute")
async def ask_general(
    request: Request,
    body: GeneralChatRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GeneralChatResponse:
    try:
        content = await generate_general_chat(body.message)
    except Exception as exc:
        logger.error("General chat generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="General chat service temporarily unavailable.",
        )

    if body.session_id:
        await _validate_session_ownership(body.session_id, current_user.id, db)
        
        user_msg = ChatMessage(session_id=body.session_id, role="user", content=body.message, mode="general")
        asst_msg = ChatMessage(session_id=body.session_id, role="assistant", content=content, mode="general")
        db.add_all([user_msg, asst_msg])

        # Update session updated_at
        sess_result = await db.execute(select(ChatSession).where(ChatSession.id == body.session_id))
        chat_session = sess_result.scalar_one_or_none()
        if chat_session:
            chat_session.updated_at = datetime.now(timezone.utc)
        
        await db.commit()

    return GeneralChatResponse(content=content, session_id=body.session_id)


# ---------------------------------------------------------------------------
# Direct SOS Mode
# ---------------------------------------------------------------------------

@router.post(
    "/ask/direct",
    response_model=SOSModeResponse,
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Submit a problem (text) — returns SOS Mode direct solution",
    tags=["SOS Mode"],
)
@limiter.limit("5/minute")
async def ask_direct(
    request: Request,
    body: DirectAskRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SOSModeResponse:
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
    await db.commit()

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
        # FIX: validate session ownership before writing to it
        await _validate_session_ownership(body.session_id, current_user.id, db)

        user_msg = ChatMessage(session_id=body.session_id, role="user", content=body.problem, mode="sos")
        responseText = []
        for step in response.solution_steps:
            responseText.append(f"**Step {step.step_number}:** {step.expression}\n_{step.explanation}_")
        responseText.append(f"**Final Answer:** {response.final_answer}")

        asst_msg = ChatMessage(
            session_id=body.session_id,
            role="assistant",
            content="\n\n".join(responseText),
            mode="sos",
        )
        db.add_all([user_msg, asst_msg])

        # Update session updated_at so sidebar ordering is correct
        sess_result = await db.execute(select(ChatSession).where(ChatSession.id == body.session_id))
        chat_session = sess_result.scalar_one_or_none()
        if chat_session:
            chat_session.updated_at = datetime.now(timezone.utc)

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
    try:
        classification = await classify_problem(problem)
    except Exception as exc:
        logger.error("Classification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Classification service temporarily unavailable. Please try again.",
        )

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
    await db.flush()
    await db.commit()

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
        # FIX: validate session ownership before writing to it
        await _validate_session_ownership(session_id, student_id, db)

        is_conceptual = "conceptual" in classification.pattern.lower() or "theory" in classification.pattern.lower()

        p_label = "The Big Idea" if is_conceptual else "Pattern"
        m_label = "Core Principle" if is_conceptual else "Method"
        s_label = "Context" if is_conceptual else "Setup"
        f_label = "Next Step" if is_conceptual else "First Step"

        user_msg = ChatMessage(session_id=session_id, role="user", content=problem, mode="brain")
        responseText = [
            f"**{p_label}:** {response.pattern}",
            f"**{m_label}:** {response.method}",
            f"**{s_label}:** {response.setup}",
            f"**{f_label}:** {response.first_step}",
        ]
        asst_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content="\n\n".join(responseText),
            mode="brain",
        )
        db.add_all([user_msg, asst_msg])

        # Update session updated_at so sidebar ordering is correct
        sess_result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
        chat_session = sess_result.scalar_one_or_none()
        if chat_session:
            chat_session.updated_at = datetime.now(timezone.utc)

        await db.commit()

    return response


# ---------------------------------------------------------------------------
# MathPix OCR helper
# ---------------------------------------------------------------------------

async def _ocr_to_latex(image_bytes: bytes, content_type: str) -> str:
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
