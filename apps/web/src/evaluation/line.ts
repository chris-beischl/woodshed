/** Monophonic line evaluation: scales and licks (ARCHITECTURE § 5.5). Pure. */

export type Step = -1 | 0 | 1;

export interface LineSpec {
  pcs: number[]; // expected pitch classes, in order
  contour: Step[]; // direction of each step; pcs.length - 1 entries
  onMistake: "restart" | "retry";
  maxMistakes: number;
}

export interface LineState {
  position: number; // index of the next expected note
  expected: number | null; // MIDI of the next expected note, once anchored
  mistakes: number;
  failed: boolean;
  done: boolean;
  played: number[]; // correct notes of the current take
  wrong: { position: number; midi: number }[];
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** The MIDI note with pitch class `pc` reached from `from` moving in `step` direction. */
export function nextPitch(from: number, pc: number, step: Step): number {
  const up = from + (mod12(pc - from) || (step === 1 ? 12 : 0));
  const down = from - (mod12(from - pc) || (step === -1 ? 12 : 0));
  if (step === 1) return up;
  if (step === -1) return down;
  return up - from <= from - down ? up : down; // nearest, ties go up
}

export function createLineRunner(spec: LineSpec) {
  let position = 0;
  let expected: number | null = null;
  let mistakes = 0;
  let failed = false;
  let played: number[] = [];
  const wrong: LineState["wrong"] = [];

  const done = () => failed || position >= spec.pcs.length;

  function onNote(midi: number): "correct" | "wrong" | "ignored" {
    if (done()) return "ignored";
    if (spec.onMistake === "retry") {
      // Lenient for scales: warming up before the first correct note, or re-striking the
      // note just played, is not a mistake (ARCHITECTURE § 5.5).
      if (position === 0 && mod12(midi) !== spec.pcs[0]) return "ignored";
      if (midi === played.at(-1)) return "ignored";
    }
    const ok = position === 0 ? mod12(midi) === spec.pcs[0] : midi === expected;
    if (ok) {
      played.push(midi);
      position++;
      expected = position < spec.pcs.length ? nextPitch(midi, spec.pcs[position]!, spec.contour[position - 1]!) : null;
      return "correct";
    }
    mistakes++;
    wrong.push({ position, midi });
    if (mistakes >= spec.maxMistakes) failed = true;
    else if (spec.onMistake === "restart") {
      position = 0;
      expected = null;
      played = [];
    }
    return "wrong";
  }

  function state(): LineState {
    return { position, expected, mistakes, failed, done: done(), played: [...played], wrong: [...wrong] };
  }

  return { onNote, state };
}
