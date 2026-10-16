import { describe, expect, it } from "vitest";
import { gradeAttempt, gradeChoice } from "../grading";
import type { Rating } from "../types";

const ok = { mistakes: 0, failed: false };
const slip = { mistakes: 1, failed: false };
const fail = { mistakes: 3, failed: true };

describe("gradeAttempt (§4.6), target 10 s", () => {
  it.each<[string, { mistakes: number; failed: boolean }[], number, boolean | undefined, Rating]>([
    ["failed chord", [ok, fail, ok], 3000, undefined, "again"],
    ["failed chord even if fast", [fail], 100, undefined, "again"],
    ["abandoned", [ok, ok, ok], 3000, true, "again"],
    ["abandoned beats mistakes", [slip], 3000, true, "again"],
    ["mistake, fast", [ok, slip, ok], 1000, undefined, "hard"],
    ["mistake, slow", [slip], 30000, undefined, "hard"],
    ["clean, slow (just over 1.5×)", [ok, ok], 15001, undefined, "hard"],
    ["clean, exactly 1.5×", [ok, ok], 15000, undefined, "good"],
    ["clean, between", [ok, ok], 10000, undefined, "good"],
    ["clean, just over 0.5×", [ok, ok], 5001, undefined, "good"],
    ["clean, exactly 0.5×", [ok, ok], 5000, undefined, "easy"],
    ["clean, very fast", [ok, ok], 1000, undefined, "easy"],
    ["not abandoned (false)", [ok], 4000, false, "easy"],
  ])("%s → %s", (_l, chords, durationMs, abandoned, rating) => {
    expect(gradeAttempt({ chords, durationMs, targetSeconds: 10, abandoned })).toBe(rating);
  });

  it("uses targetSeconds in seconds vs durationMs in ms", () => {
    expect(gradeAttempt({ chords: [ok], durationMs: 6000, targetSeconds: 4 })).toBe("good"); // 1.5×4 s = 6 s
    expect(gradeAttempt({ chords: [ok], durationMs: 6001, targetSeconds: 4 })).toBe("hard");
    expect(gradeAttempt({ chords: [ok], durationMs: 2000, targetSeconds: 4 })).toBe("easy");
  });
});

describe("gradeChoice", () => {
  it.each<[boolean, number, Rating]>([
    [false, 100, "again"],
    [false, 99999, "again"],
    [true, 4999, "easy"],
    [true, 5001, "good"],
    [true, 10000, "good"],
    [true, 60000, "good"], // slow but correct is still good
  ])("correct=%s, %i ms of 10 s → %s", (correct, durationMs, rating) => {
    expect(gradeChoice({ correct, durationMs, targetSeconds: 10 })).toBe(rating);
  });
});
