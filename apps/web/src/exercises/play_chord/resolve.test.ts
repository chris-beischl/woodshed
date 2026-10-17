import { describe, expect, it } from "vitest";
import { keysInIntroOrder } from "../../theory/keys";
import type { PlayChordParams } from "../schema";
import { resolvePlayChord } from "./resolve";

const params = (voicing: string, chord = "I:maj7", constraints: PlayChordParams["constraints"] = {}): PlayChordParams => ({ chord, voicing, constraints });

describe.each(keysInIntroOrder("major"))("root-in-bass setting in %o", (key) => {
  it("adds or removes the root bass for `any` and `root_position` only", () => {
    for (const voicing of ["any", "root_position"]) {
      expect(resolvePlayChord(params(voicing), key, true).spec.bass).toEqual(["1"]);
      expect(resolvePlayChord(params(voicing), key, false).spec.bass).toBeUndefined();
      // Tones stay as the preset defines them.
      expect(resolvePlayChord(params(voicing), key, false).spec.tones).toEqual(resolvePlayChord(params(voicing), key).spec.tones);
    }
  });

  it("keeps the template as written when unset, and fixed bass rules always", () => {
    expect(resolvePlayChord(params("root_position"), key).spec.bass).toEqual(["1"]);
    expect(resolvePlayChord(params("any"), key).spec.bass).toBeUndefined();
    expect(resolvePlayChord(params("inversion_1", "I:maj"), key, true).spec.bass).toEqual(["3"]);
    expect(resolvePlayChord(params("inversion_2", "I:maj"), key, false).spec.bass).toEqual(["5"]);
    expect(resolvePlayChord(params("any", "I:maj7", { bass: ["3"] }), key, true).spec.bass).toEqual(["3"]);
  });
});
