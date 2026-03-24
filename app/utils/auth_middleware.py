from datetime import datetime, timedelta, timezone
from typing import Annotated
import logging
import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.db import get_db
from app.database.models import Student, ProblemAttempt

settings = get_settings()
logger = logging.getLogger(__name__)

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    return encoded_jwt

async def get_current_user(
    auth: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: AsyncSession = Depends(get_db)
) -> Student:
    token = auth.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        logger.debug("JWT payload: %s", payload)
        student_id_val = payload.get("sub") or payload.get("student_id")
        logger.debug("student_id_val: %s", student_id_val)
        if student_id_val is None:
            logger.debug("student_id_val is None — rejecting token")
            raise credentials_exception
        try:
            target_uuid = uuid.UUID(str(student_id_val))
            logger.debug("target_uuid: %s", target_uuid)
        except ValueError as e:
            logger.debug("UUID parse error: %s", e)
            raise credentials_exception
    except jwt.InvalidTokenError as e:
        logger.debug("JWT decode error: %s", e)
        raise credentials_exception

    result = await db.execute(select(Student).where(Student.id == target_uuid))
    student = result.scalar_one_or_none()
    logger.debug("student found: %s", student)
    if student is None:
        logger.debug("student is None — rejecting token")
        raise credentials_exception
    return student

def assert_owns_attempt(attempt: ProblemAttempt, student: Student) -> None:
    """Check if the given attempt belongs to the authenticated student to prevent IDOR."""
    if attempt.student_id != student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource."
        )