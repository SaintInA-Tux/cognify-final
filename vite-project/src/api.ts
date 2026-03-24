/**
 * PhyPrep API Layer
 * All backend communication goes through this file.
 */

// ── Types ────────────────────────────────────────────────────────────────

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
  daily_goal: number;       // NEW
  streak: number;           // NEW: consecutive days solved
  onboarded: boolean;       // NEW — frontend uses this to decide whether to show onboarding
  is_guest: boolean;        // NEW
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
  role: "user" | "assistant";
  content: string;
  mode: string | null;
  created_at: string;
}

export interface ChallengeOption {
  key: string;
  text: string;
}

export interface ChallengeProblemResponse {
  challenge_date: string;
  subject: string;
  topic: string;
  difficulty: string;
  problem_text: string;
  options: ChallengeOption[];
  already_attempted: boolean;
}

export interface ChallengeSubmitResponse {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  your_answer: string;
}

// ── Config ────────────────────────────────────────────────────────────────

// FIX: use env var so dev hits localhost, production hits Render
// In .env.local: VITE_API_URL=http://localhost:8000/v1
// In Vercel dashboard: VITE_API_URL=https://phyprep-api-56et.onrender.com/v1
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/v1";

// ── Core fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("phyprep_token");

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("phyprep_token");
    localStorage.removeItem("phyprep_student_id");
    window.dispatchEvent(new Event("auth-token-expired"));
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    let errMessage = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      errMessage = body.detail || errMessage;
    } catch {
      // response wasn't JSON — keep the default message
    }
    throw new Error(errMessage);
  }

  return response.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function loginGuest(): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>(`${BASE_URL}/auth/guest`, {
    method: "POST",
  });
  // Store token immediately after any auth call
  localStorage.setItem("phyprep_token", res.access_token);
  localStorage.setItem("phyprep_student_id", res.student_id);
  return res;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  level?: string,
  examBoard?: string,
  targetExam?: string
): Promise<LoginResponse> {
  const res = await apiFetch<LoginResponse>(`${BASE_URL}/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      name,
      level: level || null,
      exam_board: examBoard || null,
      target_exam: targetExam || null,
    }),
  });
  localStorage.setItem("phyprep_token", res.access_token);
  localStorage.setItem("phyprep_student_id", res.student_id);
  return res;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  // Login uses form-encoded body (OAuth2PasswordRequestForm on backend)
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    let errMessage = "Login failed";
    try {
      const body = await response.json();
      errMessage = body.detail || errMessage;
    } catch { /* ignore */ }
    throw new Error(errMessage);
  }

  const res = (await response.json()) as LoginResponse;
  localStorage.setItem("phyprep_token", res.access_token);
  localStorage.setItem("phyprep_student_id", res.student_id);
  return res;
}

export function logout(): void {
  localStorage.removeItem("phyprep_token");
  localStorage.removeItem("phyprep_student_id");
}

export function getStoredToken(): string | null {
  return localStorage.getItem("phyprep_token");
}

export function getStoredStudentId(): string | null {
  return localStorage.getItem("phyprep_student_id");
}

export async function getMe(): Promise<StudentProfile> {
  return apiFetch<StudentProfile>(`${BASE_URL}/auth/me`);
}

export async function updateProfile(data: {
  name?: string;
  level?: string;
  exam_board?: string;
  target_exam?: string;
  daily_goal?: number;
  onboarded?: boolean;
}): Promise<StudentProfile> {
  return apiFetch<StudentProfile>(`${BASE_URL}/auth/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Ask ───────────────────────────────────────────────────────────────────

export async function askQuestion(
  problem: string,
  sessionId?: string,
  signal?: AbortSignal
): Promise<BrainModeResponse> {
  return apiFetch<BrainModeResponse>(`${BASE_URL}/ask`, {
    method: "POST",
    body: JSON.stringify({
      problem,
      session_id: sessionId || null,
      input_method: "text",
    }),
    signal,
  });
}

export async function askDirect(
  problem: string,
  sessionId?: string,
  signal?: AbortSignal
): Promise<any> {
  return apiFetch<any>(`${BASE_URL}/ask/direct`, {
    method: "POST",
    body: JSON.stringify({
      problem,
      session_id: sessionId || null,
    }),
    signal,
  });
}

export async function askImage(
  imageFile: File,
  sessionId?: string
): Promise<BrainModeResponse> {
  const form = new FormData();
  form.append("image", imageFile);
  if (sessionId) form.append("session_id", sessionId);

  return apiFetch<BrainModeResponse>(`${BASE_URL}/ask/image`, {
    method: "POST",
    body: form, // no Content-Type header — apiFetch skips it for FormData
  });
}

// ── Hints ─────────────────────────────────────────────────────────────────

export async function getHint(
  attemptId: string,
  requestedLevel: number
): Promise<HintResponse> {
  // FIX: don't swallow errors — let caller handle them
  return apiFetch<HintResponse>(`${BASE_URL}/hints`, {
    method: "POST",
    body: JSON.stringify({
      attempt_id: attemptId,
      requested_level: requestedLevel,
    }),
  });
}

// ── Solution ──────────────────────────────────────────────────────────────

export async function getSos(attemptId: string): Promise<any> {
  return apiFetch<any>(`${BASE_URL}/solution/sos`, {
    method: "POST",
    body: JSON.stringify({ attempt_id: attemptId }),
  });
}

export async function checkStep(
  attemptId: string,
  stepNumber: number,
  studentStep: string,
  previousSteps: string[]
): Promise<StepCheckResponse> {
  return apiFetch<StepCheckResponse>(`${BASE_URL}/solution/check-step`, {
    method: "POST",
    body: JSON.stringify({
      attempt_id: attemptId,
      step_number: stepNumber,
      student_step: studentStep,
      previous_steps: previousSteps,
    }),
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardResponse> {
  // FIX: no student_id in URL — backend uses auth token now
  // FIX: don't swallow errors silently
  return apiFetch<DashboardResponse>(`${BASE_URL}/practice/dashboard`);
}

// ── Chats ─────────────────────────────────────────────────────────────────

export async function getChats(): Promise<ChatSession[]> {
  return apiFetch<ChatSession[]>(`${BASE_URL}/chats`);
}

export async function createChat(title = "New Chat"): Promise<ChatSession> {
  return apiFetch<ChatSession>(`${BASE_URL}/chats`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function renameChat(chatId: string, title: string): Promise<ChatSession> {
  return apiFetch<ChatSession>(`${BASE_URL}/chats/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiFetch<void>(`${BASE_URL}/chats/${chatId}`, { method: "DELETE" });
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`${BASE_URL}/chats/${chatId}/messages`);
}

// ── Daily Challenge ───────────────────────────────────────────────────────

export async function getTodayChallenge(): Promise<ChallengeProblemResponse> {
  return apiFetch<ChallengeProblemResponse>(`${BASE_URL}/challenge/today`);
}

export async function submitChallenge(
  answer: string,
  timeTakenSeconds?: number
): Promise<ChallengeSubmitResponse> {
  return apiFetch<ChallengeSubmitResponse>(`${BASE_URL}/challenge/submit`, {
    method: "POST",
    body: JSON.stringify({
      answer,
      time_taken_seconds: timeTakenSeconds ?? null,
    }),
  });
}
