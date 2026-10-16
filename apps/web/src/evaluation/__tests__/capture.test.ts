import { describe, expect, it } from "vitest";
import { createChordCapture } from "../capture";
import type { CaptureEvent } from "../capture";
import type { NoteEvent } from "../../input/types";

const on = (midi: number, t: number): NoteEvent => ({ type: "noteOn", midi, velocity: 80, t });
const off = (midi: number, t: number): NoteEvent => ({ type: "noteOff", midi, t });
const ped = (isOn: boolean, t: number): NoteEvent => ({ type: "sustain", on: isOn, t });

/** Strip timestamps: kind + notes only. */
const strip = (es: CaptureEvent[]) => es.map((e) => ({ kind: e.kind, notes: e.notes }));

/** Push all events, then advance to `until`; collect everything emitted. */
function run(events: NoteEvent[], until: number, opts?: { settleMs?: number; minNotes?: number }) {
  const cap = createChordCapture(opts);
  const out: CaptureEvent[] = [];
  for (const e of events) out.push(...cap.push(e));
  out.push(...cap.advance(until));
  return { out, cap };
}

describe("settling", () => {
  it("jittered onsets (0–40 ms) group into one settled chord at lastOnset + 120", () => {
    const cap = createChordCapture();
    expect(cap.push(on(60, 1000))).toEqual([]);
    expect(cap.push(on(67, 1032))).toEqual([]);
    expect(cap.push(on(64, 1017 + 23))).toEqual([]); // last onset at 1040
    expect(cap.advance(1159)).toEqual([]);
    expect(cap.advance(1160)).toEqual([{ kind: "settled", notes: [60, 64, 67], t: 1160 }]);
    expect(cap.advance(2000)).toEqual([]); // emitted once
    expect(cap.held()).toEqual([60, 64, 67]);
  });

  it.each<[string, number[]]>([
    ["simultaneous", [0, 0, 0, 0]],
    ["rolled 40 ms", [0, 13, 27, 40]],
    ["max gap 119 ms", [0, 119, 238, 357]],
  ])("%s onsets → one settled chord", (_l, ts) => {
    const notes = [61, 65, 68, 72];
    const { out } = run(notes.map((m, i) => on(m, ts[i]!)), 5000);
    expect(strip(out)).toEqual([{ kind: "settled", notes: [61, 65, 68, 72] }]);
  });

  it("an onset gap of exactly settleMs settles the partial chord first", () => {
    const { out } = run([on(60, 0), on(64, 120)], 1000);
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [60] },
      { kind: "committed", notes: [60] },
      { kind: "settled", notes: [60, 64] },
    ]);
  });

  it("custom settleMs", () => {
    const cap = createChordCapture({ settleMs: 50 });
    cap.push(on(60, 0));
    expect(cap.advance(49)).toEqual([]);
    expect(strip(cap.advance(50))).toEqual([{ kind: "settled", notes: [60] }]);
  });

  it("push flushes pending timers up to the event time before applying it", () => {
    const cap = createChordCapture();
    cap.push(on(60, 0));
    cap.push(on(64, 10));
    cap.push(on(67, 20));
    // no advance() call: the next note-on at 500 must first emit the settled chord (t=140), then commit it
    const es = cap.push(on(71, 500));
    expect(es).toEqual([
      { kind: "settled", notes: [60, 64, 67], t: 140 },
      { kind: "committed", notes: [60, 64, 67], t: 500 },
    ]);
  });

  it("note-offs alone never emit a settled chord", () => {
    const cap = createChordCapture();
    [on(60, 0), on(64, 5), on(67, 10), on(71, 15)].forEach((e) => cap.push(e));
    cap.advance(200);
    cap.push(off(71, 300)); // commits
    expect(cap.advance(1000)).toEqual([]);
    cap.push(off(67, 1100));
    expect(cap.advance(5000)).toEqual([]);
  });

  it("note released before the timer expires is not in the settled chord", () => {
    const { out } = run([on(60, 0), on(64, 10), on(67, 20), off(67, 60)], 1000);
    expect(strip(out)).toEqual([{ kind: "settled", notes: [60, 64] }]);
  });

  it("a staccato tap released before settling emits nothing", () => {
    const { out } = run([on(60, 0), on(64, 8), off(60, 60), off(64, 62)], 1000);
    expect(out).toEqual([]);
  });

  it("settled notes are sorted ascending regardless of press order", () => {
    const { out } = run([on(72, 0), on(60, 3), on(67, 6), on(64, 9)], 1000);
    expect(out[0]!.notes).toEqual([60, 64, 67, 72]);
  });
});

