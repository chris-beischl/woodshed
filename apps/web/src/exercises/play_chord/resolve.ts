import { resolveChordSpec } from "../../evaluation/presets";
import type { ChordSpec, Preset } from "../../evaluation/types";
import { chordSymbol, chordTones } from "../../theory/chords";
import type { Key } from "../../theory/keys";
import { formatNote, type SpelledNote } from "../../theory/note";
import { parseRoman, resolveRoman } from "../../theory/roman";
import type { PlayChordParams } from "../schema";

export interface PlayChordInstance {
  spec: ChordSpec;
  numeral: string; // as written: "V", "bII", "ii"
  symbol: string; // "Ab7"
  roman: string; // "V7"
  tones: SpelledNote[]; // spelled answer, for notation
}

/** Instantiate a play_chord template in one key. Pure; also used by the manifest build. */
export function resolvePlayChord(params: PlayChordParams, key: Key): PlayChordInstance {
  const rn = parseRoman(params.chord);
  const { root, quality } = resolveRoman(key, rn);
  const symbol = chordSymbol(root, quality);
  // Numeral as written ("ii", "bII"); triad quality is conveyed by case, others by suffix.
  const numeral = params.chord.split(":")[0]!;
  const suffix = quality === "maj" || quality === "m" ? "" : symbol.slice(formatNote(root).length);
  return {
    spec: resolveChordSpec(root, quality, params.voicing as Preset, params.constraints),
    symbol,
    numeral,
    roman: numeral + suffix,
    tones: chordTones(root, quality),
  };
}
