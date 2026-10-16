import { describe, expect, it } from "vitest";
import {
  MAJOR_KEYS, MINOR_KEYS, keyForPitchClass, keyToken, keysInIntroOrder, parseKeyToken,
} from "../keys";
import type { Key, Mode } from "../keys";
import { formatNote, parseNote } from "../note";

const names = (ks: Key[]) => ks.map((k) => formatNote(k.tonic));

describe("key set (§3.2)", () => {
  it("major: Gb, not F# (decision #1)", () => {
    expect(names(MAJOR_KEYS).sort()).toEqual(
      ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"].sort(),
    );
    expect(MAJOR_KEYS.every((k) => k.mode === "major")).toBe(true);
  });

  it("minor: C#, F#, G# (not Db, Gb, Ab)", () => {
    expect(names(MINOR_KEYS).sort()).toEqual(
      ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"].sort(),
    );
    expect(MINOR_KEYS.every((k) => k.mode === "minor")).toBe(true);
  });
});

describe("keysInIntroOrder (circle of fourths from C)", () => {
  it("major", () => {
    expect(names(keysInIntroOrder("major"))).toEqual(
      ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"],
    );
  });
  it("minor", () => {
    expect(names(keysInIntroOrder("minor"))).toEqual(
      ["C", "F", "Bb", "Eb", "G#", "C#", "F#", "B", "E", "A", "D", "G"],
    );
  });
  it.each<Mode>(["major", "minor"])("%s keys all have the right mode", (mode) => {
    expect(keysInIntroOrder(mode).every((k) => k.mode === mode)).toBe(true);
  });
});

describe("keyForPitchClass", () => {
  it.each<[number, Mode, string]>([
    [0, "major", "C"], [1, "major", "Db"], [3, "major", "Eb"], [6, "major", "Gb"],
    [8, "major", "Ab"], [10, "major", "Bb"], [11, "major", "B"],
    [0, "minor", "C"], [1, "minor", "C#"], [3, "minor", "Eb"], [6, "minor", "F#"],
    [8, "minor", "G#"], [10, "minor", "Bb"], [11, "minor", "B"],
  ])("%i %s → %s", (pc, mode, name) => {
    const k = keyForPitchClass(pc, mode);
    expect(formatNote(k.tonic)).toBe(name);
    expect(k.mode).toBe(mode);
  });
});

describe("keyToken (§5.3)", () => {
  it.each<[string, Mode, string]>([
    ["C", "major", "C"], ["Db", "major", "Db"], ["Gb", "major", "Gb"], ["Bb", "major", "Bb"],
    ["C#", "minor", "Cs"], ["F#", "minor", "Fs"], ["G#", "minor", "Gs"], ["Eb", "minor", "Eb"],
  ])("%s %s → %s", (tonic, mode, token) => {
    expect(keyToken({ tonic: parseNote(tonic), mode })).toBe(token);
  });

  it.each<Mode>(["major", "minor"])("roundtrips every %s key, tokens are URL-safe ASCII", (mode) => {
    const ks = mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
    for (const k of ks) {
      const tok = keyToken(k);
      expect(tok).toMatch(/^[A-G][bs]?$/);
      expect(parseKeyToken(tok, mode)).toEqual(k);
    }
  });

  it.each<[string, Mode]>([
    ["Fs", "major"], ["Cs", "major"], ["Gs", "major"],
    ["Gb", "minor"], ["Db", "minor"], ["Ab", "minor"],
    ["H", "major"], ["", "minor"], ["Cb", "major"],
  ])("rejects %j in %s", (tok, mode) => {
    expect(() => parseKeyToken(tok, mode)).toThrow();
  });
});
