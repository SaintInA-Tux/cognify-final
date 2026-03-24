"""
Daily Challenge Route

GET  /challenge/today   — returns today's problem (same for all users, seeded by date)
POST /challenge/submit  — submit answer, returns correct/wrong + explanation
"""

import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.database.models import ChallengeAttempt, Student
from app.database.schemas import (
    ChallengeProblemResponse,
    ChallengeOption,
    ChallengeSubmitRequest,
    ChallengeSubmitResponse,
)
from app.utils.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/challenge", tags=["Daily Challenge"])


# ---------------------------------------------------------------------------
# Problem bank — 30 hardcoded JEE problems for prototype
# In production: generate via LLM or pull from a proper question bank
# ---------------------------------------------------------------------------

PROBLEM_BANK = [
    {
        "subject": "Mathematics",
        "topic": "Integration",
        "difficulty": "hard",
        "problem_text": r"Evaluate $\int_0^{\pi/2} \frac{\sin x}{\sin x + \cos x}\,dx$",
        "options": [
            {"key": "A", "text": r"$0$"},
            {"key": "B", "text": r"$\frac{\pi}{4}$"},
            {"key": "C", "text": r"$\frac{\pi}{2}$"},
            {"key": "D", "text": r"$1$"},
        ],
        "correct": "B",
        "explanation": r"Using the property $\int_0^a f(x)\,dx = \int_0^a f(a-x)\,dx$, let $I = \int_0^{\pi/2} \frac{\sin x}{\sin x + \cos x}\,dx$. Then $I = \int_0^{\pi/2} \frac{\cos x}{\cos x + \sin x}\,dx$. Adding: $2I = \int_0^{\pi/2} 1\,dx = \frac{\pi}{2}$, so $I = \frac{\pi}{4}$.",
    },
    {
        "subject": "Mathematics",
        "topic": "Limits",
        "difficulty": "medium",
        "problem_text": r"Find $\lim_{x \to 0} \frac{e^x - 1 - x}{x^2}$",
        "options": [
            {"key": "A", "text": r"$0$"},
            {"key": "B", "text": r"$1$"},
            {"key": "C", "text": r"$\frac{1}{2}$"},
            {"key": "D", "text": r"$\infty$"},
        ],
        "correct": "C",
        "explanation": r"Using L'Hôpital twice (0/0 form): first derivative gives $\frac{e^x - 1}{2x}$, still 0/0. Second derivative gives $\frac{e^x}{2}$. At $x=0$: $\frac{1}{2}$.",
    },
    {
        "subject": "Mathematics",
        "topic": "Quadratic Equations",
        "difficulty": "medium",
        "problem_text": r"If $\alpha, \beta$ are roots of $x^2 - px + q = 0$, find $\alpha^2 + \beta^2$.",
        "options": [
            {"key": "A", "text": r"$p^2 - q$"},
            {"key": "B", "text": r"$p^2 - 2q$"},
            {"key": "C", "text": r"$p^2 + 2q$"},
            {"key": "D", "text": r"$p^2 + q$"},
        ],
        "correct": "B",
        "explanation": r"By Vieta's: $\alpha + \beta = p$, $\alpha\beta = q$. Then $\alpha^2 + \beta^2 = (\alpha+\beta)^2 - 2\alpha\beta = p^2 - 2q$.",
    },
    {
        "subject": "Physics",
        "topic": "Kinematics",
        "difficulty": "medium",
        "problem_text": r"A particle moves with $v = 3t^2 - 6t$. Find displacement from $t=0$ to $t=3$s.",
        "options": [
            {"key": "A", "text": r"$9$ m"},
            {"key": "B", "text": r"$0$ m"},
            {"key": "C", "text": r"$27$ m"},
            {"key": "D", "text": r"$-4$ m"},
        ],
        "correct": "B",
        "explanation": r"$s = \int_0^3 (3t^2 - 6t)\,dt = [t^3 - 3t^2]_0^3 = (27 - 27) - 0 = 0$ m. The particle reverses direction at $t=2$s, but net displacement is 0.",
    },
    {
        "subject": "Mathematics",
        "topic": "Trigonometry",
        "difficulty": "medium",
        "problem_text": r"Find the general solution of $\sin\theta + \cos\theta = \sqrt{2}$",
        "options": [
            {"key": "A", "text": r"$\theta = n\pi$"},
            {"key": "B", "text": r"$\theta = 2n\pi + \frac{\pi}{4}$"},
            {"key": "C", "text": r"$\theta = n\pi + \frac{\pi}{4}$"},
            {"key": "D", "text": r"$\theta = 2n\pi$"},
        ],
        "correct": "B",
        "explanation": r"Write as $\sqrt{2}\sin(\theta + \pi/4) = \sqrt{2}$, so $\sin(\theta + \pi/4) = 1$. General solution: $\theta + \pi/4 = \pi/2 + 2n\pi$, giving $\theta = \pi/4 + 2n\pi = 2n\pi + \pi/4$.",
    },
    {
        "subject": "Mathematics",
        "topic": "Matrices",
        "difficulty": "medium",
        "problem_text": r"If $A = \begin{pmatrix}1 & 2\\3 & 4\end{pmatrix}$, find $\det(A^2 - 5A)$.",
        "options": [
            {"key": "A", "text": r"$0$"},
            {"key": "B", "text": r"$2$"},
            {"key": "C", "text": r"$-2$"},
            {"key": "D", "text": r"$4$"},
        ],
        "correct": "D",
        "explanation": r"By Cayley-Hamilton, the characteristic polynomial of $A$ is $\lambda^2 - 5\lambda - 2 = 0$, so $A^2 - 5A = 2I$. Thus $\det(A^2-5A) = \det(2I) = 2^2 = 4$.",
    },
    {
        "subject": "Chemistry",
        "topic": "Thermodynamics",
        "difficulty": "medium",
        "problem_text": r"For a spontaneous process at constant $T$ and $P$, which condition must hold?",
        "options": [
            {"key": "A", "text": r"$\Delta G > 0$"},
            {"key": "B", "text": r"$\Delta G < 0$"},
            {"key": "C", "text": r"$\Delta G = 0$"},
            {"key": "D", "text": r"$\Delta H < 0$ only"},
        ],
        "correct": "B",
        "explanation": r"At constant T and P, spontaneity is governed by Gibbs free energy: $\Delta G = \Delta H - T\Delta S < 0$ for spontaneous processes. $\Delta G = 0$ at equilibrium; $\Delta G > 0$ is non-spontaneous.",
    },
    {
        "subject": "Physics",
        "topic": "Laws of Motion",
        "difficulty": "easy",
        "problem_text": r"A 5 kg block on a frictionless surface is pushed by a 20 N force. Find acceleration.",
        "options": [
            {"key": "A", "text": r"$2\text{ m/s}^2$"},
            {"key": "B", "text": r"$4\text{ m/s}^2$"},
            {"key": "C", "text": r"$100\text{ m/s}^2$"},
            {"key": "D", "text": r"$0.25\text{ m/s}^2$"},
        ],
        "correct": "B",
        "explanation": r"Newton's second law: $a = F/m = 20/5 = 4\text{ m/s}^2$.",
    },
    {
        "subject": "Mathematics",
        "topic": "Probability",
        "difficulty": "medium",
        "problem_text": r"Two cards drawn without replacement from a deck of 52. P(both aces)?",
        "options": [
            {"key": "A", "text": r"$\frac{1}{221}$"},
            {"key": "B", "text": r"$\frac{1}{169}$"},
            {"key": "C", "text": r"$\frac{4}{52}$"},
            {"key": "D", "text": r"$\frac{1}{13}$"},
        ],
        "correct": "A",
        "explanation": r"$P = \frac{4}{52} \times \frac{3}{51} = \frac{12}{2652} = \frac{1}{221}$.",
    },
    {
        "subject": "Mathematics",
        "topic": "Coordinate Geometry",
        "difficulty": "medium",
        "problem_text": r"Find the distance from point $(3, 4)$ to line $3x - 4y + 5 = 0$.",
        "options": [
            {"key": "A", "text": r"$0$"},
            {"key": "B", "text": r"$\frac{6}{5}$"},
            {"key": "C", "text": r"$5$"},
            {"key": "D", "text": r"$\frac{2}{5}$"},
        ],
        "correct": "D",
        "explanation": r"Distance $= \frac{|3(3) - 4(4) + 5|}{\sqrt{9+16}} = \frac{|9-16+5|}{5} = \frac{|-2|}{5} = \frac{2}{5}$.",
    },
]


