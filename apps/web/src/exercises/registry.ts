import type { ComponentType } from "react";
import { DegreeQuiz } from "./choice/DegreeQuiz";
import { PlayChord } from "./play_chord/PlayChord";
import { PlayProgression } from "./play_progression/PlayProgression";
import type { ExerciseType } from "./schema";
import type { ExerciseProps } from "./types";

/** Exercise type → component. Params schemas live in schema.ts (shared with the build). */
export const EXERCISE_COMPONENTS: Record<ExerciseType, ComponentType<ExerciseProps>> = {
  play_chord: PlayChord,
  play_progression: PlayProgression,
  choice: DegreeQuiz,
};
