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

describe("circle-of-fifths quizzes", () => {
  // Expected answers per major key, by hand (circle of fifths, Gb not F#: theory-decisions #1).
  const TABLE: Record<string, { fifth: string; fourth: string; signature: number }> = {
    C: { fifth: "G", fourth: "F", signature: 0 },
    G: { fifth: "D", fourth: "C", signature: 1 },
    D: { fifth: "A", fourth: "G", signature: 2 },
    A: { fifth: "E", fourth: "D", signature: 3 },
    E: { fifth: "B", fourth: "A", signature: 4 },
    B: { fifth: "F#", fourth: "E", signature: 5 },
    Gb: { fifth: "Db", fourth: "Cb", signature: -6 },
    Db: { fifth: "Ab", fourth: "Gb", signature: -5 },
    Ab: { fifth: "Eb", fourth: "Db", signature: -4 },
    Eb: { fifth: "Bb", fourth: "Ab", signature: -3 },
    Bb: { fifth: "F", fourth: "Eb", signature: -2 },
    F: { fifth: "C", fourth: "Bb", signature: -1 },
  };

  it("covers every major key in the table", () => {
    expect(MAJOR_KEYS.map((k) => formatNote(k.tonic)).sort()).toEqual(Object.keys(TABLE).sort());
  });

  it.each(["fifth_up", "fourth_up", "key_signature"] as const)("%s: answers match the table, appear once, 4 distinct options", (ask) => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        for (const q of makeQuiz(MAJOR_KEYS[0]!, ask, [], 12, seededRandom(seed))) {
          if (q.ask === "degree_note" || q.ask === "note_degree") throw new Error();
          const row = TABLE[formatNote(q.tonic)]!;
          expect(q.options).toHaveLength(4);
          if (q.ask === "key_signature") {
            expect(q.answer).toBe(row.signature);
            expect(new Set(q.options).size).toBe(4);
            expect(q.options.filter((o) => o === q.answer)).toHaveLength(1);
          } else {
            expect(formatNote(q.answer)).toBe(q.ask === "fifth_up" ? row.fifth : row.fourth);
            expect(q.options.filter((o) => sameNote(o, q.answer))).toHaveLength(1);
            expect(new Set(q.options.map(formatNote)).size).toBe(4);
          }
        }
      }),
    );
  });

  it("asks a different key each time in a row", () => {
    const qs = makeQuiz(MAJOR_KEYS[0]!, "fifth_up", [], 30, seededRandom(7));
    qs.slice(1).forEach((q, i) => {
      if (q.ask !== "fifth_up" || qs[i]!.ask !== "fifth_up") throw new Error();
      expect(formatNote(q.tonic)).not.toBe(formatNote((qs[i] as { tonic: Parameters<typeof formatNote>[0] }).tonic));
    });
  });
});
