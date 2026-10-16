import type { CaptureEvent } from "./capture";
import { matchChord } from "./match";
import type { ChordMatchResult, ChordSpec } from "./types";

export interface ChordProgress {
  mistakes: number;
  failed: boolean;
  correct: boolean;
  results: ChordMatchResult[];
}

export interface RunnerState {
  index: number;
  done: boolean;
  chords: ChordProgress[];
}

/** ARCHITECTURE § 4.5: accept on a matching settled chord, count committed mismatches. */
export function createProgressionRunner(specs: ChordSpec[], opts: { maxAttemptsPerChord?: number } = {}) {
  const maxAttempts = opts.maxAttemptsPerChord ?? 3;
  const chords: ChordProgress[] = specs.map(() => ({ mistakes: 0, failed: false, correct: false, results: [] }));
  let index = 0;
  // A commit only counts if that same note set settled while this chord was expected;
  // otherwise releasing the previous (accepted) chord would count against the next one.
  let candidate: string | null = null;

  function onCapture(e: CaptureEvent): void {
    const spec = specs[index];
    const chord = chords[index];
    if (!spec || !chord) return;
    const result = matchChord(spec, e.notes);
    const id = e.notes.join(",");
    if (e.kind === "settled") {
      if (result.correct) {
        chord.correct = true;
        chord.results.push(result);
        index++;
        candidate = null;
      } else {
        candidate = id;
      }
    } else if (id === candidate && !result.correct) {
      candidate = null;
      chord.mistakes++;
      chord.results.push(result);
      if (chord.mistakes >= maxAttempts) {
        chord.failed = true;
        index++;
      }
    }
  }

  function state(): RunnerState {
    return { index, done: index >= specs.length, chords: chords.map((c) => ({ ...c, results: [...c.results] })) };
  }

  return { onCapture, state };
}
