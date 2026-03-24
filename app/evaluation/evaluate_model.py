"""
Model Evaluation — sanity-test the AI pipeline with known JEE problems.

Run with:  python -m app.evaluation.evaluate_model

Tests each V1 feature in sequence with a fixed problem set and prints
pass/fail for each assertion. Not a unit test framework — it exercises
the real LLM and real prompt templates.

Use this to:
  - Validate a prompt change before deploying
  - Confirm Brain Mode never leaks the answer
  - Check classification accuracy on known problems
"""

import asyncio
import json
import sys

from app.services.reasoning_service import classify_problem, generate_brain_mode
from app.database.schemas import Difficulty, Subject

import uuid

# ---------------------------------------------------------------------------
# Test cases — known JEE problems with expected classifications
# ---------------------------------------------------------------------------

TEST_CASES = [
    {
        "problem": r"\int x^2 e^x dx",
        "expected_subject": Subject.MATHEMATICS,
        "expected_topic_contains": "Calculus",
        "expected_subtopic_contains": "Integration",
        "expected_difficulty": [Difficulty.MEDIUM, Difficulty.HARD],
    },
    {
        "problem": r"\frac{d}{dx}[\sin(x^2)]",
        "expected_subject": Subject.MATHEMATICS,
        "expected_topic_contains": "Calculus",
        "expected_subtopic_contains": "Chain Rule",
        "expected_difficulty": [Difficulty.EASY, Difficulty.MEDIUM],
    },
    {
        "problem": r"\lim_{x \to 2} \frac{x^2 - 4}{x - 2}",
        "expected_subject": Subject.MATHEMATICS,
        "expected_topic_contains": "Calculus",
        "expected_subtopic_contains": "Limit",
        "expected_difficulty": [Difficulty.EASY, Difficulty.MEDIUM],
    },
]

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []


def check(label: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    print(f"  [{status}] {label}" + (f" — {detail}" if detail else ""))
    results.append(condition)


async def run_evaluation() -> None:
    print("\n=== PhyPrep V1 Model Evaluation ===\n")

    for i, tc in enumerate(TEST_CASES, 1):
        problem = tc["problem"]
        print(f"Problem {i}: {problem}")

        # --- F2: Classification ---
        print("  F2 Classification")
        try:
            classification = await classify_problem(problem)
            check(
                "Subject correct",
                classification.subject == tc["expected_subject"],
                f"got {classification.subject}",
            )
            check(
                "Topic contains expected keyword",
                tc["expected_topic_contains"].lower() in classification.topic.lower(),
                f"got '{classification.topic}'",
            )
            check(
                "Subtopic contains expected keyword",
                tc["expected_subtopic_contains"].lower() in classification.subtopic.lower(),
                f"got '{classification.subtopic}'",
            )
            check(
                "Difficulty in acceptable range",
                classification.difficulty in tc["expected_difficulty"],
                f"got {classification.difficulty}",
            )
            check("Confidence > 0.5", classification.confidence > 0.5, f"got {classification.confidence}")
        except Exception as exc:
            check("Classification succeeded", False, str(exc))
            print("  Skipping Brain Mode test due to classification failure.\n")
            continue

        # --- F3: Brain Mode — critical: must NOT contain answer ---
        print("  F3 Brain Mode")
        fake_attempt_id = uuid.uuid4()
        try:
            brain = await generate_brain_mode(problem, classification, fake_attempt_id)
            check("answer_withheld is True", brain.answer_withheld is True)
            check("pattern non-empty", len(brain.pattern) > 10)
            check("method non-empty", len(brain.method) > 10)
            check("setup non-empty", len(brain.setup) > 10)
            check("first_step non-empty", len(brain.first_step) > 10)

            # Heuristic: final answer should not appear in brain mode output
            full_text = (
                brain.pattern
                + brain.method
                + brain.setup
                + brain.first_step
            ).lower()
            # These phrases suggest a completed solution was leaked
            leak_signals = ["= xe^x - e^x", "= 2x·cos", "= 4", "final answer", "therefore the answer is"]
            leaked = any(sig in full_text for sig in leak_signals)
            check("No answer leaked in Brain Mode output", not leaked, "checked for common answer patterns")

        except Exception as exc:
            check("Brain Mode succeeded", False, str(exc))

        print()

    # Summary
    total = len(results)
    passed = sum(results)
    print(f"\n=== Results: {passed}/{total} checks passed ===")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    asyncio.run(run_evaluation())