describe("committing (accept fast, reject slowly)", () => {
  it("first note-off after settling commits the settled chord", () => {
    const cap = createChordCapture();
    [on(60, 0), on(63, 12), on(67, 25)].forEach((e) => cap.push(e));
    cap.advance(300);
    expect(cap.push(off(63, 400))).toEqual([{ kind: "committed", notes: [60, 63, 67], t: 400 }]);
    expect(cap.push(off(60, 410))).toEqual([]); // only the first release commits
    expect(cap.push(off(67, 420))).toEqual([]);
  });

  it("a new onset after settling commits the settled chord", () => {
    const cap = createChordCapture();
    [on(60, 0), on(64, 12)].forEach((e) => cap.push(e));
    cap.advance(300);
    expect(strip(cap.push(on(67, 400)))).toEqual([{ kind: "committed", notes: [60, 64] }]);
  });

  it("nothing is committed if the chord never settled", () => {
    const { out } = run([on(60, 0), on(64, 50), off(64, 100), off(60, 110)], 2000);
    expect(out).toEqual([]);
  });

  it("the same pitch set committed twice in a row counts once", () => {
    const { out } = run(
      [
        on(60, 0), on(64, 10), on(67, 20), off(60, 500), off(64, 505), off(67, 510), // commit CEG
        on(60, 1000), on(64, 1010), on(67, 1020), off(60, 1500), // same set again → no second commit
      ],
      3000,
    );
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [60, 64, 67] },
      { kind: "committed", notes: [60, 64, 67] },
      { kind: "settled", notes: [60, 64, 67] },
    ]);
  });

  it("A, B, A commits A again (only consecutive duplicates are suppressed)", () => {
    const { out } = run(
      [
        on(60, 0), on(64, 10), off(60, 300), off(64, 300),
        on(62, 600), on(65, 610), off(62, 900), off(65, 900),
        on(60, 1200), on(64, 1210), off(60, 1500), off(64, 1500),
      ],
      3000,
    );
    expect(strip(out).filter((e) => e.kind === "committed").map((e) => e.notes)).toEqual([
      [60, 64], [62, 65], [60, 64],
    ]);
  });
});

describe("legato voice leading with held common tones", () => {
  it("C–E–G → hold G, play B–D–F: G7 settles with the held G", () => {
    const { out } = run(
      [
        on(60, 0), on(64, 14), on(67, 31),
        off(60, 900), off(64, 904), // commit CEG (runner ignores it if it matched)
        on(59, 910), on(62, 925), on(65, 948),
      ],
      3000,
    );
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [60, 64, 67] },
      { kind: "committed", notes: [60, 64, 67] },
      { kind: "settled", notes: [59, 62, 65, 67] },
    ]);
  });

  it("new chord pressed before old keys are released (overlapping legato)", () => {
    const cap = createChordCapture();
    const out: CaptureEvent[] = [];
    // Dm7 (D F A C) → G7 (B D F G): F and D are common tones and stay held
    for (const e of [on(62, 0), on(65, 10), on(69, 22), on(72, 35)]) out.push(...cap.push(e));
    out.push(...cap.advance(400));
    out.push(...cap.push(on(71, 1000))); // B pressed while A, C still down → commits Dm7
    out.push(...cap.push(on(67, 1012)));
    out.push(...cap.push(off(69, 1020)));
    out.push(...cap.push(off(72, 1030)));
    out.push(...cap.advance(2000));
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [62, 65, 69, 72] },
      { kind: "committed", notes: [62, 65, 69, 72] },
      { kind: "settled", notes: [62, 65, 67, 71] }, // timer from G at 1012 expires at 1132
    ]);
    expect(cap.held()).toEqual([62, 65, 67, 71]);
  });
});

