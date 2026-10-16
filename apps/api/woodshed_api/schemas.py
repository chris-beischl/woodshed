"""Pydantic models for all API I/O (the TS client is generated from these)."""

from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

RatingName = Literal["again", "hard", "good", "easy"]
CardStateName = Literal["new", "learning", "review", "relearning"]
Source = Literal["review", "lesson"]


class Health(BaseModel):
    status: Literal["ok"] = "ok"


class PlanItemOut(BaseModel):
    card_id: str
    template_id: str
    key: str
    estimated_seconds: float
    is_new: bool


class NextLessonOut(BaseModel):
    id: str
    title: str
    estimated_minutes: float


class PlanOut(BaseModel):
    items: list[PlanItemOut]
    next_lesson: NextLessonOut | None
    overflow: int
    remaining_seconds: float
    content_version: str


class ReviewIn(BaseModel):
    id: str = Field(min_length=1, description="Client-generated UUID (idempotency key)")
    card_id: str
    rating: RatingName
    duration_ms: int = Field(ge=0)
    attempts: int = Field(ge=0)
    details: dict[str, Any] = Field(default_factory=dict)
    source: Source


class ReviewOut(BaseModel):
    card_id: str
    state: CardStateName
    due: datetime | None


class CardOut(BaseModel):
    id: str
    template_id: str
    key: str
    variant: str | None
    state: CardStateName
    due: datetime | None
    suspended: bool
    introduced_at: datetime


class CardPatch(BaseModel):
    suspended: bool


class LessonCompleteOut(BaseModel):
    lesson_id: str
    cards_created: int


class CardCounts(BaseModel):
    new: int = 0
    learning: int = 0
    review: int = 0
    relearning: int = 0


class KeyStats(BaseModel):
    cards: int
    reviews: int
    again_rate: float


class ProgressOut(BaseModel):
    completed_lessons: list[str]
    card_counts: CardCounts
    per_key: dict[str, KeyStats]


class SettingsModel(BaseModel):
    daily_minutes: int = Field(default=30, ge=1, le=1440)
    new_card_ratio: float = Field(default=0.2, ge=0, le=1)
    desired_retention: float = Field(default=0.9, ge=0.7, le=0.99)
    timezone: str = "Europe/Berlin"
    day_rollover_hour: int = Field(default=4, ge=0, le=23)
    new_cards_per_day: int = Field(default=10, ge=0, le=100)
    keys_in_progress: int = Field(default=4, ge=1, le=12)

    @field_validator("timezone")
    @classmethod
    def _valid_timezone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError, OSError) as e:
            raise ValueError(f"unknown IANA timezone: {v}") from e
        return v
