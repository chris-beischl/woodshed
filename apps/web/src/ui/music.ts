import type { Quality } from "../theory/chords";
import type { SpelledNote } from "../theory/note";

/** Typographic accidentals for display only; IDs and logic stay ASCII. */
const GLYPH = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" } as const;

export function displayAccidental(n: SpelledNote): string {
  return GLYPH[n.accidental];
}

export function displayNote(n: SpelledNote): string {
  return n.letter + GLYPH[n.accidental];
}

/** Lead-sheet suffixes: Cmaj7, Cm7♭5, C°7, C+. */
const SUFFIX: Record<Quality, string> = {
  maj: "", m: "m", dim: "°", aug: "+", maj7: "maj7", m7: "m7", "7": "7", m7b5: "m7♭5",
  dim7: "°7", mMaj7: "m(maj7)", "6": "6", m6: "m6", "7sus4": "7sus4",
};

export function displaySuffix(q: Quality): string {
  return SUFFIX[q];
}

/** "bII" → "♭II", "#iv" → "♯iv". */
export function displayNumeral(numeral: string): string {
  return numeral.replace(/^b/, "♭").replace(/^#/, "♯");
}

export function displayKey(key: { tonic: SpelledNote; mode: "major" | "minor" }): string {
  return displayNote(key.tonic) + (key.mode === "minor" ? "-Moll" : "-Dur");
}

/** Degree tokens for feedback text: "b7" → "♭7". */
export function displayDegree(token: string): string {
  return token.replace("bb", "𝄫").replace("b", "♭").replace("#", "♯");
}
