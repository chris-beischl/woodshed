import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { matchChord } from "../match";
import { resolveChordSpec } from "../presets";
import type { ChordMatchResult, ChordSpec, Preset } from "../types";
import type { Quality } from "../../theory/chords";
import type { DegreeToken } from "../../theory/degrees";
import { keyForPitchClass } from "../../theory/keys";
import type { Mode } from "../../theory/keys";
import { pitchClass } from "../../theory/note";
import { resolveRoman } from "../../theory/roman";

// Independent literal semitone table (§3.3) — not taken from the implementation.
const SEMIS: Record<DegreeToken, number> = {
  "1": 0, b9: 1, "2": 2, "9": 2, "#9": 3, b3: 3, "3": 4, "4": 5, "11": 5, "#11": 6,
  b5: 6, "5": 7, "#5": 8, b13: 8, "6": 9, "13": 9, bb7: 9, b7: 10, "7": 11,
};

const TRIAD_P: Preset[] = ["any", "root_position", "inversion_1", "inversion_2"];
const SEVENTH_P: Preset[] = [...TRIAD_P, "inversion_3", "shell", "guide_tones"];
const PRESETS_FOR: Record<Quality, Preset[]> = {
  maj: TRIAD_P, m: TRIAD_P, dim: TRIAD_P, aug: TRIAD_P,
  maj7: [...SEVENTH_P, "rootless_a", "rootless_b"],
  m7: [...SEVENTH_P, "rootless_a", "rootless_b"],
  "7": [...SEVENTH_P, "rootless_a", "rootless_b"],
  mMaj7: [...SEVENTH_P, "rootless_a", "rootless_b"],
  m7b5: SEVENTH_P, dim7: SEVENTH_P, "6": SEVENTH_P, m6: SEVENTH_P,
  "7sus4": ["any", "root_position", "inversion_2"],
};

const ROMANS: Record<Mode, string[]> = {
  major: ["I:maj7", "ii:m7", "iii:m7", "IV:maj7", "V:7", "vi:m7", "vii:m7b5", "I:6", "I:maj", "ii:m",
    "vii:dim", "V:7sus4", "bII:7", "bIII:maj7", "bVI:maj7", "bVII:7", "#iv:m7b5", "vii:dim7", "IV:mMaj7"],
  minor: ["i:m7", "i:mMaj7", "i:m6", "i:m", "ii:m7b5", "ii:dim", "bIII:maj7", "bIII:aug", "iv:m7", "V:7",
    "V:maj", "bVI:maj7", "bVII:7", "vii:dim7", "bII:7", "#iv:m7b5"],
};

const caseArb = fc.constantFrom<Mode>("major", "minor").chain((mode) =>
  fc.record({
    mode: fc.constant(mode),
    tonicPc: fc.integer({ min: 0, max: 11 }),
    rn: fc.constantFrom(...ROMANS[mode]),
    pick: fc.nat(),
  }),
);

function specFor(mode: Mode, tonicPc: number, rn: string, pick: number, over?: Partial<ChordSpec>): ChordSpec {
  const { root, quality } = resolveRoman(keyForPitchClass(((tonicPc % 12) + 12) % 12, mode), rn);
  const ps = PRESETS_FOR[quality];
  return resolveChordSpec(root, quality, ps[pick % ps.length]!, over);
}

const norm = (r: ChordMatchResult) => ({
  correct: r.correct,
  degrees: r.played.map((p) => p.degree),
  missing: [...r.missing].sort(),
  forbidden: [...r.forbidden].sort(),
  unexpectedCount: r.unexpected.length,
  violations: [...r.violations].sort(),
});

/** Notes built from spec tones (in random octaves) plus random noise. */
const notesArb = fc.record({
  octaves: fc.array(fc.integer({ min: 3, max: 6 }), { minLength: 0, maxLength: 6 }),
  noise: fc.uniqueArray(fc.integer({ min: 40, max: 84 }), { maxLength: 2 }),
  take: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
});

function buildNotes(spec: ChordSpec, a: { octaves: number[]; noise: number[]; take: boolean[] }): number[] {
  const toks = (Object.keys(spec.tones) as DegreeToken[]).filter((t) => spec.tones[t] !== "forbidden");
  const rootPc = pitchClass(spec.root);
  const out = new Set<number>(a.noise);
  toks.forEach((t, i) => {
    if (a.take[i % a.take.length]) out.add(12 * (a.octaves[i % Math.max(1, a.octaves.length)] ?? 4) + ((rootPc + SEMIS[t]) % 12));
  });
  return [...out];
}

