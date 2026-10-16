import { describe, expect, it } from "vitest";
import { formatNote, parseNote, pitchClass, SpellingRangeError } from "../note";
import type { SpelledNote } from "../note";

describe("parseNote", () => {
  it.each<[string, SpelledNote]>([
    ["C", { letter: "C", accidental: 0 }],
    ["Bb", { letter: "B", accidental: -1 }],
    ["Bbb", { letter: "B", accidental: -2 }],
    ["F#", { letter: "F", accidental: 1 }],
    ["F##", { letter: "F", accidental: 2 }],
    ["Fx", { letter: "F", accidental: 2 }],
    ["Cb", { letter: "C", accidental: -1 }],
    ["E#", { letter: "E", accidental: 1 }],
    ["Abb", { letter: "A", accidental: -2 }],
  ])("%s", (s, expected) => {
    expect(parseNote(s)).toEqual(expected);
  });

  it.each(["", "H", "C###", "Cbbb", "Bb#", "X"])("rejects %j", (s) => {
    expect(() => parseNote(s)).toThrow();
  });
});

describe("formatNote", () => {
  it.each(["C", "Db", "Ebb", "F#", "F##", "Cb", "B#", "Gbb", "A"])("roundtrips %s", (s) => {
    expect(formatNote(parseNote(s))).toBe(s);
  });

  it("writes double sharp as ## (ASCII), not x", () => {
    expect(formatNote({ letter: "C", accidental: 2 })).toBe("C##");
    expect(formatNote(parseNote("Cx"))).toBe("C##");
  });
});

describe("pitchClass", () => {
  it.each<[string, number]>([
    ["C", 0], ["C#", 1], ["Db", 1], ["D", 2], ["Eb", 3], ["E", 4], ["F", 5],
    ["F#", 6], ["Gb", 6], ["G", 7], ["Ab", 8], ["A", 9], ["Bb", 10], ["B", 11],
    // wrap-around and doubles
    ["Cb", 11], ["B#", 0], ["E#", 5], ["Fb", 4], ["Bbb", 9], ["F##", 7],
    ["C##", 2], ["Dbb", 0], ["Cbb", 10], ["B##", 1], ["A##", 11], ["Gbb", 5],
  ])("%s = %i", (s, pc) => {
    expect(pitchClass(parseNote(s))).toBe(pc);
  });
});

describe("SpellingRangeError", () => {
  it("is an Error subclass", () => {
    const e = new SpellingRangeError("x");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(SpellingRangeError);
  });
});
