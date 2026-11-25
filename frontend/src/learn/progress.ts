// Per-browser learning progress (a convenience only: it may be empty in a private window).
const KEY = "schedulesim:belajar";

export interface LessonProgress { step: number; answers: Record<string, number>; done: boolean }

function readAll(): Record<string, LessonProgress> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}

export function getProgress(id: string): LessonProgress {
  return readAll()[id] ?? { step: 0, answers: {}, done: false };
}

export function saveProgress(id: string, p: LessonProgress): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [id]: p })); } catch { /* ignore */ }
}

export function resetProgress(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Stable shuffle of option indices for a question, so the correct one is not always first. */
export function order(id: string, n: number): number[] {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
