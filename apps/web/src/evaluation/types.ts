import type { Quality } from "../theory/chords";
import type { DegreeToken } from "../theory/degrees";
import type { SpelledNote } from "../theory/note";

export type ToneRole = "required" | "optional" | "forbidden";
export type Extras = "forbid" | "allowTensions" | "allowAny";

/** Resolved, flat chord specification (ARCHITECTURE § 4.1). */
export interface ChordSpec {
  root: SpelledNote;
  quality: Quality;
  tones: Partial<Record<DegreeToken, ToneRole>>;
  extras: Extras;
  allowDoubling: boolean;
  bass?: DegreeToken[];
  order?: DegreeToken[][];
  maxSpan?: number;
  minNotes?: number;
}

export type Violation = "bass" | "order" | "span" | "doubling" | "minNotes";

export interface ChordMatchResult {
  correct: boolean;
  played: { midi: number; degree: DegreeToken | null }[];
  missing: DegreeToken[];
  forbidden: DegreeToken[];
  unexpected: number[];
  violations: Violation[];
}

export type Preset =
  | "any"
  | "root_position"
  | "inversion_1"
  | "inversion_2"
  | "inversion_3"
  | "shell"
  | "guide_tones"
  | "rootless_a"
  | "rootless_b";

export const PRESETS: readonly Preset[] = [
  "any", "root_position", "inversion_1", "inversion_2", "inversion_3",
  "shell", "guide_tones", "rootless_a", "rootless_b",
];

export type Rating = "again" | "hard" | "good" | "easy";
