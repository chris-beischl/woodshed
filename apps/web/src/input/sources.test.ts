import { describe, expect, it } from "vitest";
import { createChordCapture } from "../evaluation/capture";
import { resolveChordSpec } from "../evaluation/presets";
import { createProgressionRunner } from "../evaluation/runner";
import { parseNote } from "../theory/note";
import fixture from "./fixtures/legato-ii-V-I-C.json";
import { decodeMidi } from "./sources";
import type { NoteEvent } from "./types";

describe("decodeMidi", () => {
  it.each([
    [[0x90, 60, 100], { type: "noteOn", midi: 60, velocity: 100, t: 5 }],
    [[0x93, 60, 100], { type: "noteOn", midi: 60, velocity: 100, t: 5 }], // any channel
    [[0x90, 60, 0], { type: "noteOff", midi: 60, t: 5 }], // velocity 0 = note-off
    [[0x80, 60, 64], { type: "noteOff", midi: 60, t: 5 }],
    [[0xb0, 64, 127], { type: "sustain", on: true, t: 5 }],
    [[0xb0, 64, 0], { type: "sustain", on: false, t: 5 }],
    [[0xb0, 7, 100], null], // other CC ignored
    [[0xfe], null], // active sensing
  ])("%j", (bytes, expected) => {
    expect(decodeMidi(new Uint8Array(bytes), 5)).toEqual(expected);
  });
});

describe("replay fixture: legato Dm7 → G7 (F held, sustain pedal down)", () => {
  it("matches both chords on held keys, ignoring the pedal", () => {
    const capture = createChordCapture({ minNotes: 4 });
    const runner = createProgressionRunner([
      resolveChordSpec(parseNote("D"), "m7", "root_position"),
      resolveChordSpec(parseNote("G"), "7", "any"),
    ]);
    for (const e of fixture as NoteEvent[]) capture.push(e).forEach(runner.onCapture);
    capture.advance(10_000).forEach(runner.onCapture);
    const s = runner.state();
    expect(s.done).toBe(true);
    expect(s.chords.map((c) => [c.correct, c.mistakes])).toEqual([[true, 0], [true, 0]]);
  });
});
