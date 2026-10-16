import { describe, expect, it } from "vitest";
import { parseNote } from "./note";
import { midiOf, stackPitches } from "./pitch";

const p = (s: string, octave: number) => ({ ...parseNote(s), octave });

describe("midiOf", () => {
  it.each([
    ["C", 4, 60], ["Cb", 4, 59], ["B#", 3, 60], ["A", 4, 69], ["Fbb", 4, 63], ["G##", 4, 69],
  ])("%s%i = %i", (n, o, m) => expect(midiOf(p(n, o))).toBe(m));
});

describe("stackPitches", () => {
  it("stacks Ab7 upward across the octave break", () => {
    const pitches = stackPitches(["Ab", "C", "Eb", "Gb"].map(parseNote), 3);
    expect(pitches.map(midiOf)).toEqual([56, 60, 63, 66]);
  });
  it("keeps Cdim7's Bbb above Gb", () => {
    expect(stackPitches(["C", "Eb", "Gb", "Bbb"].map(parseNote)).map(midiOf)).toEqual([60, 63, 66, 69]);
  });
});
