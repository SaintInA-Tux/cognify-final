/**
 * LocalStore — PhiPrep localStorage persistence layer.
 *
 * All keys are namespaced under `phiprep_` and scoped by student ID
 * to prevent data leakage between accounts.
 */

const PREFIX = 'phiprep_';

function getStudentId(): string | null {
  return localStorage.getItem('phyprep_student_id');
}

function key(name: string): string {
  const sid = getStudentId();
  return sid ? `${PREFIX}${sid}_${name}` : `${PREFIX}anonymous_${name}`;
}

// ── Brain Mode Progress ──

export interface BrainProgress {
  attemptId: string;
  classification: any;
  brainDetails: any;
  steps: any[];
  currentStepNumber: number;
  previousSteps: string[];
  errorCount: number;
  hintsUsedCount: number;
  sosSolution: string | null;
}

export function saveBrainProgress(chatId: string, data: BrainProgress): void {
  try {
    localStorage.setItem(key(`brain_${chatId}`), JSON.stringify(data));
  } catch { /* quota exceeded — fail silently */ }
}

export function loadBrainProgress(chatId: string): BrainProgress | null {
  try {
    const raw = localStorage.getItem(key(`brain_${chatId}`));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearBrainProgress(chatId: string): void {
  localStorage.removeItem(key(`brain_${chatId}`));
}

// ── User Preferences ──

export interface UserPrefs {
  mode?: 'general' | 'brain';
  fontSize?: string;
}

export function saveUserPrefs(prefs: UserPrefs): void {
  try {
    localStorage.setItem(key('prefs'), JSON.stringify(prefs));
  } catch { /* silent */ }
}

export function loadUserPrefs(): UserPrefs | null {
  try {
    const raw = localStorage.getItem(key('prefs'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Last Active Session ──

export function saveLastChatId(id: string | null): void {
  if (id) localStorage.setItem(key('last_chat_id'), id);
  else localStorage.removeItem(key('last_chat_id'));
}

export function loadLastChatId(): string | null {
  return localStorage.getItem(key('last_chat_id'));
}

// ── Cleanup ──

export function clearUserData(): void {
  const sid = getStudentId();
  if (!sid) return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${PREFIX}${sid}_`)) {
      toRemove.push(k);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
