import { useMemo } from "react";
import { parseKeyToken } from "../../theory/keys";
import { ChordRun } from "../chords/ChordRun";
import { playChordParams } from "../schema";
import type { ExerciseProps } from "../types";
import { resolvePlayChord } from "./resolve";

export function PlayChord({ template, keyToken, onSubmit }: ExerciseProps) {
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const chords = useMemo(() => [resolvePlayChord(playChordParams.parse(template.params), key)], [template.params, key]);
  return <ChordRun template={template} keyToken={keyToken} musicKey={key} chords={chords} onSubmit={onSubmit} />;
}
