import { spellDegree, type DegreeToken } from "./degrees";
import { formatNote, type SpelledNote } from "./note";

export type Quality =
  | "maj" | "m" | "dim" | "aug" | "maj7" | "m7" | "7" | "m7b5" | "dim7" | "mMaj7" | "6" | "m6" | "7sus4";

/** ARCHITECTURE § 3.4. */
export const QUALITY_TONES: Record<Quality, DegreeToken[]> = {
  maj: ["1", "3", "5"],
  m: ["1", "b3", "5"],
  dim: ["1", "b3", "b5"],
  aug: ["1", "3", "#5"],
  maj7: ["1", "3", "5", "7"],
  m7: ["1", "b3", "5", "b7"],
  "7": ["1", "3", "5", "b7"],
  m7b5: ["1", "b3", "b5", "b7"],
  dim7: ["1", "b3", "b5", "bb7"],
  mMaj7: ["1", "b3", "5", "7"],
  "6": ["1", "3", "5", "6"],
  m6: ["1", "b3", "5", "6"],
  "7sus4": ["1", "4", "5", "b7"],
};

export const QUALITIES = Object.keys(QUALITY_TONES) as Quality[];

export function isQuality(s: string): s is Quality {
  return s in QUALITY_TONES;
}

const SUFFIX: Partial<Record<Quality, string>> = { maj: "", m: "m", dim: "dim", aug: "aug", mMaj7: "m(maj7)" };

export function chordTones(root: SpelledNote, quality: Quality): SpelledNote[] {
  return QUALITY_TONES[quality].map((t) => spellDegree(root, t));
}

export function chordSymbol(root: SpelledNote, quality: Quality): string {
  return formatNote(root) + (SUFFIX[quality] ?? quality);
}

/** The quality's own third (3, b3) — or 4 for sus chords. */
export function thirdOf(quality: Quality): DegreeToken {
  return QUALITY_TONES[quality][1]!;
}

export function fifthOf(quality: Quality): DegreeToken {
  return QUALITY_TONES[quality][2]!;
}

/** The quality's seventh (7, b7, bb7), or 6 for 6-chords; undefined for triads. */
export function seventhOf(quality: Quality): DegreeToken | undefined {
  return QUALITY_TONES[quality][3];
}
