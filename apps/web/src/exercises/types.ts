import type { Rating } from "../evaluation/types";
import type { ManifestTemplate } from "./schema";

export interface ExerciseOutcome {
  rating: Rating;
  durationMs: number;
  attempts: number;
  details: Record<string, unknown>;
}

export interface ExerciseProps {
  template: ManifestTemplate;
  keyToken: string;
  onSubmit(outcome: ExerciseOutcome): void;
}
