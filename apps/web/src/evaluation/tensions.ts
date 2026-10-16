import type { Quality } from "../theory/chords";
import type { DegreeToken } from "../theory/degrees";

/**
 * Idiomatic tensions per quality, used by `extras: "allowTensions"` (§ 4.1).
 * THEORY-DECISION: docs/theory-decisions.md #5.
 */
export const TENSIONS: Record<Quality, DegreeToken[]> = {
  maj: ["9", "#11", "13"],
  maj7: ["9", "#11", "13"],
  "6": ["9", "#11"],
  m: ["9", "11"],
  m7: ["9", "11", "13"],
  m6: ["9", "11"],
  mMaj7: ["9", "11", "13"],
  "7": ["b9", "9", "#9", "#11", "b13", "13"],
  "7sus4": ["b9", "9", "13"],
  m7b5: ["9", "11", "b13"],
  dim: ["9", "11"],
  dim7: ["9", "11", "b13", "7"],
  aug: ["9", "#11"],
};
