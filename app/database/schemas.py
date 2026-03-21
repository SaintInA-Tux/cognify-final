"""
Pydantic v2 schemas — strict typed contracts for all API inputs and outputs.
All AI responses are validated against these before being returned to clients.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator


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
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("subject", mode="before")
    @classmethod
    def coerce_subject(cls, v: object) -> str:
        """Accept any case variant the LLM returns, e.g. 'mathematics' → 'Mathematics'."""
        if isinstance(v, str):
            normalised = v.strip().title()  # 'mathematics' → 'Mathematics'
            for member in Subject:
                if member.value.lower() == normalised.lower():
                    return member.value
        return v  # let Pydantic raise a clean error if still unrecognised

    @field_validator("difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: object) -> str:
        """Accept any case variant the LLM returns, e.g. 'Easy' → 'easy'."""
        if isinstance(v, str):
            lowered = v.strip().lower()
            for member in Difficulty:
                if member.value.lower() == lowered:
                    return member.value
        return v  # let Pydantic raise a clean error if still unrecognised


# ---------------------------------------------------------------------------
# F1 — Problem Input
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    # student_id is now taken from auth context, not the body, but keeping it optional for fallback/validation
    student_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    problem: str = Field(..., min_length=3, max_length=4000)
    input_method: InputMethod = InputMethod.TEXT

class DirectAskRequest(BaseModel):
    student_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    problem: str = Field(..., min_length=3, max_length=4000)
    input_method: InputMethod = InputMethod.TEXT

    @field_validator("problem")
    @classmethod
    def strip_problem(cls, v: str) -> str:
        return v.strip()


# ---------------------------------------------------------------------------
# F3 — Brain Mode
# Fields match spec exactly: pattern, method, setup, first_step.
# final_answer is intentionally absent — Brain Mode never carries it.
# ---------------------------------------------------------------------------

class BrainModeResponse(BaseModel):
    attempt_id: uuid.UUID
    classification: ClassificationResult

    pattern: str = Field(
        ...,
        description="What type of structure this problem has and what makes it recognisable",
    )
    method: str = Field(
        ...,
        description="Which method applies AND why — including why alternatives are rejected",
    )
    setup: str = Field(
        ...,
        description="How to set up the problem before any calculation — what to write first",
    )
    first_step: str = Field(
        ...,
        description="The single specific first operation the student should perform",
    )

    # Explicit contract: Brain Mode never contains an answer.
    # This field is always True — its presence makes the contract visible in the API schema.
    answer_withheld: bool = Field(
        default=True,
        description="Always True — Brain Mode never reveals the answer",
    )


# ---------------------------------------------------------------------------
# F4 — SOS Mode
# ---------------------------------------------------------------------------

class SolutionStep(BaseModel):
    step_number: int
    expression: str = Field(..., description="The mathematical expression or operation")
    explanation: str = Field(..., description="Plain English reasoning for this step")


class SOSModeResponse(BaseModel):
    attempt_id: uuid.UUID
    classification: ClassificationResult
    solution_steps: list[SolutionStep] = Field(..., min_length=1)
    final_answer: str
    key_concepts_used: list[str] = Field(..., min_length=1)
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
    previous_steps: list[Annotated[str, Field(max_length=2000)]] = Field(default_factory=list, max_length=20)


class StepCheckResponse(BaseModel):
    attempt_id: uuid.UUID
    step_number: int
    is_correct: bool
    error_type: ErrorType | None = None
    explanation: str | None = None          # what went wrong and why (null if correct)
    corrective_guidance: str | None = None  # nudge toward fix without giving answer
    correct_step: str | None = Field(
        default=None,
        description="Only provided after 2 consecutive wrong attempts on the same step",
    )


# ---------------------------------------------------------------------------
# F7 — Weakness Dashboard
# ---------------------------------------------------------------------------

class TopicWeakness(BaseModel):
    subject: Subject
    topic: str
    total_attempts: int
    accuracy_pct: int = Field(..., ge=0, le=100)
    hints_dependency_pct: int = Field(
        ..., ge=0, le=100,
        description="Percentage of attempts where hints were needed"
    )
    sos_pct: int = Field(
        ..., ge=0, le=100,
        description="Percentage of attempts that ended in SOS"
    )
    status: WeaknessStatus
    last_attempted_at: datetime | None


class WeaknessDashboardResponse(BaseModel):
    student_id: uuid.UUID
    generated_at: datetime
    weakest_topics: list[TopicWeakness]  # sorted by accuracy_pct asc
    improving_topics: list[TopicWeakness]
    strong_topics: list[TopicWeakness]
    recommendation: str


# ---------------------------------------------------------------------------
# Shared error response
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
