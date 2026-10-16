import type { Rating } from "./types";

/** ARCHITECTURE § 4.6. */
export function gradeAttempt(a: {
  chords: { mistakes: number; failed: boolean }[];
  durationMs: number;
  targetSeconds: number;
  abandoned?: boolean;
}): Rating {
  if (a.abandoned || a.chords.some((c) => c.failed)) return "again";
  const ratio = a.durationMs / (a.targetSeconds * 1000);
  if (a.chords.some((c) => c.mistakes > 0) || ratio > 1.5) return "hard";
  return ratio <= 0.5 ? "easy" : "good";
}

export function gradeChoice(a: { correct: boolean; durationMs: number; targetSeconds: number }): Rating {
  if (!a.correct) return "again";
  return a.durationMs <= a.targetSeconds * 500 ? "easy" : "good";
}

/** Quiz round (§ 4.6): no mistakes → good/easy by time; ≤ 25 % wrong → hard; else again. */
export function gradeQuiz(a: { mistakes: number; rounds: number; durationMs: number; targetSeconds: number }): Rating {
  if (a.mistakes === 0) return a.durationMs <= a.targetSeconds * 500 ? "easy" : "good";
  return a.mistakes <= a.rounds / 4 ? "hard" : "again";
}
