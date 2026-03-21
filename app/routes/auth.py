import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import Student
from app.database.schemas import RegisterRequest, LoginResponse, StudentProfile
from app.utils.auth_middleware import create_access_token, get_current_user
from app.utils.rate_limiter import limiter
from fastapi import Request

router = APIRouter(prefix="/auth", tags=["Auth"])

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

@router.post("/register", response_model=LoginResponse)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    # Check if email is already registered
    result = await db.execute(select(Student).where(Student.email == body.email))
    existing_student = result.scalar_one_or_none()
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_pwd = get_password_hash(body.password)
    student = Student(
        email=body.email,
        name=body.name,
        password_hash=hashed_pwd,
        level=body.level,
        exam_board=body.exam_board,
        target_exam=body.target_exam
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    access_token = create_access_token(data={"sub": str(student.id)})
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        student_id=student.id
    )

@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
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
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        student_id=student.id
    )

@router.post("/guest", response_model=LoginResponse)
@limiter.limit("5/minute")
async def guest_login(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    guest_id = uuid.uuid4().hex[:8]
    email = f"guest_{guest_id}@cognify.local"
    hashed_pwd = get_password_hash(uuid.uuid4().hex)
    
    student = Student(
        email=email,
        name=f"Guest {guest_id}",
        password_hash=hashed_pwd,
        level="Class 12",
        exam_board="CBSE",
        target_exam="JEE Main"
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    access_token = create_access_token(data={"sub": str(student.id)})
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        student_id=student.id
    )

@router.get("/me", response_model=StudentProfile)
async def get_me(current_user: Student = Depends(get_current_user)):
    return StudentProfile(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        level=current_user.level,
        exam_board=current_user.exam_board,
        target_exam=current_user.target_exam
    )
