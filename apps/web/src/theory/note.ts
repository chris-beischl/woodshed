export type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Accidental = -2 | -1 | 0 | 1 | 2;

export interface SpelledNote {
  letter: Letter;
  accidental: Accidental;
}

export interface SpelledPitch extends SpelledNote {
  octave: number;
}

export const LETTERS: readonly Letter[] = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export class SpellingRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpellingRangeError";
  }
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

export function letterAt(index: number): Letter {
  return LETTERS[((index % 7) + 7) % 7]!;
}

export function naturalPitchClass(letter: Letter): number {
  return NATURAL_PC[letter];
}

export function pitchClass(n: SpelledNote): number {
  return mod12(NATURAL_PC[n.letter] + n.accidental);
}

/** Smallest signed distance (-6..5) from `from` to `to` in pitch-class space. */
function signedPcDistance(from: number, to: number): number {
  const d = mod12(to - from);
  return d > 5 ? d - 12 : d;
}

/** Spell pitch class `pc` on `letter`; throws if it needs more than a double accidental. */
export function spellOnLetter(letter: Letter, pc: number): SpelledNote {
  const acc = signedPcDistance(NATURAL_PC[letter], pc);
  if (acc < -2 || acc > 2) {
    throw new SpellingRangeError(`pitch class ${pc} cannot be spelled on ${letter} (accidental ${acc})`);
  }
  return { letter, accidental: acc as Accidental };
}

export function parseNote(s: string): SpelledNote {
  const m = /^([A-G])(bb|b|##|#|x)?$/.exec(s.trim());
  if (!m) throw new Error(`invalid note name: ${JSON.stringify(s)}`);
  const accidentals: Record<string, Accidental> = { bb: -2, b: -1, "": 0, "#": 1, "##": 2, x: 2 };
  return { letter: m[1] as Letter, accidental: accidentals[m[2] ?? ""]! };
}

export function formatNote(n: SpelledNote): string {
  const suffix = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" }[n.accidental];
  return n.letter + suffix;
}

export function sameNote(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.accidental === b.accidental;
}
