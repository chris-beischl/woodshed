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

/**
 * The player's "root in bass" choice, for the two presets that differ only there.
 * THEORY-DECISION: other presets (inversions, shells, rootless) and an explicit
 * `constraints.bass` keep their bass rule, since the bass is what they drill. (theory-decisions #17)
 */
function applyRootPosition(spec: ChordSpec, params: PlayChordParams, rootPosition: boolean | undefined): ChordSpec {
  if (rootPosition === undefined || params.constraints.bass || (params.voicing !== "any" && params.voicing !== "root_position")) return spec;
  const { bass: _, ...rest } = spec;
  return rootPosition ? { ...rest, bass: ["1"] } : rest;
}

/**
 * Instantiate a play_chord template in one key. Pure; also used by the manifest build.
 * `rootPosition` undefined = the template as written.
 */
export function resolvePlayChord(params: PlayChordParams, key: Key, rootPosition?: boolean): PlayChordInstance {
  const rn = parseRoman(params.chord);
  const { root, quality } = resolveRoman(key, rn);
  const symbol = chordSymbol(root, quality);
  // Numeral as written ("ii", "bII"); triad quality is conveyed by case, others by suffix.
  const numeral = params.chord.split(":")[0]!;
  const suffix = quality === "maj" || quality === "m" ? "" : symbol.slice(formatNote(root).length);
  return {
    spec: applyRootPosition(resolveChordSpec(root, quality, params.voicing as Preset, params.constraints), params, rootPosition),
    symbol,
    numeral,
    roman: numeral + suffix,
    tones: chordTones(root, quality),
  };
}
