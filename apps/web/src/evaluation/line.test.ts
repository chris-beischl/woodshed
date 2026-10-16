import { describe, expect, it } from "vitest";
import { createLineRunner, nextPitch, type LineSpec, type Step } from "./line";

// C major scale up and down: C D E F G A B C B A G F E D C
const C_MAJOR: LineSpec = {
  pcs: [0, 2, 4, 5, 7, 9, 11, 0, 11, 9, 7, 5, 4, 2, 0],
  contour: [...Array<Step>(7).fill(1), ...Array<Step>(7).fill(-1)],
  onMistake: "retry",
  maxMistakes: 3,
};
const UP = [60, 62, 64, 65, 67, 69, 71, 72];
const DOWN = [71, 69, 67, 65, 64, 62, 60];

describe("nextPitch", () => {
  it.each([
    [60, 2, 1, 62], [60, 11, 1, 71], [60, 11, -1, 59], [60, 0, 1, 72], [60, 0, -1, 48],
    [60, 0, 0, 60], [60, 6, 0, 66], [60, 5, 0, 65], [60, 7, 0, 55],
  ] as const)("from %i to pc %i, step %i → %i", (from, pc, step, out) => {
    expect(nextPitch(from, pc, step)).toBe(out);
  });
});

describe("createLineRunner", () => {
  it("accepts a clean scale in any octave", () => {
    for (const shift of [-24, 0, 12]) {
      const r = createLineRunner(C_MAJOR);
      for (const m of [...UP, ...DOWN]) expect(r.onNote(m + shift)).toBe("correct");
      expect(r.state()).toMatchObject({ done: true, failed: false, mistakes: 0 });
    }
  });

  it("enforces the contour: the same pitch class in the wrong octave is wrong", () => {
    const r = createLineRunner(C_MAJOR);
    r.onNote(60);
    expect(r.onNote(50)).toBe("wrong"); // D an octave too low
    expect(r.state().expected).toBe(62);
  });

  it("retry: stays on the expected note after a mistake", () => {
    const r = createLineRunner(C_MAJOR);
    r.onNote(60);
    r.onNote(62);
    r.onNote(65); // skipped E
    expect(r.state()).toMatchObject({ position: 2, mistakes: 1, expected: 64 });
    expect(r.onNote(64)).toBe("correct");
  });

  it("restart: a mistake sends the take back to the first note", () => {
    const r = createLineRunner({ ...C_MAJOR, onMistake: "restart" });
    r.onNote(60);
    r.onNote(62);
    r.onNote(63);
    expect(r.state()).toMatchObject({ position: 0, expected: null, played: [], mistakes: 1 });
    expect(r.onNote(72)).toBe("correct"); // may re-anchor in another octave
  });

  it("fails after maxMistakes and ignores further notes", () => {
    const r = createLineRunner(C_MAJOR);
    r.onNote(60);
    r.onNote(61);
    r.onNote(63);
    r.onNote(61);
    expect(r.state()).toMatchObject({ failed: true, done: true, mistakes: 3 });
    expect(r.onNote(60)).toBe("ignored");
  });

  it("restart: a wrong first note is a mistake (anchoring needs the right pitch class)", () => {
    const r = createLineRunner({ ...C_MAJOR, onMistake: "restart" });
    expect(r.onNote(62)).toBe("wrong");
    expect(r.onNote(48)).toBe("correct");
  });

  it("retry: notes before the first correct note are ignored (warming up)", () => {
    const r = createLineRunner(C_MAJOR);
    expect(r.onNote(62)).toBe("ignored");
    expect(r.onNote(65)).toBe("ignored");
    expect(r.onNote(60)).toBe("correct");
    expect(r.state().mistakes).toBe(0);
  });

  it("retry: re-striking the note just played is ignored, a real wrong note still counts", () => {
    const r = createLineRunner(C_MAJOR);
    r.onNote(60);
    r.onNote(62);
    expect(r.onNote(62)).toBe("ignored");
    expect(r.onNote(63)).toBe("wrong");
    expect(r.state()).toMatchObject({ position: 2, mistakes: 1 });
  });
});
