import { describe, expect, it } from "vitest";
import { matchChord } from "../match";
import { resolveChordSpec } from "../presets";
import type { ChordMatchResult, ChordSpec, Preset } from "../types";
import type { Quality } from "../../theory/chords";
import { parseNote } from "../../theory/note";

const sorted = <T>(xs: T[]) => [...xs].sort();

/** A note outside the spec is rejected either as `unexpected` or mapped to a forbidden degree. */
function expectRejectedExtra(r: ChordMatchResult, midi: number) {
  expect(r.correct).toBe(false);
  const p = r.played.find((x) => x.midi === midi);
  expect(p).toBeDefined();
  const asUnexpected = r.unexpected.includes(midi);
  const asForbidden = p!.degree !== null && r.forbidden.includes(p!.degree);
  expect(asUnexpected || asForbidden, `midi ${midi} should be unexpected or forbidden`).toBe(true);
}

const spec = (root: string, q: Quality, p: Preset) => resolveChordSpec(parseNote(root), q, p);

describe("presets × concrete voicings — correct", () => {
  it.each<[string, Quality, Preset, number[]]>([
    // any
    ["Db", "maj7", "any", [61, 65, 68, 72]],
    ["Db", "maj7", "any", [61, 65, 72]], // no 5th
    ["Db", "maj7", "any", [65, 68, 72, 73]], // inversion is fine
    ["Db", "maj7", "any", [49, 61, 65, 68, 72]], // doubled root
    ["C", "m7", "any", [60, 63, 67, 70]],
    ["F#", "m7b5", "any", [66, 69, 72, 76]],
    ["B", "dim7", "any", [59, 62, 65, 68]],
    ["Eb", "aug", "any", [63, 67, 71]],
    ["E", "7", "any", [52, 56, 59, 62]],
    ["Gb", "6", "any", [54, 58, 61, 63]],
    ["Gb", "m", "any", [54, 57, 61]],
    ["A", "7sus4", "any", [57, 62, 64, 67]],
    ["G#", "mMaj7", "any", [56, 59, 63, 67]],
    // root position
    ["Db", "maj7", "root_position", [61, 65, 68, 72]],
    ["G", "7", "root_position", [43, 59, 62, 65]],
    ["Bb", "maj", "root_position", [46, 62, 65, 70]],
    // inversions
    ["C", "maj7", "inversion_1", [64, 67, 71, 72]],
    ["A", "m", "inversion_1", [60, 64, 69]],
    ["Eb", "maj7", "inversion_2", [58, 62, 63, 67]],
    ["F", "dim", "inversion_2", [59, 65, 68]], // Cb in bass
    ["G", "7", "inversion_3", [65, 67, 71, 74]],
    ["B", "dim7", "inversion_3", [56, 59, 62, 65]], // Ab in bass
    ["D", "m6", "inversion_3", [59, 62, 65, 69]],
    // shell
    ["C", "maj7", "shell", [48, 64, 71]],
    ["C", "maj7", "shell", [48, 59, 64]], // 1-7-3
    ["D", "m7", "shell", [50, 65, 72]],
    ["G", "7", "shell", [43, 53, 59]],
    ["Bb", "6", "shell", [46, 62, 67]],
    ["Bb", "m6", "shell", [46, 61, 67]],
    // guide tones
    ["D", "m7", "guide_tones", [65, 72]],
    ["D", "m7", "guide_tones", [60, 65]],
    ["G", "7", "guide_tones", [59, 65]],
    ["G", "7", "guide_tones", [53, 59]],
    ["Eb", "maj7", "guide_tones", [55, 62]],
    // rootless A (3-5-7-9 / 7-9-3-13 on dominants)
    ["D", "m7", "rootless_a", [65, 69, 72, 76]],
    ["G", "7", "rootless_a", [59, 64, 65, 69]],
    ["C", "maj7", "rootless_a", [64, 67, 71, 74]],
    ["C", "m7", "rootless_a", [63, 67, 70, 74]],
    ["F", "7", "rootless_a", [57, 62, 63, 67]],
    ["Bb", "maj7", "rootless_a", [62, 65, 69, 72]],
    // rootless B
    ["D", "m7", "rootless_b", [60, 64, 65, 69]],
    ["G", "7", "rootless_b", [65, 69, 71, 76]],
    ["C", "maj7", "rootless_b", [59, 62, 64, 67]],
    ["C", "m7", "rootless_b", [58, 62, 63, 67]],
    ["F", "7", "rootless_b", [63, 67, 69, 74]],
  ])("%s%s %s %j", (root, q, p, notes) => {
    const r = matchChord(spec(root, q, p), notes);
    expect(r).toMatchObject({ correct: true, missing: [], forbidden: [], unexpected: [], violations: [] });
  });
});

