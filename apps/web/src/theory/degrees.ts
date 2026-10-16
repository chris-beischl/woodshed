import { letterAt, letterIndex, pitchClass, spellOnLetter, type SpelledNote } from "./note";

export type DegreeToken =
  | "1" | "b9" | "2" | "9" | "#9" | "b3" | "3" | "4" | "11" | "#11"
  | "b5" | "5" | "#5" | "b13" | "6" | "13" | "bb7" | "b7" | "7";

/** ARCHITECTURE § 3.3. */
export const DEGREES: Record<DegreeToken, { letterOffset: number; semitones: number }> = {
  "1": { letterOffset: 0, semitones: 0 },
  b9: { letterOffset: 1, semitones: 1 },
  "2": { letterOffset: 1, semitones: 2 },
  "9": { letterOffset: 1, semitones: 2 },
  "#9": { letterOffset: 1, semitones: 3 },
  b3: { letterOffset: 2, semitones: 3 },
  "3": { letterOffset: 2, semitones: 4 },
  "4": { letterOffset: 3, semitones: 5 },
  "11": { letterOffset: 3, semitones: 5 },
  "#11": { letterOffset: 3, semitones: 6 },
  b5: { letterOffset: 4, semitones: 6 },
  "5": { letterOffset: 4, semitones: 7 },
  "#5": { letterOffset: 4, semitones: 8 },
  b13: { letterOffset: 5, semitones: 8 },
  "6": { letterOffset: 5, semitones: 9 },
  "13": { letterOffset: 5, semitones: 9 },
  bb7: { letterOffset: 6, semitones: 9 },
  b7: { letterOffset: 6, semitones: 10 },
  "7": { letterOffset: 6, semitones: 11 },
};

export const DEGREE_TOKENS = Object.keys(DEGREES) as DegreeToken[];

export function degreePitchClass(rootPc: number, token: DegreeToken): number {
  return (rootPc + DEGREES[token].semitones) % 12;
}

/** Spell a chord tone by letter arithmetic from the root. Never from pitch class alone. */
export function spellDegree(root: SpelledNote, token: DegreeToken): SpelledNote {
  const { letterOffset, semitones } = DEGREES[token];
  return spellOnLetter(letterAt(letterIndex(root.letter) + letterOffset), pitchClass(root) + semitones);
}
