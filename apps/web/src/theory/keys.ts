import { formatNote, parseNote, pitchClass, type SpelledNote } from "./note";

export type Mode = "major" | "minor";

export interface Key {
  tonic: SpelledNote;
  mode: Mode;
}

// THEORY-DECISION: Gb major instead of F# major (jazz lead-sheet convention).
// See docs/theory-decisions.md #1. Display spelling may change; key tokens may not.
const MAJOR_TONICS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MINOR_TONICS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

export const MAJOR_KEYS: Key[] = MAJOR_TONICS.map((t) => ({ tonic: parseNote(t), mode: "major" }));
export const MINOR_KEYS: Key[] = MINOR_TONICS.map((t) => ({ tonic: parseNote(t), mode: "minor" }));

/** Circle of fourths from C, by pitch class. */
export const KEY_INTRO_PCS: readonly number[] = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];

export function keysOf(mode: Mode): Key[] {
  return mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
}

export function keyForPitchClass(pc: number, mode: Mode): Key {
  const key = keysOf(mode).find((k) => pitchClass(k.tonic) === ((pc % 12) + 12) % 12);
  if (!key) throw new Error(`no ${mode} key for pitch class ${pc}`);
  return key;
}

export function keysInIntroOrder(mode: Mode): Key[] {
  return KEY_INTRO_PCS.map((pc) => keyForPitchClass(pc, mode));
}

/** URL-safe, frozen key token used in card IDs: "C#" → "Cs" (ARCHITECTURE § 5.3). */
export function keyToken(key: Key): string {
  return formatNote(key.tonic).replace("#", "s");
}

export function parseKeyToken(token: string, mode: Mode): Key {
  const key = keysOf(mode).find((k) => keyToken(k) === token);
  if (!key) throw new Error(`unknown ${mode} key token: ${JSON.stringify(token)}`);
  return key;
}

/** Parse a key name as written in content ("C#", "Bb"), restricted to the key set. */
export function parseKeyName(name: string, mode: Mode): Key {
  const key = keysOf(mode).find((k) => formatNote(k.tonic) === name);
  if (!key) throw new Error(`${name} ${mode} is not in the key set`);
  return key;
}

export function formatKey(key: Key): string {
  return formatNote(key.tonic) + (key.mode === "minor" ? "-Moll" : "-Dur");
}
