import type { ComponentType } from "react";
import { PlayChord } from "./play_chord/PlayChord";
import type { ExerciseType } from "./schema";
import type { ExerciseProps } from "./types";

/** Exercise type → component. Params schemas live in schema.ts (shared with the build). */
export const EXERCISE_COMPONENTS: Record<ExerciseType, ComponentType<ExerciseProps>> = {
  play_chord: PlayChord,
};
