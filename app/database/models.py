import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CHAR,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


# ---------------------------------------------------------------------------
# Cross-DB UUID type
# ---------------------------------------------------------------------------

class GUID(TypeDecorator):
    """Platform-independent UUID: PostgreSQL native UUID or SQLite CHAR(32)."""
    impl = CHAR(32)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(value)
        if isinstance(value, uuid.UUID):
            return value.hex
        return uuid.UUID(value).hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Student
# ---------------------------------------------------------------------------

class Student(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[str] = mapped_column(String(100), nullable=True)       # e.g. "Class 12"
    exam_board: Mapped[str] = mapped_column(String(100), nullable=True)  # ISC, CBSE
    target_exam: Mapped[str] = mapped_column(String(100), nullable=True) # JEE Main, JEE Advanced, NEET
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # NEW fields for prototype
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)     # False until onboarding complete
    daily_goal: Mapped[int] = mapped_column(Integer, default=5)         # problems per day
    streak: Mapped[int] = mapped_column(Integer, default=0)             # consecutive days solved

    sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="student", lazy="selectin"
    )


# ---------------------------------------------------------------------------
# Chat Session & Messages
# ---------------------------------------------------------------------------

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    student: Mapped["Student"] = relationship("Student", back_populates="sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", lazy="selectin", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chatmsg_session_id", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(Enum("user", "assistant", name="role_enum"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(50), nullable=True)  # brain, sos
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


# ---------------------------------------------------------------------------
# Problem Attempt
# ---------------------------------------------------------------------------

class ProblemAttempt(Base):
    __tablename__ = "problem_attempts"
    __table_args__ = (
        Index("ix_attempt_student_id", "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )

    problem_text: Mapped[str] = mapped_column(Text, nullable=False)
    input_method: Mapped[str] = mapped_column(
        Enum("text", "image", "math_keyboard", name="input_method_enum"), default="text"
    )

    subject: Mapped[str | None] = mapped_column(String(100))
    topic: Mapped[str | None] = mapped_column(String(100))
    subtopic: Mapped[str | None] = mapped_column(String(100))
    difficulty: Mapped[str | None] = mapped_column(
        Enum("easy", "medium", "hard", "jee_advanced", name="difficulty_enum")
    )
    pattern: Mapped[str | None] = mapped_column(String(255))

    mode_used: Mapped[str] = mapped_column(
        Enum("brain", "sos", name="mode_enum"), default="brain"
    )
    sos_used: Mapped[bool] = mapped_column(Boolean, default=False)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    mistake_logged: Mapped[bool] = mapped_column(Boolean, default=False)
    error_type: Mapped[str | None] = mapped_column(String(100))

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    hint_unlocks: Mapped[list["HintUnlock"]] = relationship(
        "HintUnlock", back_populates="attempt", lazy="selectin"
    )
    step_submissions: Mapped[list["StepSubmission"]] = relationship(
        "StepSubmission", back_populates="attempt", lazy="selectin"
    )


# ---------------------------------------------------------------------------
# Hint Unlock
# ---------------------------------------------------------------------------

class HintUnlock(Base):
    __tablename__ = "hint_unlocks"
    __table_args__ = (
        Index("ix_hintunlock_attempt_id", "attempt_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("problem_attempts.id", ondelete="CASCADE"), nullable=False
    )
    hint_level: Mapped[int] = mapped_column(Integer, nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    attempt: Mapped["ProblemAttempt"] = relationship("ProblemAttempt", back_populates="hint_unlocks")


# ---------------------------------------------------------------------------
# Step Submission
# ---------------------------------------------------------------------------

class StepSubmission(Base):
    __tablename__ = "step_submissions"
    __table_args__ = (
        Index("ix_stepsub_attempt_step", "attempt_id", "step_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("problem_attempts.id", ondelete="CASCADE"), nullable=False
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    student_step: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    error_type: Mapped[str | None] = mapped_column(String(100))
    error_explanation: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    attempt: Mapped["ProblemAttempt"] = relationship("ProblemAttempt", back_populates="step_submissions")


# ---------------------------------------------------------------------------
# Weakness Entry
# ---------------------------------------------------------------------------

class WeaknessEntry(Base):
    __tablename__ = "weakness_entries"
    __table_args__ = (
        UniqueConstraint("student_id", "topic", name="uq_weakness_student_topic"),
        Index("ix_weakness_student_topic", "student_id", "topic"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(100), nullable=False)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)

    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, default=0)
    total_hints_used: Mapped[int] = mapped_column(Integer, default=0)
    sos_count: Mapped[int] = mapped_column(Integer, default=0)

    accuracy_pct: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[str] = mapped_column(
        Enum("red", "yellow", "green", name="weakness_status_enum"), default="red"
    )

    last_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


# ---------------------------------------------------------------------------
# Daily Challenge Attempt — tracks who solved what
# ---------------------------------------------------------------------------

class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    challenge_date: Mapped[str] = mapped_column(String(10), nullable=False)  # "2026-03-23"
    answer_given: Mapped[str] = mapped_column(String(10), nullable=False)    # "A", "B", "C", "D"
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_taken_seconds: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
