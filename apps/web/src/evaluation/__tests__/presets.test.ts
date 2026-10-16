import { describe, expect, it } from "vitest";
import { PresetError, resolveChordSpec } from "../presets";
import type { Preset } from "../types";
import type { Quality } from "../../theory/chords";
import type { DegreeToken } from "../../theory/degrees";
import { parseNote } from "../../theory/note";

const C = parseNote("C");
const ALL_TOKENS: DegreeToken[] = ["1", "b9", "2", "9", "#9", "b3", "3", "4", "11", "#11", "b5", "5", "#5", "b13", "6", "13", "bb7", "b7", "7"];

/** Roles of the listed tokens; every other token must be absent or "forbidden". */
function expectRoles(spec: ReturnType<typeof resolveChordSpec>, roles: Partial<Record<DegreeToken, string>>) {
  for (const t of ALL_TOKENS) {
    if (t in roles) expect(spec.tones[t], `token ${t}`).toBe(roles[t]);
    else expect([undefined, "forbidden"], `token ${t}`).toContain(spec.tones[t]);
  }
}

describe("resolveChordSpec — any", () => {
  it.each<[Quality, Partial<Record<DegreeToken, string>>]>([
    ["maj", { "1": "required", "3": "required", "5": "optional" }],
    ["m", { "1": "required", b3: "required", "5": "optional" }],
    // decision #3: altered fifths stay required
    ["dim", { "1": "required", b3: "required", b5: "required" }],
    ["aug", { "1": "required", "3": "required", "#5": "required" }],
    ["maj7", { "1": "required", "3": "required", "5": "optional", "7": "required" }],
    ["m7b5", { "1": "required", b3: "required", b5: "required", b7: "required" }],
    ["dim7", { "1": "required", b3: "required", b5: "required", bb7: "required" }],
    ["6", { "1": "required", "3": "required", "5": "optional", "6": "required" }],
    ["7sus4", { "1": "required", "4": "required", "5": "optional", b7: "required" }],
  ])("%s", (q, roles) => {
    const s = resolveChordSpec(C, q, "any");
    expectRoles(s, roles);
    expect(s.extras).toBe("forbid");
    expect(s.allowDoubling).toBe(true);
    expect(s.bass).toBeUndefined();
    expect(s.order).toBeUndefined();
    expect(s.minNotes).toBeUndefined();
    expect(s.quality).toBe(q);
    expect(s.root).toEqual(C);
  });
});

describe("resolveChordSpec — bass presets", () => {
  it.each<[Preset, Quality, DegreeToken[]]>([
    ["root_position", "maj", ["1"]],
    ["root_position", "dim7", ["1"]],
    ["inversion_1", "maj7", ["3"]],
    ["inversion_1", "m7", ["b3"]],
    ["inversion_1", "m", ["b3"]],
    ["inversion_2", "maj7", ["5"]],
    ["inversion_2", "dim", ["b5"]],
    ["inversion_2", "aug", ["#5"]],
    ["inversion_2", "m7b5", ["b5"]],
    ["inversion_3", "maj7", ["7"]],
    ["inversion_3", "7", ["b7"]],
    ["inversion_3", "dim7", ["bb7"]],
    ["inversion_3", "mMaj7", ["7"]],
    ["inversion_3", "6", ["6"]],
    ["inversion_3", "m6", ["6"]],
  ])("%s %s → bass %j, all quality tones required", (p, q, bass) => {
    const s = resolveChordSpec(C, q, p);
    expect(s.bass).toEqual(bass);
    const req = Object.entries(s.tones).filter(([, r]) => r === "required").map(([t]) => t).sort();
    const quality: Record<string, string[]> = {
      maj: ["1", "3", "5"], m: ["1", "b3", "5"], dim: ["1", "b3", "b5"], aug: ["1", "3", "#5"],
      maj7: ["1", "3", "5", "7"], m7: ["1", "b3", "5", "b7"], "7": ["1", "3", "5", "b7"],
      m7b5: ["1", "b3", "b5", "b7"], dim7: ["1", "b3", "b5", "bb7"], mMaj7: ["1", "b3", "5", "7"],
      "6": ["1", "3", "5", "6"], m6: ["1", "b3", "5", "6"],
    };
    expect(req).toEqual([...quality[q]!].sort());
  });
});

