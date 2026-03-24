"""
Auth Routes

POST /auth/guest    — create a guest session (prototype: only auth mode)
GET  /auth/me       — get current user profile
PUT  /auth/profile  — update profile (onboarding + settings)

NOTE: /auth/register and /auth/login kept for future use but
guest mode is the primary auth flow for the prototype.
"""

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
import bcrypt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Student
from app.database.schemas import RegisterRequest, LoginResponse, StudentProfile
from app.utils.auth_middleware import create_access_token, get_current_user
from app.utils.rate_limiter import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ---------------------------------------------------------------------------
# Guest login — primary auth for prototype
# ---------------------------------------------------------------------------

@router.post("/guest", response_model=LoginResponse)
@limiter.limit("10/minute")
async def guest_login(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create a guest account instantly. No email or password needed."""
    guest_id = uuid.uuid4().hex[:8]
    email = f"guest_{guest_id}@phyprep.local"
    hashed_pwd = get_password_hash(uuid.uuid4().hex)

    student = Student(
        email=email,
        name=f"Guest {guest_id}",
        password_hash=hashed_pwd,
        level="Class 12",
        exam_board="CBSE",
        target_exam="JEE Main",
        is_guest=True,
        onboarded=False,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    access_token = create_access_token(data={"sub": str(student.id)})

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        student_id=student.id,
    )


# ---------------------------------------------------------------------------
# Register (kept for future — not used in prototype UI)
# ---------------------------------------------------------------------------

@router.post("/register", response_model=LoginResponse)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    hashed_pwd = get_password_hash(body.password)
    student = Student(
        email=body.email,
        name=body.name,
        password_hash=hashed_pwd,
        level=body.level,
        exam_board=body.exam_board,
        target_exam=body.target_exam,
        is_guest=False,
        onboarded=False,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    access_token = create_access_token(data={"sub": str(student.id)})
    return LoginResponse(access_token=access_token, token_type="bearer", student_id=student.id)


# ---------------------------------------------------------------------------
# Login (kept for future — not used in prototype UI)
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.email == form_data.username))
    student = result.scalar_one_or_none()
    if not student or not verify_password(form_data.password, student.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(student.id)})
    return LoginResponse(access_token=access_token, token_type="bearer", student_id=student.id)


# ---------------------------------------------------------------------------
# Get current user profile
# ---------------------------------------------------------------------------

@router.get("/me", response_model=StudentProfile)
async def get_me(current_user: Student = Depends(get_current_user)):
    return StudentProfile(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        level=current_user.level,
        exam_board=current_user.exam_board,
        target_exam=current_user.target_exam,
        daily_goal=current_user.daily_goal,
        onboarded=current_user.onboarded,
        is_guest=current_user.is_guest,
    )


# ---------------------------------------------------------------------------
# Update profile — used by onboarding (final screen) and settings page
# ---------------------------------------------------------------------------

class UpdateProfileRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    level: str | None = None
    exam_board: str | None = None
    target_exam: str | None = None
    daily_goal: int | None = Field(None, ge=1, le=50)
    onboarded: bool | None = None


@router.put("/profile", response_model=StudentProfile)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the student's profile.
    Called by:
    - Onboarding final screen (sets level, exam_board, target_exam, daily_goal, onboarded=True)
    - Settings page (updates individual fields)
    """
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    return StudentProfile(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        level=current_user.level,
        exam_board=current_user.exam_board,
        target_exam=current_user.target_exam,
        daily_goal=current_user.daily_goal,
        onboarded=current_user.onboarded,
        is_guest=current_user.is_guest,
    )
