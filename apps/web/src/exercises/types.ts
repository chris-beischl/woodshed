import type { Rating } from "../evaluation/types";
import type { ManifestTemplate } from "./schema";

export interface ExerciseOutcome {
  rating: Rating;
  durationMs: number;
  attempts: number;
  /** Correct on the first try, not abandoned — feeds the session streak. */
  clean: boolean;
  details: Record<string, unknown>;
}

export interface ExerciseProps {
  template: ManifestTemplate;
  keyToken: string;
  onSubmit(outcome: ExerciseOutcome): void;
  /** Forces "root in bass" on or off (lessons that need it); otherwise the player's setting applies. */
  rootPosition?: boolean;
}
