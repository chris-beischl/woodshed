"""SQLAlchemy models (ARCHITECTURE.md 8.1). Keep in sync with alembic/versions."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class UtcDateTime(TypeDecorator[datetime]):
    """Stores timezone-aware UTC; SQLite drops tzinfo so it is re-attached on read."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class Base(DeclarativeBase):
    pass


class CardRow(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    template_id: Mapped[str] = mapped_column(String, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    variant: Mapped[str | None] = mapped_column(String, nullable=True)
    # NULL while the card is "new" (py-fsrs has no New state).
    fsrs_state: Mapped[dict[str, Any] | None] = mapped_column(
        JSON(none_as_null=True), nullable=True
    )
    due: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True, index=True)
    introduced_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    suspended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    card_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    ts: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    rating: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    content_version: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    lesson_id: Mapped[str] = mapped_column(String, primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)


class SettingsRow(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # always 1
    daily_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    new_card_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.2)
    desired_retention: Mapped[float] = mapped_column(Float, nullable=False, default=0.9)
    timezone: Mapped[str] = mapped_column(String, nullable=False, default="Europe/Berlin")
    day_rollover_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
