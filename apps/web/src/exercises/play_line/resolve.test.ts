import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createLineRunner } from "../../evaluation/line";
import { formatNote } from "../../theory/note";
import { MAJOR_KEYS, MINOR_KEYS, type Key } from "../../theory/keys";
import { playLineParams } from "../schema";
import { resolvePlayLine } from "./resolve";

const CONTENT = resolvePath(__dirname, "../../../../../content/exercises");
const load = (file: string) => {
  const raw = parseYaml(readFileSync(resolvePath(CONTENT, file), "utf8")) as Record<string, unknown>;
  const { ref, over, notes, contour, onMistake, maxMistakes } = raw;
  return playLineParams.parse({ ref, over, notes, contour, onMistake, maxMistakes });
};

// Literal tables, ascending one octave. Written by hand; never computed.
const MAJOR: Record<string, string> = {
  C: "C D E F G A B C",
  Db: "Db Eb F Gb Ab Bb C Db",
  D: "D E F# G A B C# D",
  Eb: "Eb F G Ab Bb C D Eb",
  E: "E F# G# A B C# D# E",
  F: "F G A Bb C D E F",
  Gb: "Gb Ab Bb Cb Db Eb F Gb",
  G: "G A B C D E F# G",
  Ab: "Ab Bb C Db Eb F G Ab",
  A: "A B C# D E F# G# A",
  Bb: "Bb C D Eb F G A Bb",
  B: "B C# D# E F# G# A# B",
};
const NATURAL_MINOR: Record<string, string> = {
  C: "C D Eb F G Ab Bb C",
  "C#": "C# D# E F# G# A B C#",
  D: "D E F G A Bb C D",
  Eb: "Eb F Gb Ab Bb Cb Db Eb",
  E: "E F# G A B C D E",
  F: "F G Ab Bb C Db Eb F",
  "F#": "F# G# A B C# D E F#",
  G: "G A Bb C D Eb F G",
  "G#": "G# A# B C# D# E F# G#",
  A: "A B C D E F G A",
  Bb: "Bb C Db Eb F Gb Ab Bb",
  B: "B C# D E F# G A B",
};

function check(file: string, keys: Key[], table: Record<string, string>) {
  const params = load(file);
  expect(keys.map((k) => formatNote(k.tonic)).sort()).toEqual(Object.keys(table).sort());
  for (const key of keys) {
    const tonic = formatNote(key.tonic);
    const up = table[tonic]!.split(" ");
    const expected = [...up, ...up.slice(0, -1).reverse()];
    const inst = resolvePlayLine(params, key);
    expect(inst.notes.map(formatNote), `${tonic} ${key.mode}`).toEqual(expected);
  }
}

describe("scale YAMLs spell all 24 scales (literal tables)", () => {
  it("scale-major.yaml: 12 major scales", () => check("scale-major.yaml", MAJOR_KEYS, MAJOR));
  it("scale-natural-minor.yaml: 12 natural minor scales", () =>
    check("scale-natural-minor.yaml", MINOR_KEYS, NATURAL_MINOR));

  it("contour yields one octave up and back down to the same tonic (Eb major from Eb4)", () => {
    const inst = resolvePlayLine(load("scale-major.yaml"), MAJOR_KEYS.find((k) => formatNote(k.tonic) === "Eb")!);
    const midi = [63, 65, 67, 68, 70, 72, 74, 75, 74, 72, 70, 68, 67, 65, 63];
    const r = createLineRunner(inst.spec);
    for (const m of midi) expect(r.onNote(m)).toBe("correct");
    expect(r.state()).toMatchObject({ done: true, failed: false, mistakes: 0 });
  });
});