describe("resolveChordSpec — shell / guide tones / rootless", () => {
  it.each<[Quality, Partial<Record<DegreeToken, string>>]>([
    ["maj7", { "1": "required", "3": "required", "7": "required" }],
    ["m7", { "1": "required", b3: "required", b7: "required" }],
    ["7", { "1": "required", "3": "required", b7: "required" }],
    ["dim7", { "1": "required", b3: "required", bb7: "required" }],
    ["6", { "1": "required", "3": "required", "6": "required" }], // decision #4
    ["m6", { "1": "required", b3: "required", "6": "required" }],
  ])("shell %s", (q, roles) => {
    const s = resolveChordSpec(C, q, "shell");
    expectRoles(s, roles);
    expect(s.bass).toEqual(["1"]);
  });

  it.each<[Quality, DegreeToken, DegreeToken, DegreeToken]>([
    ["maj7", "3", "7", "5"],
    ["m7", "b3", "b7", "5"],
    ["7", "3", "b7", "5"],
    ["m7b5", "b3", "b7", "b5"],
  ])("guide_tones %s: %s + %s required; 1 and %s forbidden", (q, third, seventh, fifth) => {
    const s = resolveChordSpec(C, q, "guide_tones");
    expect(s.tones[third]).toBe("required");
    expect(s.tones[seventh]).toBe("required");
    expect(s.tones["1"]).toBe("forbidden");
    expect(s.tones[fifth]).toBe("forbidden");
  });

  it.each<[Preset, Quality, DegreeToken[][]]>([
    ["rootless_a", "m7", [["b3"], ["5", "13"], ["b7"], ["9"]]],
    ["rootless_a", "7", [["3"], ["5", "13"], ["b7"], ["9"]]],
    ["rootless_a", "maj7", [["3"], ["5", "13"], ["7"], ["9"]]],
    ["rootless_b", "m7", [["b7"], ["9"], ["b3"], ["5", "13"]]],
    ["rootless_b", "7", [["b7"], ["9"], ["3"], ["5", "13"]]],
    ["rootless_b", "maj7", [["7"], ["9"], ["3"], ["5", "13"]]],
  ])("%s %s", (p, q, order) => {
    const s = resolveChordSpec(C, q, p);
    expect(s.order).toEqual(order);
    expect(s.tones["1"]).toBe("forbidden");
  });
});

describe("resolveChordSpec — unsupported combinations throw PresetError", () => {
  it.each<[Preset, Quality]>([
    ["shell", "maj"], ["shell", "m"], ["shell", "dim"], ["shell", "aug"],
    ["inversion_3", "maj"], ["inversion_3", "m"], ["inversion_3", "dim"], ["inversion_3", "aug"],
    ["rootless_a", "m7b5"], ["rootless_b", "m7b5"], ["rootless_a", "dim7"], ["rootless_b", "dim7"],
    ["rootless_a", "7sus4"], ["rootless_b", "7sus4"], // theory-decisions #8
  ])("%s on %s", (p, q) => {
    expect(() => resolveChordSpec(C, q, p)).toThrow(PresetError);
  });
});

describe("resolveChordSpec — overrides", () => {
  it("override fields replace the resolved ones", () => {
    const s = resolveChordSpec(parseNote("Eb"), "maj7", "any", { allowDoubling: false, maxSpan: 12, extras: "allowAny", minNotes: 4 });
    expect(s.allowDoubling).toBe(false);
    expect(s.maxSpan).toBe(12);
    expect(s.extras).toBe("allowAny");
    expect(s.minNotes).toBe(4);
    expect(s.tones["3"]).toBe("required");
  });
});
