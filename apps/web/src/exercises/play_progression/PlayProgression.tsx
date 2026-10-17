import { useMemo } from "react";
import { useInput } from "../../input/store";
import { parseKeyToken } from "../../theory/keys";
import { ChordRun } from "../chords/ChordRun";
import { resolvePlayChord } from "../play_chord/resolve";
import { playProgressionParams } from "../schema";
import type { ExerciseProps } from "../types";

export function PlayProgression({ template, keyToken, onSubmit, rootPosition }: ExerciseProps) {
  const setting = useInput((s) => s.rootPosition);
  const root = rootPosition ?? setting;
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const params = useMemo(() => playProgressionParams.parse(template.params), [template.params]);
  const chords = useMemo(
    () => params.progression.map((chord) => resolvePlayChord({ chord, voicing: params.voicing, constraints: params.constraints }, key, root)),
    [params, key, root],
  );
  return (
    <ChordRun
      template={template}
      keyToken={keyToken}
      musicKey={key}
      chords={chords}
      maxAttemptsPerChord={params.maxAttemptsPerChord}
      onSubmit={onSubmit}
    />
  );
}
