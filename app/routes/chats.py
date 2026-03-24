import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import ChatSession, ChatMessage, Student
from app.database.schemas import ChatSessionResponse, ChatMessageResponse
from app.utils.auth_middleware import get_current_user
from app.utils.rate_limiter import limiter


class CreateSessionRequest(BaseModel):
    title: str = Field(default="New Chat", max_length=255)


router = APIRouter(prefix="/chats", tags=["Chats"])

@router.get("", response_model=List[ChatSessionResponse])
@limiter.limit("60/minute")
async def list_sessions(
    request: Request,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.student_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        ChatSessionResponse(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in sessions
    ]

@router.post("", response_model=ChatSessionResponse)
@limiter.limit("20/minute")
async def create_session(
    request: Request,
    body: CreateSessionRequest = CreateSessionRequest(),  # BUG-16 FIX: accept title from body
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session = ChatSession(student_id=current_user.id, title=body.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at
    )

@router.get("/{session_id}/messages", response_model=List[ChatMessageResponse])
async def list_messages(
    session_id: uuid.UUID,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = msg_result.scalars().all()
    
    return [
        ChatMessageResponse(
            id=m.id,
            role=m.role,
            content=m.content,
            mode=m.mode,
            created_at=m.created_at
        )
        for m in messages
    ]

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    
    await db.delete(session)
    await db.commit()


class ChatRenameRequest(BaseModel):
    title: str

@router.patch("/{session_id}", response_model=ChatSessionResponse)
async def rename_session(
    session_id: uuid.UUID,
    request: ChatRenameRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    
    session.title = request.title
    await db.commit()
    await db.refresh(session)
    
    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at
    )
