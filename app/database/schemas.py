"""
Pydantic v2 schemas — strict typed contracts for all API inputs and outputs.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Shared enums
# ---------------------------------------------------------------------------

class Subject(str, Enum):
    MATHEMATICS = "Mathematics"
    PHYSICS = "Physics"
    CHEMISTRY = "Chemistry"
    UNKNOWN = "Unknown"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    JEE_ADVANCED = "jee_advanced"
    UNKNOWN = "Unknown"


class InputMethod(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    MATH_KEYBOARD = "math_keyboard"


class WeaknessStatus(str, Enum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"


class ErrorType(str, Enum):
    CONCEPTUAL = "conceptual"
    COMPUTATIONAL = "computational"
    METHOD_SELECTION = "method_selection"
    SIGN_ERROR = "sign_error"
    RULE_MISAPPLICATION = "rule_misapplication"
    ALGEBRAIC = "algebraic"


# ---------------------------------------------------------------------------
# Auth / Student
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    level: str | None = None
    exam_board: str | None = None
    target_exam: str | None = None
    target_year: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    student_id: uuid.UUID


class StudentProfile(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    level: str | None
    exam_board: str | None
    target_exam: str | None
    target_year: str | None
    daily_goal: int = 5          # NEW: needed by onboarding and settings
    streak: int = 0              # NEW: consecutive days solved
    onboarded: bool = False      # NEW: frontend checks this to decide whether to show onboarding
    is_guest: bool = False       # NEW: frontend may show "save your progress" nudge for guests


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    mode: str | None
    created_at: datetime


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# F2 — Problem Classification
# ---------------------------------------------------------------------------

class ClassificationResult(BaseModel):
    subject: Subject
    topic: str = Field(..., min_length=2, max_length=100)
    subtopic: str = Field(..., min_length=2, max_length=100)
    difficulty: Difficulty
    pattern: str = Field(..., min_length=2, max_length=255)
    formula: str | None = None
    definition: str | None = None
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("subject", mode="before")
    @classmethod
    def coerce_subject(cls, v: object) -> str:
        if isinstance(v, str):
            normalised = v.strip().title()
            for member in Subject:
                if member.value.lower() == normalised.lower():
                    return member.value
        return v

    @field_validator("difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: object) -> str:
        if isinstance(v, str):
            lowered = v.strip().lower()
            for member in Difficulty:
                if member.value.lower() == lowered:
                    return member.value
        return v


# ---------------------------------------------------------------------------
# F1 — Problem Input
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    student_id: uuid.UUID | None = None  # ignored — taken from auth context
    session_id: uuid.UUID | None = None
    problem: str = Field(..., min_length=3, max_length=4000)
    input_method: InputMethod = InputMethod.TEXT

    @field_validator("problem")
    @classmethod
    def strip_problem(cls, v: str) -> str:
        v = v.strip()
        # SEC-08 FIX: strip prompt boundary markers to prevent injection
        v = v.replace("<user_input>", "").replace("</user_input>", "")
        return v


class DirectAskRequest(BaseModel):
    student_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    problem: str = Field(..., min_length=3, max_length=4000)
    input_method: InputMethod = InputMethod.TEXT

    @field_validator("problem")
    @classmethod
    def strip_problem(cls, v: str) -> str:
        v = v.strip()
        # SEC-08 FIX: strip prompt boundary markers to prevent injection
        v = v.replace("<user_input>", "").replace("</user_input>", "")
        return v


class GeneralChatRequest(BaseModel):
    session_id: uuid.UUID | None = None
    message: str = Field(..., min_length=1, max_length=4000)


class GeneralChatResponse(BaseModel):
    content: str
    session_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# F3 — Brain Mode
# ---------------------------------------------------------------------------

class BrainModeResponse(BaseModel):
    attempt_id: uuid.UUID
    classification: ClassificationResult
    pattern: str
    method: str
    setup: str
    first_step: str
    variables: list[str] | None = Field(default=None)
    answer_withheld: bool = Field(default=True)


# ---------------------------------------------------------------------------
# F4 — SOS Mode
# ---------------------------------------------------------------------------

class SolutionStep(BaseModel):
    step_number: int
    expression: str
    explanation: str


class SOSModeResponse(BaseModel):
    attempt_id: uuid.UUID
    classification: ClassificationResult
    solution_steps: list[SolutionStep] = Field(...)
    final_answer: str
    key_concepts_used: list[str] = Field(...)
    post_sos_prompt: str = Field(
        default="You've seen the full solution. Now try a similar problem in Brain Mode?"
    )


# ---------------------------------------------------------------------------
# F5 — Progressive Hint System
# ---------------------------------------------------------------------------

class HintRequest(BaseModel):
    attempt_id: uuid.UUID
    requested_level: Annotated[int, Field(ge=1, le=3)]


class HintResponse(BaseModel):
    attempt_id: uuid.UUID
    hint_level: int
    hint_text: str
    is_final_hint: bool
    next_hint_available: bool


# ---------------------------------------------------------------------------
# F6 — Mistake Detection
# ---------------------------------------------------------------------------

class StepCheckRequest(BaseModel):
    attempt_id: uuid.UUID
    step_number: int = Field(..., ge=1)
    student_step: str = Field(..., min_length=1, max_length=2000)
    previous_steps: list[Annotated[str, Field(max_length=2000)]] = Field(
        default_factory=list, max_length=20
    )


class StepCheckResponse(BaseModel):
    attempt_id: uuid.UUID
    step_number: int
    is_correct: bool
    error_type: ErrorType | None = None
    explanation: str | None = None
    corrective_guidance: str | None = None
    correct_step: str | None = None


# ---------------------------------------------------------------------------
# F7 — Weakness Dashboard
# ---------------------------------------------------------------------------

class TopicWeakness(BaseModel):
    subject: Subject
    topic: str
    total_attempts: int
    accuracy_pct: int = Field(..., ge=0, le=100)
    hints_dependency_pct: int = Field(..., ge=0, le=100)
    sos_pct: int = Field(..., ge=0, le=100)
    status: WeaknessStatus
    last_attempted_at: datetime | None


class TrendPoint(BaseModel):
    label: str
    accuracy: int
    sos: int


class ErrorPoint(BaseModel):
    icon: str
    name: str
    sub: str
    count: int
    value: int


class SubjectAccuracy(BaseModel):
    subject: str
    accuracy: int
    status: WeaknessStatus


class WeaknessDashboardResponse(BaseModel):
    student_id: uuid.UUID
    generated_at: datetime = Field(default_factory=utcnow)
    
    # Overview Metrics
    total_problems: int = 0
    overall_accuracy: int = 0
    sos_rate: int = 0
    streak: int = 0
    
    # Topic Groups
    weakest_topics: list[TopicWeakness]
    improving_topics: list[TopicWeakness]
    strong_topics: list[TopicWeakness]
    
    # Performance Trend (last 7-30 days)
    performance_trend: list[TrendPoint] = []
    
    # Subject Breakdown
    subject_breakdown: list[SubjectAccuracy] = []
    
    # Error Taxonomy
    error_taxonomy: list[ErrorPoint] = []
    
    # SOS Heatmap (last 28 days)
    sos_heatmap: list[int] = []
    
    recommendation: str


# ---------------------------------------------------------------------------
# Daily Challenge
# ---------------------------------------------------------------------------

class ChallengeOption(BaseModel):
    key: str   # "A", "B", "C", "D"
    text: str


class ChallengeProblemResponse(BaseModel):
    challenge_date: str        # "2026-03-23"
    subject: str
    topic: str
    difficulty: str
    problem_text: str
    options: list[ChallengeOption]
    already_attempted: bool    # True if this student already submitted today


class ChallengeSubmitRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=1)  # "A", "B", "C", or "D"
    time_taken_seconds: int | None = None


class ChallengeSubmitResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str
    your_answer: str


# ---------------------------------------------------------------------------
# Shared error response
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
