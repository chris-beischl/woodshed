import { describe, expect, it } from "vitest";
import { totalMovement, voiceMovement } from "./voiceLeading";

describe("voiceMovement", () => {
  it("C → F in root position moves 15 semitones, via second inversion only 3", () => {
    expect(voiceMovement([60, 64, 67], [65, 69, 72])).toBe(15);
    expect(voiceMovement([60, 64, 67], [60, 65, 69])).toBe(3);
  });
  it("is order-independent and null for different sizes", () => {
    expect(voiceMovement([67, 60, 64], [69, 65, 60])).toBe(3);
    expect(voiceMovement([60, 64, 67], [60, 64, 67, 70])).toBeNull();
  });
  it("sums a whole progression: I–IV–V–I with nearest inversions", () => {
    // C (C E G) → F/C (C F A) → G/B (B D G) → C (C E G)
    expect(totalMovement([[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]])).toBe(3 + 6 + 3);
  });
});
