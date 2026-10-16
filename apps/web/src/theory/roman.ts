import { isQuality, type Quality } from "./chords";
import type { Key } from "./keys";
import { LETTERS, mod12, naturalPitchClass, pitchClass, spellOnLetter, type SpelledNote } from "./note";
import { majorScale } from "./scale";

export interface RomanNumeral {
  accidental: -1 | 0 | 1;
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  quality: Quality;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

export function parseRoman(s: string): RomanNumeral {
  const m = /^(b|#)?([ivIV]+):(.+)$/.exec(s.trim());
  const degree = m ? NUMERALS.indexOf(m[2]!.toUpperCase()) + 1 : 0;
  if (!m || degree === 0) throw new Error(`invalid roman numeral: ${JSON.stringify(s)}`);
  const quality = m[3]!;
  if (!isQuality(quality)) throw new Error(`unknown chord quality in ${JSON.stringify(s)}: ${quality}`);
  return {
    accidental: m[1] === "b" ? -1 : m[1] === "#" ? 1 : 0,
    degree: degree as RomanNumeral["degree"],
    quality,
  };
}

export function formatRoman(rn: RomanNumeral): string {
  const acc = rn.accidental === -1 ? "b" : rn.accidental === 1 ? "#" : "";
  return acc + NUMERALS[rn.degree - 1];
}

/**
 * THEORY-DECISION: a *chromatic* root (written with b/#) that would need a double
 * accidental is respelled to the enharmonic note with the fewest accidentals, flats
 * preferred on a tie (bII:7 in Gb → G7, not Abb7). Diatonic roots keep their spelling
 * (vii:dim7 in G# minor stays F##dim7). docs/theory-decisions.md #2.
 */
function simplestSpelling(pc: number): SpelledNote {
  const candidates = LETTERS.map((letter) => {
    const acc = mod12(pc - naturalPitchClass(letter));
    return { letter, acc: acc > 6 ? acc - 12 : acc };
  })
    .filter(({ acc }) => Math.abs(acc) <= 1)
    .sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc) || a.acc - b.acc);
  return spellOnLetter(candidates[0]!.letter, pc);
}

/** Accidental is relative to the MAJOR scale of the tonic, regardless of mode (§ 3.5). */
export function resolveRoman(key: Key, rn: string | RomanNumeral): { root: SpelledNote; quality: Quality } {
  const parsed = typeof rn === "string" ? parseRoman(rn) : rn;
  const degreeNote = majorScale(key.tonic)[parsed.degree - 1]!;
  const accidental = degreeNote.accidental + parsed.accidental;
  const root =
    parsed.accidental !== 0 && Math.abs(accidental) >= 2
      ? simplestSpelling(pitchClass(degreeNote) + parsed.accidental)
      : { letter: degreeNote.letter, accidental: accidental as SpelledNote["accidental"] };
  return { root, quality: parsed.quality };
}
