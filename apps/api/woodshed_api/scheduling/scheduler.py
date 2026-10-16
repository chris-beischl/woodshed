"""Thin wrapper around py-fsrs. Rating mapping is client-side; we only map strings."""

from datetime import datetime
from typing import Any, Literal

from fsrs import Card, Rating, Scheduler, State

RatingName = Literal["again", "hard", "good", "easy"]
CardState = Literal["new", "learning", "review", "relearning"]

_RATINGS = {
    "again": Rating.Again,
    "hard": Rating.Hard,
    "good": Rating.Good,
    "easy": Rating.Easy,
}
_STATES: dict[int, CardState] = {
    State.Learning.value: "learning",
    State.Review.value: "review",
    State.Relearning.value: "relearning",
}


def state_name(fsrs_state: dict[str, Any] | None) -> CardState:
    if fsrs_state is None:
        return "new"
    return _STATES[int(fsrs_state["state"])]


def review(
    fsrs_state: dict[str, Any] | None,
    rating: RatingName,
    now: datetime,
    duration_ms: int,
    desired_retention: float,
) -> tuple[dict[str, Any], datetime]:
    """Apply a review. A None state means the first review: a fresh FSRS card is created."""
    scheduler = Scheduler(desired_retention=desired_retention)
    card = Card.from_dict(fsrs_state) if fsrs_state is not None else Card(due=now)  # type: ignore[arg-type]
    updated, _ = scheduler.review_card(card, _RATINGS[rating], now, duration_ms)
    return dict(updated.to_dict()), updated.due


def retrievability(fsrs_state: dict[str, Any], now: datetime, desired_retention: float) -> float:
    scheduler = Scheduler(desired_retention=desired_retention)
    card = Card.from_dict(fsrs_state)  # type: ignore[arg-type]
    return scheduler.get_card_retrievability(card, now)
