import { useMemo } from "react";
import { useInput } from "../../input/store";
import { parseKeyToken } from "../../theory/keys";
import { ChordRun } from "../chords/ChordRun";
import { playChordParams } from "../schema";
import type { ExerciseProps } from "../types";
import { resolvePlayChord } from "./resolve";

export function PlayChord({ template, keyToken, onSubmit, rootPosition }: ExerciseProps) {
  const setting = useInput((s) => s.rootPosition);
  const root = rootPosition ?? setting;
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const chords = useMemo(() => [resolvePlayChord(playChordParams.parse(template.params), key, root)], [template.params, key, root]);
  return <ChordRun template={template} keyToken={keyToken} musicKey={key} chords={chords} onSubmit={onSubmit} />;
}
