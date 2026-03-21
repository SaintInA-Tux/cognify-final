/**
 * Cognify API Layer
 *
 * Communicates with the FastAPI backend at /v1/*.
 * In development, requests to /api are proxied to localhost:8000 by Vite.
 */

// ── Types matching backend Pydantic schemas ────────────────────────────

export interface ClassificationResult {
  subject: "Mathematics" | "Physics" | "Chemistry";
  topic: string;
  subtopic: string;
  difficulty: "easy" | "medium" | "hard" | "jee_advanced";
  pattern: string;
  confidence: number;
}

export interface BrainModeResponse {
  attempt_id: string;
  classification: ClassificationResult;
  pattern: string;
  method: string;
  setup: string;
  first_step: string;
  answer_withheld: boolean;
}

export interface StepCheckResponse {
  attempt_id: string;
  step_number: number;
  is_correct: boolean;
  error_type: string | null;
  explanation: string | null;
  corrective_guidance: string | null;
  correct_step: string | null;
}

export interface HintResponse {
  attempt_id: string;
  hint_level: number;
  hint_text: string;
  is_final_hint: boolean;
  next_hint_available: boolean;
}

export interface DashboardResponse {
  student_id: string;
  generated_at: string;
  weakest_topics: TopicWeakness[];
  improving_topics: TopicWeakness[];
  strong_topics: TopicWeakness[];
  recommendation: string;
}

export interface TopicWeakness {
  subject: string;
  topic: string;
  total_attempts: number;
  accuracy_pct: number;
  hints_dependency_pct: number;
  sos_pct: number;
  status: "red" | "yellow" | "green";
  last_attempted_at: string | null;
}

export interface StudentProfile {
  id: string;
  email: string;
  name: string;
  level: string | null;
  exam_board: string | null;
  target_exam: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  student_id: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ── Config ──────────────────────────────────────────────────────────────

// In dev, Vite proxy rewrites /api → http://localhost:8000
// In production, we point directly to the live Render backend!
const BASE_URL = import.meta.env.DEV ? "/api/v1" : "https://cognify-api-56et.onrender.com/v1";

// Fixed test student UUID — replace with real auth later
const TEST_STUDENT_ID = "00000000-0000-4000-8000-000000000001";

// ── Helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cognify_token');
  const headers: HeadersInit = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('cognify_token');
    window.dispatchEvent(new Event('auth-token-expired'));
    // Do not throw an error here, wait for the app to redirect.
  }

  if (!response.ok) {
    let errMessage = 'Network response was not ok';
    try {
      const errBody = await response.json();
      errMessage = errBody.detail || errMessage;
    } catch (e) { }
    throw new Error(errMessage);
  }
  return response.json() as Promise<T>;
}

// ── Endpoints ───────────────────────────────────────────────────────────

/**
 * POST /v1/ask — Submit a text problem.
 * Returns BrainModeResponse.
 */
export async function askQuestion(problem: string, session_id?: string, signal?: AbortSignal): Promise<BrainModeResponse> {
  return await apiFetch<BrainModeResponse>(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problem,
      session_id: session_id || null,
      input_method: "text"
    }),
    signal,
  });
}

/**
 * POST /v1/ask/direct — Quick solve, returns SOSModeResponse.
 */
export async function askDirect(problem: string, session_id?: string, signal?: AbortSignal): Promise<any> {
  return await apiFetch<any>(`${BASE_URL}/ask/direct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problem,
      session_id: session_id || null,
    }),
    signal,
  });
}

export async function checkStep(
  attemptId: string,
  stepNumber: number,
  studentStep: string,
  previousSteps: string[]
): Promise<StepCheckResponse> {
  return await apiFetch<StepCheckResponse>(`${BASE_URL}/solution/check-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attempt_id: attemptId,
      step_number: stepNumber,
      student_step: studentStep,
      previous_steps: previousSteps,
    }),
  });
}

/**
 * POST /v1/solution/sos — Request final solution for an active attempt.
 */
export async function getSos(attemptId: string): Promise<any> {
  return await apiFetch<any>(`${BASE_URL}/solution/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attempt_id: attemptId
    }),
  });
}

/**
 * POST /v1/hints — Request the next progressive hint.
 */
export async function getHints(
  attemptId: string,
  requestedLevel: number = 1,
): Promise<HintResponse> {
  try {
    return await apiFetch<HintResponse>(`${BASE_URL}/hints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attempt_id: attemptId,
        requested_level: requestedLevel,
      }),
    });
  } catch (error) {
    console.warn("Hints endpoint error:", error);
    return {
      attempt_id: attemptId,
      hint_level: requestedLevel,
      hint_text: "Hint unavailable — backend may be offline.",
      is_final_hint: false,
      next_hint_available: true,
    };
  }
}

/**
 * GET /v1/practice/dashboard/{student_id} — Weakness dashboard.
 */
export async function getDashboard(
  studentId: string = TEST_STUDENT_ID,
): Promise<DashboardResponse> {
  try {
    return await apiFetch<DashboardResponse>(
      `${BASE_URL}/practice/dashboard/${studentId}`,
    );
  } catch (error) {
    console.warn("Dashboard endpoint error:", error);
    return {
      student_id: studentId,
      generated_at: new Date().toISOString(),
      weakest_topics: [],
      improving_topics: [],
      strong_topics: [],
      recommendation: "Dashboard unavailable — backend may be offline.",
    };
  }
}

// ── Auth Endpoints ──────────────────────────────────────────────────────

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);
  
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed: ${body}`);
  }
  return res.json() as Promise<LoginResponse>;
}

export async function registerUser(
  email: string, 
  password: string, 
  name: string,
  level?: string,
  examBoard?: string,
  targetExam?: string
): Promise<LoginResponse> {
  return await apiFetch<LoginResponse>(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name,
      level: level || null,
      exam_board: examBoard || null,
      target_exam: targetExam || null,
    }),
  });
}

export async function loginGuest(): Promise<LoginResponse> {
  return await apiFetch<LoginResponse>(`${BASE_URL}/auth/guest`, {
    method: "POST",
  });
}

export async function getMe(): Promise<StudentProfile> {
  return await apiFetch<StudentProfile>(`${BASE_URL}/auth/me`, {
    method: "GET",
  });
}

// ── Chat Endpoints ──────────────────────────────────────────────────────

export async function getChats(): Promise<ChatSession[]> {
  return await apiFetch<ChatSession[]>(`${BASE_URL}/chats`, {
    method: "GET",
  });
}

export async function createChat(title: string): Promise<ChatSession> {
  return await apiFetch<ChatSession>(`${BASE_URL}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiFetch<void>(`${BASE_URL}/chats/${chatId}`, {
    method: "DELETE",
  });
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  return await apiFetch<ChatMessage[]>(`${BASE_URL}/chats/${chatId}/messages`, {
    method: "GET",
  });
}
