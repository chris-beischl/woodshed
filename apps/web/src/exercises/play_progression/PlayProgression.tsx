import { useMemo } from "react";
import { parseKeyToken } from "../../theory/keys";
import { ChordRun } from "../chords/ChordRun";
import { resolvePlayChord } from "../play_chord/resolve";
import { playProgressionParams } from "../schema";
import type { ExerciseProps } from "../types";

export function PlayProgression({ template, keyToken, onSubmit }: ExerciseProps) {
  const key = useMemo(() => parseKeyToken(keyToken, template.mode), [keyToken, template.mode]);
  const params = useMemo(() => playProgressionParams.parse(template.params), [template.params]);
  const chords = useMemo(
    () => params.progression.map((chord) => resolvePlayChord({ chord, voicing: params.voicing, constraints: params.constraints }, key)),
    [params, key],
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
