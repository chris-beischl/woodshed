import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { MAJOR_KEYS, parseKeyName } from "../../theory/keys";
import { formatNote, pitchClass, sameNote } from "../../theory/note";
import { majorScale } from "../../theory/scale";
import { makeQuiz, seededRandom } from "./quiz";

describe("makeQuiz", () => {
  it("degree_note: the answer is the spelled scale degree and appears exactly once", () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...MAJOR_KEYS), (seed, key) => {
        const scale = majorScale(key.tonic);
        for (const q of makeQuiz(key, "degree_note", [1, 2, 3, 4, 5, 6, 7], 8, seededRandom(seed))) {
          if (q.ask !== "degree_note") throw new Error();
          expect(sameNote(q.answer, scale[q.degree - 1]!)).toBe(true);
          expect(q.options.filter((o) => sameNote(o, q.answer))).toHaveLength(1);
          expect(q.options).toHaveLength(4);
        }
      }),
    );
  });

  it("offers the enharmonic twin as a distractor (3rd of D major: F# vs Gb)", () => {
    const qs = makeQuiz(parseKeyName("D", "major"), "degree_note", [3], 1, seededRandom(1));
    const q = qs[0]!;
    if (q.ask !== "degree_note") throw new Error();
    expect(formatNote(q.answer)).toBe("F#");
    expect(q.options.map(formatNote)).toContain("Gb");
    // the enharmonic twin sounds the same: the quiz is about spelling, not pitch
    expect(q.options.filter((o) => pitchClass(o) === pitchClass(q.answer)).length).toBe(2);
  });

  it("Gb major's 4th is Cb, never B", () => {
    const q = makeQuiz(parseKeyName("Gb", "major"), "degree_note", [4], 1, seededRandom(7))[0]!;
    if (q.ask !== "degree_note") throw new Error();
    expect(formatNote(q.answer)).toBe("Cb");
  });

  it("note_degree: four distinct degree options including the answer; no immediate repeats", () => {
    const qs = makeQuiz(parseKeyName("Eb", "major"), "note_degree", [1, 2, 3, 4, 5, 6, 7], 20, seededRandom(3));
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i]!;
      if (q.ask !== "note_degree") throw new Error();
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      if (i > 0) expect((qs[i - 1] as typeof q).answer).not.toBe(q.answer);
    }
  });
});
