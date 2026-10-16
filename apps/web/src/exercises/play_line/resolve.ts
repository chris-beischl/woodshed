import type { LineSpec } from "../../evaluation/line";
import { spellDegree } from "../../theory/degrees";
import type { Key } from "../../theory/keys";
import { pitchClass, type SpelledNote } from "../../theory/note";
import { resolveRoman } from "../../theory/roman";
import type { PlayLineParams } from "../schema";

export interface PlayLineInstance {
  notes: SpelledNote[]; // spelled by letter arithmetic from the reference root
  spec: LineSpec;
}

/** Instantiate a line in one key. Pure; also used by the manifest build. */
export function resolvePlayLine(params: PlayLineParams, key: Key): PlayLineInstance {
  const root = params.ref === "key" ? key.tonic : resolveRoman(key, params.over[0]!).root;
  const notes = params.notes.map((token) => spellDegree(root, token));
  return {
    notes,
    spec: { pcs: notes.map(pitchClass), contour: params.contour, onMistake: params.onMistake, maxMistakes: params.maxMistakes },
  };
}
