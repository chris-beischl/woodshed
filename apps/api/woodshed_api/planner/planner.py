"""Daily planner (ARCHITECTURE.md 7). Pure: all inputs, including `now`, are parameters."""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from woodshed_api.content.manifest import Manifest, Template
from woodshed_api.scheduling.scheduler import retrievability

EMA_ALPHA = 0.3
MIN_ESTIMATE_SECONDS = 1.0


@dataclass(frozen=True)
class PlannerSettings:
    daily_minutes: int
    new_card_ratio: float
    desired_retention: float
    timezone: str
    day_rollover_hour: int


@dataclass(frozen=True)
class PlannerCard:
    id: str
    template_id: str
    key: str
    fsrs_state: dict[str, Any] | None
    due: datetime | None
    suspended: bool


@dataclass(frozen=True)
class LogEntry:
    ts: datetime
    template_id: str
    duration_ms: int
    source: str


@dataclass(frozen=True)
class PlanItem:
    card_id: str
    template_id: str
    key: str
    estimated_seconds: float
    is_new: bool


@dataclass(frozen=True)
class Plan:
    items: list[PlanItem]
    overflow: int
    remaining_seconds: float


def practice_day_bounds(
    now: datetime, timezone: str, rollover_hour: int
) -> tuple[datetime, datetime]:
    """(day_start, day_end) in UTC of the practice day containing `now`."""
    tz = ZoneInfo(timezone)
    local = now.astimezone(tz)
    day = local.date()
    if local.time() < time(rollover_hour):
        day -= timedelta(days=1)
    start = datetime.combine(day, time(rollover_hour), tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time(rollover_hour), tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def _estimates(manifest: Manifest, logs: Sequence[LogEntry]) -> dict[str, float]:
    by_template: dict[str, list[LogEntry]] = defaultdict(list)
    for log in logs:
        if log.source == "review":
            by_template[log.template_id].append(log)
    result: dict[str, float] = {}
    for template in manifest.templates:
        entries = sorted(by_template.get(template.id, []), key=lambda e: e.ts)
        if entries:
            ema = entries[0].duration_ms / 1000
            for e in entries[1:]:
                ema = EMA_ALPHA * (e.duration_ms / 1000) + (1 - EMA_ALPHA) * ema
        else:
            ema = float(template.estimated_seconds)
        result[template.id] = max(ema, MIN_ESTIMATE_SECONDS)
    return result


def _interleave(items: list[PlanItem]) -> list[PlanItem]:
    """Greedy: highest-priority remaining item differing from the previous in template and
    key; else relax key, then template; else just the highest priority."""
    remaining = list(items)
    out: list[PlanItem] = []
    while remaining:
        pick = 0
        if out:
            prev = out[-1]
            tiers = [
                [
                    n
                    for n, i in enumerate(remaining)
                    if i.template_id != prev.template_id and i.key != prev.key
                ],
                [n for n, i in enumerate(remaining) if i.template_id != prev.template_id],
                [n for n, i in enumerate(remaining) if i.key != prev.key],
            ]
            pick = next((t[0] for t in tiers if t), 0)
        out.append(remaining.pop(pick))
    return out


def build_plan(
    now: datetime,
    settings: PlannerSettings,
    manifest: Manifest,
    cards: Sequence[PlannerCard],
    logs: Sequence[LogEntry],
) -> Plan:
    day_start, day_end = practice_day_bounds(now, settings.timezone, settings.day_rollover_hour)
    spent = sum(
        log.duration_ms / 1000
        for log in logs
        if log.source == "review" and day_start <= log.ts <= now
    )
    budget = max(0.0, settings.daily_minutes * 60 - spent)
    estimates = _estimates(manifest, logs)
    templates: dict[str, Template] = {t.id: t for t in manifest.templates}

    # Due reviews, scored by importance x (1 - R_now), descending (stable on card id).
    scored: list[tuple[float, PlannerCard]] = []
    for c in cards:
        t = templates.get(c.template_id)
        if (
            c.fsrs_state is None
            or c.due is None
            or c.due > day_end
            or c.suspended
            or t is None
            or t.deprecated
        ):
            continue
        r = retrievability(c.fsrs_state, now, settings.desired_retention)
        scored.append((t.importance * (1 - r), c))
    scored.sort(key=lambda s: (-s[0], s[1].id))
    due_cards = [c for _, c in scored]

    # New cards: lesson order, key introduction order, importance desc.
    lesson_order: dict[str, int] = {}
    for lesson in manifest.lessons:
        for tid in lesson.introduces:
            lesson_order[tid] = min(lesson_order.get(tid, lesson.order), lesson.order)

    def new_sort_key(c: PlannerCard) -> tuple[int, int, int, str]:
        t = templates[c.template_id]
        key_index = t.keys.index(c.key) if c.key in t.keys else len(t.keys)
        return (lesson_order.get(t.id, 10**9), key_index, -t.importance, c.id)

    new_cards = sorted(
        (
            c
            for c in cards
            if c.fsrs_state is None
            and not c.suspended
            and c.template_id in templates
            and not templates[c.template_id].deprecated
        ),
        key=new_sort_key,
    )

    def item(c: PlannerCard, is_new: bool) -> PlanItem:
        return PlanItem(c.id, c.template_id, c.key, estimates[c.template_id], is_new)

    review_items = [item(c, False) for c in due_cards]
    new_items = [item(c, True) for c in new_cards]

    review_cap = (1 - settings.new_card_ratio) * budget
    new_cap = settings.new_card_ratio * budget
    chosen: set[str] = set()
    used = {"review": 0.0, "new": 0.0}

    def take(
        candidates: list[PlanItem], bucket: str, limit: float, total_limit: float | None
    ) -> None:
        for it in candidates:
            if it.card_id in chosen:
                continue
            if used[bucket] + it.estimated_seconds > limit + 1e-9:
                continue
            if total_limit is not None and (
                used["review"] + used["new"] + it.estimated_seconds > total_limit + 1e-9
            ):
                continue
            chosen.add(it.card_id)
            used[bucket] += it.estimated_seconds

    take(review_items, "review", review_cap, None)
    take(new_items, "new", new_cap, None)
    # Unused capacity of either bucket tops up the other (within the total budget).
    take(review_items, "review", budget, budget)
    take(new_items, "new", budget, budget)

    selected = [i for i in review_items + new_items if i.card_id in chosen]
    overflow = sum(1 for i in review_items if i.card_id not in chosen)
    return Plan(items=_interleave(selected), overflow=overflow, remaining_seconds=budget)
