import { describe, expect, it } from "vitest";
import { createProgressionRunner } from "../runner";
import { resolveChordSpec } from "../presets";
import type { CaptureEvent } from "../capture";
import { parseNote } from "../../theory/note";

// ii–V–I in C, preset any
const specs = [
  resolveChordSpec(parseNote("D"), "m7", "any"),
  resolveChordSpec(parseNote("G"), "7", "any"),
  resolveChordSpec(parseNote("C"), "maj7", "any"),
];
const Dm7 = [62, 65, 69, 72];
const G7 = [59, 62, 65, 67];
const Cmaj7 = [60, 64, 67, 71];
const WRONG = [62, 66, 69, 72]; // D7 instead of Dm7
const WRONG2 = [62, 65, 68, 72]; // Dm7b5

let t = 0;
const settled = (notes: number[]): CaptureEvent => ({ kind: "settled", notes, t: (t += 200) });
const committed = (notes: number[]): CaptureEvent => ({ kind: "committed", notes, t: (t += 200) });
/** What capture actually emits for a wrong chord: settled, then committed on release. */
const miss = (r: { onCapture(e: CaptureEvent): void }, notes: number[]) => {
  r.onCapture(settled(notes));
  r.onCapture(committed(notes));
};

describe("createProgressionRunner", () => {
  it("initial state", () => {
    const r = createProgressionRunner(specs);
    const s = r.state();
    expect(s.index).toBe(0);
    expect(s.done).toBe(false);
    expect(s.chords).toHaveLength(3);
    expect(s.chords[0]).toMatchObject({ mistakes: 0, failed: false, correct: false });
  });

  it("matching settled chords advance immediately; clean run is done", () => {
    const r = createProgressionRunner(specs);
    r.onCapture(settled(Dm7));
    expect(r.state().index).toBe(1);
    expect(r.state().chords[0]).toMatchObject({ correct: true, mistakes: 0, failed: false });
    r.onCapture(settled(G7));
    r.onCapture(settled(Cmaj7));
    const s = r.state();
    expect(s.index).toBe(3);
    expect(s.done).toBe(true);
    expect(s.chords.every((c) => c.correct && !c.failed)).toBe(true);
  });

  it("settled mismatch is not a mistake yet; committed mismatch is", () => {
    const r = createProgressionRunner(specs);
    r.onCapture(settled(WRONG));
    expect(r.state().chords[0]).toMatchObject({ mistakes: 0, failed: false, correct: false });
    expect(r.state().index).toBe(0);
    r.onCapture(committed(WRONG));
    const c = r.state().chords[0]!;
    expect(c.mistakes).toBe(1);
    expect(c.results).toHaveLength(1);
    expect(c.results[0]!.correct).toBe(false);
    expect(r.state().index).toBe(0);
    // then corrected
    r.onCapture(settled(Dm7));
    expect(r.state().index).toBe(1);
    expect(r.state().chords[0]).toMatchObject({ correct: true, mistakes: 1, failed: false });
  });

  it("committed match is ignored", () => {
    const r = createProgressionRunner(specs);
    r.onCapture(committed(Dm7));
    expect(r.state().index).toBe(0);
    expect(r.state().chords[0]!.mistakes).toBe(0);
  });

  it("committed without a matching settled event for the current chord is not a mistake", () => {
    const r = createProgressionRunner(specs);
    r.onCapture(committed(WRONG)); // never settled while Dm7 was expected
    expect(r.state().chords[0]!.mistakes).toBe(0);
    r.onCapture(settled(WRONG2));
    r.onCapture(committed(WRONG)); // a different set settled
    expect(r.state().chords[0]!.mistakes).toBe(0);
    r.onCapture(committed(WRONG2));
    expect(r.state().chords[0]!.mistakes).toBe(1);
  });

  it("fails and advances after maxAttemptsPerChord (default 3) committed mistakes", () => {
    const r = createProgressionRunner(specs);
    miss(r, WRONG);
    miss(r, WRONG2);
    expect(r.state().index).toBe(0);
    miss(r, WRONG);
    const s = r.state();
    expect(s.chords[0]).toMatchObject({ mistakes: 3, failed: true, correct: false });
    expect(s.index).toBe(1);
    expect(s.done).toBe(false);
  });

  it("maxAttemptsPerChord option", () => {
    const r = createProgressionRunner(specs, { maxAttemptsPerChord: 1 });
    miss(r, WRONG);
    expect(r.state().chords[0]).toMatchObject({ mistakes: 1, failed: true });
    expect(r.state().index).toBe(1);
  });

  it("evaluates against the current chord only", () => {
    const r = createProgressionRunner(specs);
    r.onCapture(settled(G7)); // right chord, wrong time
    expect(r.state().index).toBe(0);
    r.onCapture(committed(G7));
    expect(r.state().chords[0]!.mistakes).toBe(1);
    expect(r.state().chords[1]!.mistakes).toBe(0);
  });

  it("realistic clean ii–V–I stream (each accepted chord is later committed by capture) has no mistakes", () => {
    // Capture (§4.4) also commits the chord the runner just accepted; that commit must not count
    // against the next chord (it never settled while the next chord was expected).
    const r = createProgressionRunner(specs);
    r.onCapture(settled(Dm7));
    r.onCapture(committed(Dm7));
    r.onCapture(settled(G7));
    r.onCapture(committed(G7));
    r.onCapture(settled(Cmaj7));
    const s = r.state();
    expect(s.done).toBe(true);
    expect(s.chords.map((c) => c.mistakes)).toEqual([0, 0, 0]);
  });

  it("done after the last chord fails", () => {
    const r = createProgressionRunner([specs[2]!], { maxAttemptsPerChord: 2 });
    miss(r, WRONG);
    miss(r, WRONG2);
    expect(r.state()).toMatchObject({ index: 1, done: true });
    expect(r.state().chords[0]).toMatchObject({ failed: true, correct: false });
  });
});
