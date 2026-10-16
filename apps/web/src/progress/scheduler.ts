/** Thin wrapper around ts-fsrs. The grade → rating mapping lives in evaluation/grading. */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

export type FsrsCard = Card;
export type RatingName = "again" | "hard" | "good" | "easy";
export type CardState = "new" | "learning" | "review" | "relearning";

const RATINGS: Record<RatingName, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
const STATES: Record<State, CardState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

// Fuzzing on, matching the py-fsrs defaults the server used.
const scheduler = (desiredRetention: number) =>
  fsrs(generatorParameters({ request_retention: desiredRetention, enable_fuzz: true }));

export function stateName(card: FsrsCard | null): CardState {
  return card ? STATES[card.state] : "new";
}

/** Apply a review. A null card means the first review: a fresh FSRS card is created. */
export function review(card: FsrsCard | null, rating: RatingName, now: Date, desiredRetention: number): FsrsCard {
  return scheduler(desiredRetention).next(card ?? createEmptyCard(now), now, RATINGS[rating]).card;
}

export function retrievability(card: FsrsCard, now: Date, desiredRetention: number): number {
  return scheduler(desiredRetention).get_retrievability(card, now, false);
}