describe("presets × concrete voicings — wrong", () => {
  it.each<[string, Quality, Preset, number[], string[]]>([
    ["F#", "m7b5", "any", [66, 69, 76], ["b5"]],
    ["B", "dim7", "any", [59, 62, 65], ["bb7"]],
    ["Eb", "aug", "any", [63, 67], ["#5"]],
    ["C", "maj7", "any", [67], ["1", "3", "7"]],
    ["C", "maj7", "root_position", [60, 64, 71], ["5"]],
    ["D", "m7", "guide_tones", [65], ["b7"]],
  ])("%s%s %s %j → missing %j", (root, q, p, notes, missing) => {
    const r = matchChord(spec(root, q, p), notes);
    expect(r.correct).toBe(false);
    expect(sorted(r.missing)).toEqual(sorted(missing));
  });

  it.each<[string, Quality, Preset, number[], string[]]>([
    ["C", "maj7", "shell", [48, 64, 67, 71], ["5"]],
    ["D", "m7", "guide_tones", [62, 65, 72], ["1"]],
    ["D", "m7", "guide_tones", [65, 69, 72], ["5"]],
    ["D", "m7", "rootless_a", [62, 65, 69, 72, 76], ["1"]],
    ["G", "7", "rootless_b", [55, 65, 69, 71, 76], ["1"]],
  ])("%s%s %s %j → forbidden %j", (root, q, p, notes, forbidden) => {
    const r = matchChord(spec(root, q, p), notes);
    expect(r.correct).toBe(false);
    expect(sorted(r.forbidden)).toEqual(forbidden);
  });

  it.each<[string, Quality, Preset, number[], string]>([
    ["Db", "maj7", "root_position", [65, 68, 72, 73], "bass"],
    ["C", "maj7", "inversion_1", [60, 64, 67, 71], "bass"],
    ["G", "7", "inversion_3", [67, 71, 74, 77], "bass"],
    ["C", "maj7", "shell", [52, 60, 71], "bass"],
    ["D", "m7", "rootless_a", [60, 64, 65, 69], "order"], // B voicing under A
    ["D", "m7", "rootless_b", [65, 69, 72, 76], "order"], // A voicing under B
  ])("%s%s %s %j → violation %s", (root, q, p, notes, v) => {
    const r = matchChord(spec(root, q, p), notes);
    expect(r.correct).toBe(false);
    expect(r.violations).toContain(v);
    expect(r.missing).toEqual([]);
  });

  it("rootless A with 7 and 3 swapped is an order violation", () => {
    // Cmaj7: B E G D (7-3-5-9) is neither A nor B
    const r = matchChord(spec("C", "maj7", "rootless_a"), [59, 64, 67, 74]);
    expect(r.correct).toBe(false);
    expect(r.violations).toContain("order");
  });

  it.each<[string, Quality, Preset, number[], number]>([
    ["C", "maj7", "any", [60, 62, 64, 67, 71], 62],
    ["C", "maj7", "any", [60, 64, 67, 70, 71], 70],
    ["A", "7sus4", "any", [57, 61, 62, 64, 67], 61], // 3rd in a sus chord
    ["Db", "maj7", "root_position", [61, 65, 68, 72, 74], 74],
    ["C", "m", "any", [60, 63, 64, 67], 64], // major AND minor third
  ])("%s%s %s %j rejects extra %i", (root, q, p, notes, extra) => {
    expectRejectedExtra(matchChord(spec(root, q, p), notes), extra);
  });
});

// Hand-built specs exercise the matcher independently of the presets.
const base: ChordSpec = {
  root: parseNote("C"),
  quality: "maj7",
  tones: { "1": "required", "3": "required", "5": "optional", "7": "required" },
  extras: "forbid",
  allowDoubling: true,
};

