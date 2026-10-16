import { describe, expect, it } from "vitest";
import type { Manifest } from "../exercises/schema";
import { applyReview, completeLesson, emptyLearner, learnerSchema, planFor } from "./state";

const NOW = new Date("2026-03-10T10:00:00Z");
const manifest = {
  version: "v",
  templates: [
    { id: "triads-major", keys: ["C", "F"], deprecated: false, importance: 5, estimatedSeconds: 10 },
    { id: "old", keys: ["C"], deprecated: true, importance: 1, estimatedSeconds: 10 },
  ],
  lessons: [{ id: "intro", order: 1, title: "Intro", estimatedMinutes: 5, unit: 1, introduces: ["triads-major", "old"], prerequisites: [], hidden: false }],
} as unknown as Manifest; // only the fields the planner reads

describe("learner state", () => {
  it("completing a lesson creates one new card per key, once", () => {
    const first = completeLesson(emptyLearner(), manifest, "intro", NOW);
    expect(first.cards_created).toBe(2);
    expect(Object.keys(first.learner.cards).sort()).toEqual(["triads-major@C", "triads-major@F"]);
    const again = completeLesson(first.learner, manifest, "intro", NOW);
    expect(again.cards_created).toBe(0);
    expect(again.learner.completed_lessons).toEqual(["intro"]);
  });

  it("a review moves FSRS state; a lesson attempt only logs", () => {
    const { learner } = completeLesson(emptyLearner(), manifest, "intro", NOW);
    const lessonTry = applyReview(learner, { card_id: "triads-major@C", rating: "good", duration_ms: 5000, source: "lesson" }, NOW);
    expect(lessonTry.cards["triads-major@C"]!.fsrs).toBeNull();
    expect(lessonTry.logs).toHaveLength(1);
    const reviewed = applyReview(lessonTry, { card_id: "triads-major@C", rating: "good", duration_ms: 5000, source: "review" }, NOW);
    expect(reviewed.cards["triads-major@C"]!.fsrs!.due.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("survives a JSON round trip (storage and backup files)", () => {
    let { learner } = completeLesson(emptyLearner(), manifest, "intro", NOW);
    learner = applyReview(learner, { card_id: "triads-major@C", rating: "hard", duration_ms: 4000, source: "review" }, NOW);
    const restored = learnerSchema.parse(JSON.parse(JSON.stringify(learner)));
    expect(restored).toEqual(learner);
    expect(planFor(restored, manifest, NOW)).toEqual(planFor(learner, manifest, NOW));
  });

  it("rejects malformed data instead of guessing", () => {
    expect(() => learnerSchema.parse({ version: 1, cards: { x: { key: "C" } }, logs: [], completed_lessons: [] })).toThrow();
  });
});
