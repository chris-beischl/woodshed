import { degreePitchClass, type DegreeToken } from "../theory/degrees";
import { mod12, pitchClass } from "../theory/note";
import { TENSIONS } from "./tensions";
import type { ChordMatchResult, ChordSpec, ToneRole, Violation } from "./types";

/** Number of required tones — the default `minNotes` (§ 4.4). */
export function requiredCount(spec: ChordSpec): number {
  return Object.values(spec.tones).filter((r) => r === "required").length;
}

/** Pitch class → degree token, from the spec's tones first, then the quality's tensions. */
function degreeMap(spec: ChordSpec): Map<number, DegreeToken> {
  const rootPc = pitchClass(spec.root);
  const map = new Map<number, DegreeToken>();
  for (const token of Object.keys(spec.tones) as DegreeToken[]) map.set(degreePitchClass(rootPc, token), token);
  if (spec.extras === "allowTensions") {
    for (const token of TENSIONS[spec.quality]) {
      const pc = degreePitchClass(rootPc, token);
      if (!map.has(pc)) map.set(pc, token);
    }
  }
  return map;
}

/** ARCHITECTURE § 4.3. Matching is at pitch-class level; MIDI carries no spelling. */
export function matchChord(spec: ChordSpec, midiNotes: number[]): ChordMatchResult {
  const notes = [...new Set(midiNotes)].sort((a, b) => a - b);
  const map = degreeMap(spec);
  const played = notes.map((midi) => ({ midi, degree: map.get(mod12(midi)) ?? null }));

  const present = new Set(played.flatMap((p) => (p.degree ? [p.degree] : [])));
  const role = (t: DegreeToken): ToneRole | undefined => spec.tones[t];
  const tokens = Object.keys(spec.tones) as DegreeToken[];

  const missing = tokens.filter((t) => role(t) === "required" && !present.has(t));
  const forbidden = tokens.filter((t) => role(t) === "forbidden" && present.has(t));
  const unexpected = spec.extras === "allowAny" ? [] : played.filter((p) => p.degree === null).map((p) => p.midi);

  const violations: Violation[] = [];
  const pcs = notes.map(mod12);
  if (!spec.allowDoubling && new Set(pcs).size !== pcs.length) violations.push("doubling");

  const lowest = played[0];
  if (spec.bass && lowest && (lowest.degree === null || !spec.bass.includes(lowest.degree))) violations.push("bass");

  if (spec.order) {
    const sequence: (DegreeToken | null)[] = [];
    for (const p of played) if (!sequence.includes(p.degree)) sequence.push(p.degree);
    const ok =
      sequence.length === spec.order.length &&
      spec.order.every((slot, i) => sequence[i] !== null && slot.includes(sequence[i]!));
    if (!ok) violations.push("order");
  }

  if (spec.maxSpan !== undefined && notes.length > 0 && notes[notes.length - 1]! - notes[0]! > spec.maxSpan) {
    violations.push("span");
  }

  if (notes.length < (spec.minNotes ?? requiredCount(spec))) violations.push("minNotes");

  const correct = missing.length === 0 && forbidden.length === 0 && unexpected.length === 0 && violations.length === 0;
  return { correct, played, missing, forbidden, unexpected, violations };
}
