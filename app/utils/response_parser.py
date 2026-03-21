"""
Response Parser — validates and coerces raw LLM text into typed Pydantic models.

DeepSeek R1 (reasoner) wraps its answer in <think>...</think> tags before the
actual JSON. This module strips that block before parsing.

Two entry points:
  parse_llm_response()         — generic, used by classification, hints, SOS, step-check
  parse_brain_mode_response()  — Brain Mode only; rejects any JSON containing
                                  forbidden solution fields before Pydantic validation
"""

import json
import logging
import re
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Fields that must NEVER appear in a Brain Mode response.
# If the LLM includes any of these, the response is rejected immediately.
_BRAIN_MODE_FORBIDDEN_FIELDS = {
    "final_answer",
    "solution_steps",
    "answer",
    "result",
    "derivation",
}


def strip_reasoning_block(raw: str) -> str:
    """
    DeepSeek R1 emits <think>...</think> before the answer.
    Strip it so only the JSON payload remains.

    Also handles:
    - Unclosed <think> tags (model cut off mid-reasoning)
    - Partial </think> leakage before the JSON
    - Any leading/trailing non-JSON prose
    """
    # Remove complete <think>...</think> blocks (possibly multi-line)
    cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)

    # Remove unclosed <think> block that runs to end of string
    cleaned = re.sub(r"<think>.*$", "", cleaned, flags=re.DOTALL)

    # Remove any stray closing </think> tags
    cleaned = re.sub(r"</think>", "", cleaned)

    return cleaned.strip()


def extract_json(text: str) -> str:
    """
    Extract the first complete JSON object from text.
    Handles cases where the model wraps output in ```json ... ``` fences
    despite being explicitly told not to.
    """
    # Remove fences
    text = re.sub(r"```(?:json)?", "", text).strip()
    text = text.rstrip("`").strip()

    # Find outermost braces
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in LLM response. Raw: {text[:200]}")

    depth = 0
    for i, char in enumerate(text[start:], start=start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    raise ValueError(f"Malformed JSON in LLM response. Raw: {text[:200]}")


def parse_llm_response(raw: str, model_class: type[T]) -> T:
    """
    Generic pipeline: strip reasoning → extract JSON → validate with Pydantic.
    Used for: classification, hints, SOS mode, step validation.
    Raises ValueError with a clear message on failure.
    """
    try:
        cleaned = strip_reasoning_block(raw)
        json_str = extract_json(cleaned)
        data: dict[str, Any] = json.loads(json_str)
        return model_class.model_validate(data)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("JSON parse error. Raw response: %s", raw[:500])
        raise ValueError(f"LLM returned unparseable JSON: {exc}") from exc
    except ValidationError as exc:
        logger.error("Schema validation error. Raw response: %s", raw[:500])
        raise ValueError(f"LLM response failed schema validation: {exc}") from exc


def parse_brain_mode_response(raw: str, model_class: type[T]) -> T:
    """
    Brain Mode-specific pipeline. Identical to parse_llm_response() but with
    an extra guard step: if the parsed JSON contains any forbidden solution
    field, the response is rejected before Pydantic ever sees it.

    Forbidden fields: final_answer, solution_steps, answer, result, derivation.

    This is a second line of defence — the prompt already forbids these fields.
    We reject here so that a misbehaving LLM cannot leak solution content through
    Brain Mode regardless of prompt compliance.
    """
    try:
        cleaned = strip_reasoning_block(raw)
        json_str = extract_json(cleaned)
        data: dict[str, Any] = json.loads(json_str)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Brain Mode JSON parse error. Raw response: %s", raw[:500])
        raise ValueError(f"Brain Mode LLM returned unparseable JSON: {exc}") from exc

    # --- Forbidden field guard ---
    found_forbidden = _BRAIN_MODE_FORBIDDEN_FIELDS.intersection(data.keys())
    if found_forbidden:
        logger.error(
            "Brain Mode response contained forbidden solution fields: %s. Raw: %s",
            found_forbidden,
            raw[:500],
        )
        raise ValueError(
            f"Brain Mode response rejected: contains forbidden fields {found_forbidden}. "
            "The LLM leaked solution content into a Brain Mode response."
        )

    try:
        return model_class.model_validate(data)
    except ValidationError as exc:
        logger.error("Brain Mode schema validation error. Raw response: %s", raw[:500])
        raise ValueError(f"Brain Mode response failed schema validation: {exc}") from exc