describe("property: transposition invariance (§9)", () => {
  it("N matches S in k ⇔ N+n matches the same numeral in k+n", () => {
    fc.assert(
      fc.property(caseArb, notesArb, fc.integer({ min: -12, max: 12 }), (c, na, n) => {
        const s1 = specFor(c.mode, c.tonicPc, c.rn, c.pick);
        const s2 = specFor(c.mode, c.tonicPc + n, c.rn, c.pick);
        const notes = buildNotes(s1, na);
        const r1 = matchChord(s1, notes);
        const r2 = matchChord(s2, notes.map((m) => m + n));
        expect(norm(r2)).toEqual(norm(r1));
        expect([...r2.unexpected].sort((x, y) => x - y)).toEqual([...r1.unexpected].map((m) => m + n).sort((x, y) => x - y));
      }),
      { numRuns: 500 },
    );
  });
});

describe("property: input-order independence (§9)", () => {
  it("shuffling the held notes never changes the result", () => {
    fc.assert(
      fc.property(
        caseArb,
        notesArb,
        fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), { minLength: 12, maxLength: 12 }),
        (c, na, keys) => {
          const s = specFor(c.mode, c.tonicPc, c.rn, c.pick);
          const notes = buildNotes(s, na);
          const shuffled = notes
            .map((m, i) => [keys[i % keys.length]! + i / 100, m] as const)
            .sort((x, y) => x[0] - y[0])
            .map(([, m]) => m);
          const r1 = matchChord(s, notes);
          const r2 = matchChord(s, shuffled);
          expect(r2.played).toEqual(r1.played);
          expect(norm(r2)).toEqual(norm(r1));
          expect([...r2.unexpected].sort()).toEqual([...r1.unexpected].sort());
        },
      ),
      { numRuns: 500 },
    );
  });

  it("played is always sorted ascending", () => {
    fc.assert(
      fc.property(caseArb, notesArb, (c, na) => {
        const s = specFor(c.mode, c.tonicPc, c.rn, c.pick);
        const mids = matchChord(s, buildNotes(s, na)).played.map((p) => p.midi);
        expect(mids).toEqual([...mids].sort((x, y) => x - y));
      }),
    );
  });
});

describe("property: octave doubling (§9)", () => {
  it("doubling a required tone an octave up only adds doubling/span violations", () => {
    fc.assert(
      fc.property(
        caseArb,
        fc.boolean(),
        fc.option(fc.integer({ min: 10, max: 30 }), { nil: undefined }),
        fc.nat(),
        (c, allowDoubling, maxSpan, which) => {
          const s0 = specFor(c.mode, c.tonicPc, c.rn, c.pick);
          fc.pre(s0.order === undefined);
          const spec: ChordSpec = { ...s0, allowDoubling, maxSpan };
          const req = (Object.keys(spec.tones) as DegreeToken[]).filter((t) => spec.tones[t] === "required");
          const first = spec.bass?.[0];
          const ordered = first ? [first, ...req.filter((t) => t !== first)] : req;
          const rootPc = pitchClass(spec.root);
          // stack required tones upward from octave 3, bass tone first
          const voicing: number[] = [];
          for (const t of ordered) {
            const pc = (rootPc + SEMIS[t]) % 12;
            let m = 48 + pc;
            while (voicing.length && m <= voicing[voicing.length - 1]!) m += 12;
            voicing.push(m);
          }
          const baseR = matchChord(spec, voicing);
          // sanity: the base voicing is correct apart from a possible span violation
          expect(baseR.missing).toEqual([]);
          expect(baseR.forbidden).toEqual([]);
          expect(baseR.unexpected).toEqual([]);
          expect(baseR.violations.filter((v) => v !== "span")).toEqual([]);

          const src = voicing[which % voicing.length]!;
          const doubled = [...voicing, src + 12].filter((m, i, xs) => xs.indexOf(m) === i);
          fc.pre(doubled.length === voicing.length + 1);
          const r = matchChord(spec, doubled);
          const span = Math.max(...doubled) - Math.min(...doubled);
          expect(r.missing).toEqual([]);
          expect(r.forbidden).toEqual([]);
          expect(r.unexpected).toEqual([]);
          expect(r.violations.includes("doubling")).toBe(!allowDoubling);
          expect(r.violations.includes("span")).toBe(maxSpan !== undefined && span > maxSpan);
          expect(r.violations.filter((v) => v !== "doubling" && v !== "span")).toEqual([]);
        },
      ),
      { numRuns: 500 },
    );
  });
});
