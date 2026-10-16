import { letterAt, letterIndex, pitchClass, spellOnLetter, type SpelledNote } from "./note";

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

/** Major scale spelled with one note per letter (Gb major contains Cb). */
export function majorScale(tonic: SpelledNote): SpelledNote[] {
  const base = letterIndex(tonic.letter);
  const tonicPc = pitchClass(tonic);
  return MAJOR_STEPS.map((step, i) => spellOnLetter(letterAt(base + i), tonicPc + step));
}