def _get_today_problem() -> dict:
    """Return today's problem, cycling through the bank by day of year."""
    today = date.today()
    day_index = today.timetuple().tm_yday % len(PROBLEM_BANK)
    return PROBLEM_BANK[day_index]


# ---------------------------------------------------------------------------
# GET /challenge/today
# ---------------------------------------------------------------------------

@router.get("/today", response_model=ChallengeProblemResponse)
async def get_today_challenge(
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return today's challenge problem. Same problem for all users on the same day."""
    today_str = date.today().isoformat()
    problem = _get_today_problem()

    # Check if student already attempted today
    result = await db.execute(
        select(ChallengeAttempt).where(
            ChallengeAttempt.student_id == current_user.id,
            ChallengeAttempt.challenge_date == today_str,
        )
    )
    existing = result.scalar_one_or_none()

    return ChallengeProblemResponse(
        challenge_date=today_str,
        subject=problem["subject"],
        topic=problem["topic"],
        difficulty=problem["difficulty"],
        problem_text=problem["problem_text"],
        options=[ChallengeOption(**o) for o in problem["options"]],
        already_attempted=existing is not None,
    )


# ---------------------------------------------------------------------------
# POST /challenge/submit
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=ChallengeSubmitResponse)
async def submit_challenge(
    body: ChallengeSubmitRequest,
    current_user: Student = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit answer for today's challenge. Each student can only submit once per day."""
    today_str = date.today().isoformat()
    problem = _get_today_problem()

    # Prevent re-submission
    result = await db.execute(
        select(ChallengeAttempt).where(
            ChallengeAttempt.student_id == current_user.id,
            ChallengeAttempt.challenge_date == today_str,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already submitted today's challenge.",
        )

    answer = body.answer.upper().strip()
    if answer not in ["A", "B", "C", "D"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Answer must be A, B, C, or D.",
        )

    is_correct = answer == problem["correct"]

    # Persist the attempt
    attempt = ChallengeAttempt(
        student_id=current_user.id,
        challenge_date=today_str,
        answer_given=answer,
        is_correct=is_correct,
        time_taken_seconds=body.time_taken_seconds,
    )
    db.add(attempt)

    # Update streak if correct
    if is_correct:
        # Get yesterday's date
        from datetime import timedelta
        yesterday_str = (date.today() - timedelta(days=1)).isoformat()
        
        # Check if they solved yesterday
        result_y = await db.execute(
            select(ChallengeAttempt).where(
                ChallengeAttempt.student_id == current_user.id,
                ChallengeAttempt.challenge_date == yesterday_str,
                ChallengeAttempt.is_correct == True
            )
        )
        yesterday_solved = result_y.scalar_one_or_none()
        
        if yesterday_solved:
            current_user.streak += 1
        else:
            # Check if they already have a streak and if it should be reset or started
            # Since they haven't solved today yet (this is the first attempt), 
            # if they didn't solve yesterday, the streak starts at 1 today.
            current_user.streak = 1
    
    await db.commit()

    return ChallengeSubmitResponse(
        is_correct=is_correct,
        correct_answer=problem["correct"],
        explanation=problem["explanation"],
        your_answer=answer,
    )
