import { describe, expect, it } from "vitest";
import { gradeQuiz } from "./grading";

describe("gradeQuiz", () => {
  it.each([
    [0, 8, 5000, 20, "easy"], [0, 8, 10_000, 20, "easy"], [0, 8, 10_001, 20, "good"],
    [1, 8, 5000, 20, "hard"], [2, 8, 5000, 20, "hard"], [3, 8, 5000, 20, "again"],
  ] as const)("%i mistakes / %i rounds in %i ms (target %i s) → %s", (mistakes, rounds, durationMs, targetSeconds, r) => {
    expect(gradeQuiz({ mistakes, rounds, durationMs, targetSeconds })).toBe(r);
  });
});
