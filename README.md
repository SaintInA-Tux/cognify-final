# PhyPrep Backend — V1 MVP

> The AI Math Thinking Engine for JEE Aspirants

---

## What's built (V1 only)

| Feature | Code | Description |
|---|---|---|
| F1 — Problem Input | `routes/ask.py` | Text/LaTeX + Image (MathPix OCR) |
| F2 — Classification | `services/reasoning_service.py` | Subject, topic, subtopic, difficulty, pattern |
| F3 — Brain Mode | `services/reasoning_service.py` | Pattern → Method → Setup → First step. No answer. |
| F4 — SOS Mode | `services/solution_service.py` | Full annotated solution, deliberate friction |
| F5 — Hints | `services/hint_service.py` | 3-tier, sequentially gated, persisted |
| F6 — Mistake Detection | `services/math_verifier.py` | Step validation, error taxonomy, weakness feed |
| F7 — Dashboard | `routes/practice.py` | Red/Yellow/Green weakness map, recommendation |

**V1.5 and V2 features are intentionally not implemented.**

---

## Architecture

```
POST /v1/ask                    ← F1 input + F2 classify + F3 brain mode
POST /v1/ask/image              ← image → MathPix OCR → same pipeline
POST /v1/hints                  ← F5 sequential hints (needs attempt_id)
POST /v1/solution/sos           ← F4 full solution (needs attempt_id)
POST /v1/solution/check-step    ← F6 mistake detection (needs attempt_id)
GET  /v1/practice/dashboard/:id ← F7 weakness map
```

Every session is anchored to an `attempt_id`. The flow is always:

```
POST /ask → get attempt_id
    ↓
POST /hints (level 1, 2, 3 — sequential)
    ↓
POST /solution/check-step (submit your working step by step)
    ↓
POST /solution/sos (deliberate escalation — logs weakness)
    ↓
GET /practice/dashboard (see your weakness map)
```

---

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI + Uvicorn |
| Database | PostgreSQL + SQLAlchemy (async) |
| Cache | Redis |
| AI | DeepSeek R1 (`deepseek-reasoner`) |
| OCR | MathPix API |
| Validation | Pydantic v2 |
| Retry | Tenacity |

---

## Setup

```bash
# 1. Clone and install
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, DEEPSEEK_API_KEY

# 3. Run (tables auto-created on startup)
uvicorn app.main:app --reload --port 8000

# 4. Docs
open http://localhost:8000/docs
```

---

## Design Decisions

### Brain Mode never leaks the answer — structurally enforced

The Brain Mode prompt contains hard rules that forbid the answer. But prompts
can be ignored by LLMs. So there's a second layer: `generate_brain_mode()` in
`reasoning_service.py` always sets `answer_withheld=True` in the response object
regardless of what the LLM returns. The field exists as an explicit contract.

The evaluation script (`evaluate_model.py`) also checks heuristically for common
answer patterns in the output text.

### Classification is cached by problem hash

The same problem always maps to the same classification. Computing it twice wastes
tokens and money. `classify_problem()` hashes the problem text and caches the result
in Redis for 24 hours. Cache miss → LLM call → cache write.

### Hint gating is enforced server-side, not client-side

The client sends `requested_level`. The server checks the highest level already
unlocked for this `attempt_id` (from Redis, DB fallback). If the request skips a
level, it returns 400. This cannot be bypassed by a clever frontend.

### SOS Mode requires an existing attempt_id

You cannot call `/solution/sos` cold. You must have called `/ask` first. This enforces
the product flow: Brain Mode is the default, SOS is the deliberate escape. If the
attempt doesn't exist, the endpoint returns 404.

### Step submissions trigger weakness map updates

Every call to `/solution/check-step` updates the `WeaknessEntry` for that student+topic
in the same transaction. The weakness map is always fresh after any step submission.
Red/Yellow/Green thresholds: Green ≥ 75% accuracy + <20% SOS rate; Yellow 50–74%; Red <50%.

### DeepSeek R1 `<think>` block stripping

DeepSeek R1 (reasoner model) prepends its chain-of-thought in `<think>...</think>` tags
before the actual response. `response_parser.py` strips this block before JSON parsing.
This is documented in DeepSeek's API docs and is expected behaviour.

### Error handling

LLM calls can fail or return malformed JSON. Every service wraps `call_deepseek()` and
`parse_llm_response()` in try/except. Routes translate ValueError to 400/404 and
unexpected exceptions to 502 (upstream failure). The client always gets a structured
`{"detail": "..."}` JSON error, never a raw Python traceback.

---

## Running the evaluator

The evaluator tests the real LLM pipeline against known JEE problems. Requires
`DEEPSEEK_API_KEY` to be set.

```bash
python -m app.evaluation.evaluate_model
```

It checks:
- Classification accuracy (subject, topic, subtopic, difficulty)
- Brain Mode completeness (all 4 fields non-empty)
- Brain Mode answer leak detection (heuristic scan of output text)

---

## What's deliberately not here

- User authentication (add JWT middleware when needed)
- V1.5: AI-generated practice problems, daily challenge, solution comparison
- V2: Proactive agent, RAG pipeline, concept dependency graph, DPDP compliance
- Rate limiting (add slowapi or a reverse proxy rule)
- Alembic migrations (auto-create on startup is fine for dev; add migrations before prod)
