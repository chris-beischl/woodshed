import { describe, expect, it } from "vitest";
import { majorScale } from "../scale";
import { formatNote, parseNote, pitchClass } from "../note";

describe("majorScale — literal tables", () => {
  it.each<[string, string[]]>([
    ["C", ["C", "D", "E", "F", "G", "A", "B"]],
    ["Db", ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"]],
    ["D", ["D", "E", "F#", "G", "A", "B", "C#"]],
    ["Eb", ["Eb", "F", "G", "Ab", "Bb", "C", "D"]],
    ["E", ["E", "F#", "G#", "A", "B", "C#", "D#"]],
    ["F", ["F", "G", "A", "Bb", "C", "D", "E"]],
    // trap: Cb, not B
    ["Gb", ["Gb", "Ab", "Bb", "Cb", "Db", "Eb", "F"]],
    ["G", ["G", "A", "B", "C", "D", "E", "F#"]],
    ["Ab", ["Ab", "Bb", "C", "Db", "Eb", "F", "G"]],
    ["A", ["A", "B", "C#", "D", "E", "F#", "G#"]],
    ["Bb", ["Bb", "C", "D", "Eb", "F", "G", "A"]],
    ["B", ["B", "C#", "D#", "E", "F#", "G#", "A#"]],
    // tonics of minor keys (accidentals in roman numerals are relative to these)
    ["C#", ["C#", "D#", "E#", "F#", "G#", "A#", "B#"]],
    ["F#", ["F#", "G#", "A#", "B", "C#", "D#", "E#"]],
    // trap: F## leading tone
    ["G#", ["G#", "A#", "B#", "C#", "D#", "E#", "F##"]],
  ])("%s major", (tonic, expected) => {
    const s = majorScale(parseNote(tonic));
    expect(s.map(formatNote)).toEqual(expected);
  });

  it("uses each letter exactly once and the W-W-H-W-W-W-H step pattern", () => {
    for (const t of ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B", "C#", "F#", "G#"]) {
      const s = majorScale(parseNote(t));
      expect(new Set(s.map((n) => n.letter)).size).toBe(7);
      const pcs = s.map(pitchClass);
      const steps = pcs.map((p, i) => ((pcs[(i + 1) % 7]! - p) % 12 + 12) % 12);
      expect(steps).toEqual([2, 2, 1, 2, 2, 2, 1]);
    }
  });
});
