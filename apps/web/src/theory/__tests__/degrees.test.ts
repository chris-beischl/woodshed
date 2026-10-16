import { describe, expect, it } from "vitest";
import { DEGREES, spellDegree } from "../degrees";
import type { DegreeToken } from "../degrees";
import { formatNote, parseNote, SpellingRangeError } from "../note";

describe("DEGREES table (§3.3)", () => {
  it.each<[DegreeToken, number, number]>([
    ["1", 0, 0], ["b9", 1, 1], ["2", 1, 2], ["9", 1, 2], ["#9", 1, 3],
    ["b3", 2, 3], ["3", 2, 4], ["4", 3, 5], ["11", 3, 5], ["#11", 3, 6],
    ["b5", 4, 6], ["5", 4, 7], ["#5", 4, 8], ["b13", 5, 8], ["6", 5, 9],
    ["13", 5, 9], ["bb7", 6, 9], ["b7", 6, 10], ["7", 6, 11],
  ])("%s: letter +%i, %i semitones", (tok, lo, st) => {
    expect(DEGREES[tok]).toEqual(expect.objectContaining({ letterOffset: lo, semitones: st }));
  });

  it("has exactly the 19 tokens", () => {
    expect(Object.keys(DEGREES).sort()).toEqual(
      ["1", "b9", "2", "9", "#9", "b3", "3", "4", "11", "#11", "b5", "5", "#5", "b13", "6", "13", "bb7", "b7", "7"].sort(),
    );
  });
});

describe("spellDegree", () => {
  const C: Record<DegreeToken, string> = {
    "1": "C", b9: "Db", "2": "D", "9": "D", "#9": "D#", b3: "Eb", "3": "E", "4": "F", "11": "F",
    "#11": "F#", b5: "Gb", "5": "G", "#5": "G#", b13: "Ab", "6": "A", "13": "A", bb7: "Bbb", b7: "Bb", "7": "B",
  };
  const Eb: Record<DegreeToken, string> = {
    "1": "Eb", b9: "Fb", "2": "F", "9": "F", "#9": "F#", b3: "Gb", "3": "G", "4": "Ab", "11": "Ab",
    "#11": "A", b5: "Bbb", "5": "Bb", "#5": "B", b13: "Cb", "6": "C", "13": "C", bb7: "Dbb", b7: "Db", "7": "D",
  };
  const Fs: Record<DegreeToken, string> = {
    "1": "F#", b9: "G", "2": "G#", "9": "G#", "#9": "G##", b3: "A", "3": "A#", "4": "B", "11": "B",
    "#11": "B#", b5: "C", "5": "C#", "#5": "C##", b13: "D", "6": "D#", "13": "D#", bb7: "Eb", b7: "E", "7": "E#",
  };
  it.each<[string, Record<DegreeToken, string>]>([["C", C], ["Eb", Eb], ["F#", Fs]])(
    "every token from %s",
    (root, table) => {
      for (const [tok, exp] of Object.entries(table)) {
        expect(formatNote(spellDegree(parseNote(root), tok as DegreeToken)), `${root} ${tok}`).toBe(exp);
      }
    },
  );

  it.each<[string, DegreeToken, string, DegreeToken, string]>([
    // same pitch class, different letters — the classic traps
    ["C", "#9", "D#", "b3", "Eb"],
    ["C", "#11", "F#", "b5", "Gb"],
    ["C", "#5", "G#", "b13", "Ab"],
    ["C", "6", "A", "bb7", "Bbb"],
    ["A", "#9", "B#", "b3", "C"],
    ["Bb", "#9", "C#", "b3", "Db"],
  ])("%s: %s = %s but %s = %s", (root, t1, s1, t2, s2) => {
    expect(formatNote(spellDegree(parseNote(root), t1))).toBe(s1);
    expect(formatNote(spellDegree(parseNote(root), t2))).toBe(s2);
  });

  it.each<[string, DegreeToken]>([
    ["Cb", "bb7"], // Bbbb
    ["Fb", "bb7"], // Ebbb
    ["B#", "#5"],  // F###
    ["E#", "#9"],  // F###
    ["Gbb", "b3"], // Bbbb
  ])("%s %s is out of range → SpellingRangeError", (root, tok) => {
    expect(() => spellDegree(parseNote(root), tok)).toThrow(SpellingRangeError);
  });

  it.each<[string, DegreeToken, string]>([
    ["Cb", "b7", "Bbb"],
    ["D#", "#5", "A##"],
    ["G#", "7", "F##"],
    ["Fb", "b3", "Abb"],
  ])("%s %s = %s (edge of range, allowed)", (root, tok, exp) => {
    expect(formatNote(spellDegree(parseNote(root), tok))).toBe(exp);
  });
});