describe("finger-by-finger building and minNotes", () => {
  it("default minNotes = 1: a slow partial chord settles and is committed by the next onset", () => {
    const { out } = run([on(60, 0), on(64, 500), on(67, 1000), on(71, 1500)], 3000);
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [60] },
      { kind: "committed", notes: [60] },
      { kind: "settled", notes: [60, 64] },
      { kind: "committed", notes: [60, 64] },
      { kind: "settled", notes: [60, 64, 67] },
      { kind: "committed", notes: [60, 64, 67] },
      { kind: "settled", notes: [60, 64, 67, 71] },
    ]);
  });

  it("minNotes protects partial chords below the threshold: they neither settle nor commit", () => {
    const { out } = run([on(60, 0), on(64, 500), off(64, 700), on(64, 900), on(67, 1400), on(71, 1900)], 3000, { minNotes: 4 });
    expect(strip(out)).toEqual([{ kind: "settled", notes: [60, 64, 67, 71] }]);
  });

  it("minNotes does NOT protect a partial chord that already reaches it: extending commits it", () => {
    // Cmaj7 built slowly with minNotes 3: C-E-G settles (3 notes) and adding B commits C-E-G
    const { out } = run([on(60, 0), on(64, 500), on(67, 1000), on(71, 1500)], 3000, { minNotes: 3 });
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [60, 64, 67] },
      { kind: "committed", notes: [60, 64, 67] },
      { kind: "settled", notes: [60, 64, 67, 71] },
    ]);
  });

  it("partial chord fast enough (< settleMs per finger) never settles early", () => {
    const { out } = run([on(60, 0), on(64, 100), on(67, 200), on(71, 300)], 3000, { minNotes: 1 });
    expect(strip(out)).toEqual([{ kind: "settled", notes: [60, 64, 67, 71] }]);
  });

  it("releasing down to below minNotes after a settle still commits the settled chord", () => {
    const { out } = run([on(60, 0), on(64, 10), on(67, 20), off(67, 500)], 3000, { minNotes: 3 });
    expect(strip(out)).toEqual([
      { kind: "settled", notes: [60, 64, 67] },
      { kind: "committed", notes: [60, 64, 67] },
    ]);
  });
});

describe("sustain pedal and bookkeeping", () => {
  const seq: NoteEvent[] = [
    on(60, 0), on(64, 14), on(67, 31), off(60, 900), off(64, 904),
    on(59, 910), on(62, 925), on(65, 948), off(59, 1500), off(62, 1500), off(65, 1500), off(67, 1500),
  ];

  it("sustain events never change the output", () => {
    const withPedal: NoteEvent[] = [
      ped(true, 0), seq[0]!, seq[1]!, ped(false, 20), seq[2]!, ped(true, 500), seq[3]!, seq[4]!,
      seq[5]!, ped(false, 915), seq[6]!, seq[7]!, ped(true, 1200), ...seq.slice(8), ped(false, 1600),
    ];
    expect(strip(run(withPedal, 3000).out)).toEqual(strip(run(seq, 3000).out));
  });

  it("sustain alone emits nothing and holds nothing", () => {
    const { out, cap } = run([ped(true, 0), ped(false, 500)], 2000);
    expect(out).toEqual([]);
    expect(cap.held()).toEqual([]);
  });

  it("held() reflects physically held keys, sorted", () => {
    const cap = createChordCapture();
    cap.push(on(67, 0));
    cap.push(on(60, 1));
    cap.push(ped(true, 2));
    expect(cap.held()).toEqual([60, 67]);
    cap.push(off(67, 3));
    expect(cap.held()).toEqual([60]); // pedal does not keep it "held"
  });

  it("note-off for a key that is not held is harmless", () => {
    const cap = createChordCapture();
    expect(() => cap.push(off(61, 0))).not.toThrow();
    expect(cap.held()).toEqual([]);
    expect(cap.advance(1000)).toEqual([]);
  });
});