describe("matchChord — reporting", () => {
  it("maps degrees, sorts `played` by midi regardless of input order", () => {
    const r = matchChord(base, [71, 60, 67, 64]);
    expect(r).toEqual({
      correct: true,
      played: [
        { midi: 60, degree: "1" },
        { midi: 64, degree: "3" },
        { midi: 67, degree: "5" },
        { midi: 71, degree: "7" },
      ],
      missing: [],
      forbidden: [],
      unexpected: [],
      violations: [],
    });
  });

  it("enharmonic root: Dbmaj7 vs C#maj7 match the same midi", () => {
    const db = { ...base, root: parseNote("Db") };
    const cs = { ...base, root: parseNote("C#") };
    expect(matchChord(db, [61, 65, 68, 72]).correct).toBe(true);
    expect(matchChord(cs, [61, 65, 68, 72]).correct).toBe(true);
  });

  it("unmapped notes under forbid → unexpected midi, degree null", () => {
    const r = matchChord(base, [60, 64, 71, 74, 62]);
    expect(r.correct).toBe(false);
    expect(sorted(r.unexpected)).toEqual([62, 74]);
    expect(r.played.find((p) => p.midi === 74)!.degree).toBeNull();
    expect(r.played.map((p) => p.midi)).toEqual([60, 62, 64, 71, 74]);
  });

  it("allowAny: unmapped notes have degree null and are not unexpected", () => {
    const r = matchChord({ ...base, extras: "allowAny" }, [60, 61, 64, 71, 74]);
    expect(r.correct).toBe(true);
    expect(r.unexpected).toEqual([]);
    expect(r.played.find((p) => p.midi === 61)!.degree).toBeNull();
  });

  it("forbidden tokens reported once even when doubled", () => {
    const s: ChordSpec = { ...base, tones: { ...base.tones, "5": "forbidden" } };
    const r = matchChord(s, [55, 60, 64, 67, 71]);
    expect(r.correct).toBe(false);
    expect(r.forbidden).toEqual(["5"]);
  });

  it("missing tokens reported once each", () => {
    const r = matchChord(base, [64]);
    expect(sorted(r.missing)).toEqual(["1", "7"]);
    expect(r.correct).toBe(false);
  });

  it("empty input is not correct, all required missing", () => {
    const r = matchChord(base, []);
    expect(r.correct).toBe(false);
    expect(sorted(r.missing)).toEqual(["1", "3", "7"]);
    expect(r.played).toEqual([]);
  });

  it.each<[Quality, string, number[], boolean]>([
    ["maj7", "9 on maj7", [60, 62, 64, 67, 71], true],
    ["7", "b9 on dominant", [60, 61, 64, 67, 70], true],
    ["7", "#11 on dominant", [60, 64, 66, 70], true],
    ["7", "13 on dominant", [60, 64, 69, 70], true],
    ["m7", "9 on m7", [60, 62, 63, 70], true],
    ["m7", "11 on m7", [60, 63, 65, 70], true],
    ["maj7", "b9 on maj7 is not idiomatic", [60, 61, 64, 71], false],
  ])("allowTensions %s: %s", (q, _label, notes, ok) => {
    const tones: Record<string, ChordSpec["tones"]> = {
      maj7: { "1": "required", "3": "required", "5": "optional", "7": "required" },
      "7": { "1": "required", "3": "required", "5": "optional", b7: "required" },
      m7: { "1": "required", b3: "required", "5": "optional", b7: "required" },
    };
    const s: ChordSpec = { ...base, quality: q, tones: tones[q]!, extras: "allowTensions" };
    expect(matchChord(s, notes).correct).toBe(ok);
  });
});

describe("matchChord — violations", () => {
  it.each<[string, Partial<ChordSpec>, number[], string[]]>([
    ["doubling disallowed", { allowDoubling: false }, [48, 60, 64, 71], ["doubling"]],
    ["doubling disallowed, none doubled", { allowDoubling: false }, [60, 64, 71], []],
    ["bass ok (alternatives)", { bass: ["1", "3"] }, [64, 67, 71, 72], []],
    ["bass wrong", { bass: ["1", "3"] }, [67, 71, 72, 76], ["bass"]],
    ["span too wide", { maxSpan: 12 }, [48, 64, 67, 71], ["span"]],
    ["span within", { maxSpan: 12 }, [60, 64, 67, 71], []],
    ["span exactly max", { maxSpan: 12 }, [60, 64, 71, 72], []],
    ["minNotes explicit, too few", { minNotes: 4 }, [60, 64, 71], ["minNotes"]],
    ["minNotes explicit, enough", { minNotes: 4 }, [60, 64, 67, 71], []],
    ["minNotes default = #required (3), enough", {}, [60, 64, 71], []],
    ["order: 3-5-7-9 slots", { order: [["3"], ["5", "13"], ["7"], ["9"]], tones: { "1": "forbidden", "3": "required", "5": "optional", "13": "optional", "7": "required", "9": "optional" } }, [64, 67, 71, 74], []],
    ["order: 13 alternative", { order: [["3"], ["5", "13"], ["7"], ["9"]], tones: { "1": "forbidden", "3": "required", "5": "optional", "13": "optional", "7": "required", "9": "optional" } }, [64, 69, 71, 74], []],
    ["order wrong", { order: [["3"], ["5", "13"], ["7"], ["9"]], tones: { "1": "forbidden", "3": "required", "5": "optional", "13": "optional", "7": "required", "9": "optional" } }, [59, 62, 64, 67], ["order"]],
  ])("%s", (_label, over, notes, violations) => {
    const r = matchChord({ ...base, ...over }, notes);
    expect(sorted(r.violations)).toEqual(sorted(violations));
    expect(r.correct).toBe(violations.length === 0);
  });

  it("minNotes default: two notes of a three-required chord is a minNotes violation", () => {
    const r = matchChord(base, [60, 64]);
    expect(r.correct).toBe(false);
    expect(r.violations).toContain("minNotes");
  });
});
