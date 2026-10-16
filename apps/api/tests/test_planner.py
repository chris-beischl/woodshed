from datetime import UTC, datetime, timedelta

from woodshed_api.content import Manifest
from woodshed_api.planner import (
    LogEntry,
    PlannerCard,
    PlannerSettings,
    build_plan,
    practice_day_bounds,
)
from woodshed_api.planner.planner import PlanItem, _interleave
from woodshed_api.scheduling.scheduler import review

SETTINGS = PlannerSettings(30, 0.2, 0.9, "Europe/Berlin", 4)
NOW = datetime(2026, 3, 10, 10, 0, tzinfo=UTC)  # 11:00 Berlin


def new_card(template: str, key: str) -> PlannerCard:
    return PlannerCard(f"{template}@{key}", template, key, None, None, False)


def reviewed_card(
    template: str, key: str, reviewed_at: datetime, rating: str = "good", times: int = 3
) -> PlannerCard:
    state = None
    t = reviewed_at
    due = reviewed_at
    for _ in range(times):
        state, due = review(state, rating, t, 5000, 0.9)  # type: ignore[arg-type]
        t = due
    return PlannerCard(f"{template}@{key}", template, key, state, due, False)


def test_day_bounds_and_rollover() -> None:
    start, end = practice_day_bounds(NOW, "Europe/Berlin", 4)
    assert start == datetime(2026, 3, 10, 3, 0, tzinfo=UTC)  # 04:00 CET
    assert end == datetime(2026, 3, 11, 3, 0, tzinfo=UTC)
    # 03:00 local on the 10th belongs to the 9th's practice day.
    early = datetime(2026, 3, 10, 2, 0, tzinfo=UTC)  # 03:00 Berlin
    start, end = practice_day_bounds(early, "Europe/Berlin", 4)
    assert start == datetime(2026, 3, 9, 3, 0, tzinfo=UTC)
    assert end == datetime(2026, 3, 10, 3, 0, tzinfo=UTC)


def test_dst_day_bounds() -> None:
    now = datetime(2026, 3, 29, 12, 0, tzinfo=UTC)  # DST starts 2026-03-29 in Berlin
    start, end = practice_day_bounds(now, "Europe/Berlin", 4)
    assert start == datetime(2026, 3, 29, 2, 0, tzinfo=UTC)  # 04:00 CEST = 02:00Z
    assert end == datetime(2026, 3, 30, 2, 0, tzinfo=UTC)


def test_empty_plan(manifest: Manifest) -> None:
    plan = build_plan(NOW, SETTINGS, manifest, [], [])
    assert plan.items == [] and plan.overflow == 0 and plan.remaining_seconds == 1800


def test_only_new_cards_respects_lesson_and_key_order(manifest: Manifest) -> None:
    cards = [new_card("orphan", "C"), new_card("triads-minor", "C")] + [
        new_card("triads-major", k) for k in ("G", "C", "F")
    ]
    plan = build_plan(NOW, SETTINGS, manifest, cards, [])
    # new bucket = 0.2*1800 = 360s, top-up lets everything in; 5 cards * 10s.
    assert len(plan.items) == 5
    assert all(i.is_new for i in plan.items)
    # Ordering before interleaving: major C, F, G; minor C; orphan C.
    ids = [i.card_id for i in plan.items]
    assert set(ids) == {c.id for c in cards}
    assert ids[0] == "triads-major@C"


def test_new_card_order_is_lesson_then_key(manifest: Manifest) -> None:
    settings = PlannerSettings(1, 1.0, 0.9, "Europe/Berlin", 4)  # 60s budget, 6 cards fit
    cards = [new_card("orphan", "C"), new_card("triads-minor", "C")] + [
        new_card("triads-major", k) for k in ("G", "C", "F", "Bb")
    ]
    plan = build_plan(NOW, settings, manifest, cards, [])
    chosen = {i.card_id for i in plan.items}
    assert chosen == {c.id for c in cards}
    # tighter budget picks the earliest lesson / keys first
    tight = PlannerSettings(1, 1.0, 0.9, "Europe/Berlin", 4)
    logs = [LogEntry(NOW - timedelta(minutes=1), "x", 30_000, "review")]
    plan = build_plan(NOW, tight, manifest, cards, logs)
    assert {i.card_id for i in plan.items} == {
        "triads-major@C",
        "triads-major@F",
        "triads-major@Bb",
    }


def test_due_reviews_scored_and_future_excluded(manifest: Manifest) -> None:
    long_ago = NOW - timedelta(days=30)
    due_old = reviewed_card("triads-major", "C", long_ago)
    due_old_minor = reviewed_card("triads-minor", "C", long_ago)
    future = reviewed_card("triads-major", "F", NOW, times=4)
    assert future.due is not None and future.due > NOW + timedelta(days=2)
    plan = build_plan(NOW, SETTINGS, manifest, [due_old, due_old_minor, future], [])
    ids = [i.card_id for i in plan.items]
    assert ids == ["triads-major@C", "triads-minor@C"]
    assert plan.overflow == 0


def test_due_before_day_end_included(manifest: Manifest) -> None:
    c = reviewed_card("triads-major", "C", NOW - timedelta(days=1), times=1)
    assert c.due is not None
    later = PlannerCard(c.id, c.template_id, c.key, c.fsrs_state, NOW + timedelta(hours=10), False)
    plan = build_plan(NOW, SETTINGS, manifest, [later], [])
    assert [i.card_id for i in plan.items] == [c.id]  # day_end is 03:00Z next day
    too_late = PlannerCard(
        c.id, c.template_id, c.key, c.fsrs_state, NOW + timedelta(hours=20), False
    )
    assert build_plan(NOW, SETTINGS, manifest, [too_late], []).items == []


def test_deprecated_and_suspended_excluded(manifest: Manifest) -> None:
    long_ago = NOW - timedelta(days=30)
    dep = reviewed_card("old-thing", "C", long_ago)
    sus = reviewed_card("triads-major", "C", long_ago)
    sus = PlannerCard(sus.id, sus.template_id, sus.key, sus.fsrs_state, sus.due, True)
    cards = [dep, sus, new_card("old-thing", "F")]
    assert build_plan(NOW, SETTINGS, manifest, cards, []).items == []


def test_overflow(manifest: Manifest) -> None:
    settings = PlannerSettings(1, 0.2, 0.9, "Europe/Berlin", 4)  # 60s -> 6 cards of 10s
    keys = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B"]
    cards = [reviewed_card("triads-major", k, NOW - timedelta(days=30)) for k in keys]
    plan = build_plan(NOW, settings, manifest, cards, [])
    assert len(plan.items) == 6
    assert plan.overflow == 2


def test_budget_partly_spent_today(manifest: Manifest) -> None:
    logs = [
        LogEntry(NOW - timedelta(hours=1), "triads-major", 600_000, "review"),
        LogEntry(NOW - timedelta(hours=2), "triads-major", 60_000, "lesson"),  # ignored
        LogEntry(NOW - timedelta(days=1), "triads-major", 600_000, "review"),  # yesterday
    ]
    plan = build_plan(NOW, SETTINGS, manifest, [], logs)
    assert plan.remaining_seconds == 1200
    exhausted = [LogEntry(NOW - timedelta(hours=1), "triads-major", 3_600_000, "review")]
    cards = [new_card("triads-major", "C")]
    plan = build_plan(NOW, SETTINGS, manifest, cards, exhausted)
    assert plan.remaining_seconds == 0 and plan.items == []


def test_rollover_assigns_logs_to_previous_day(manifest: Manifest) -> None:
    now = datetime(2026, 3, 10, 2, 0, tzinfo=UTC)  # 03:00 Berlin -> practice day of 9th
    logs = [
        LogEntry(datetime(2026, 3, 9, 20, 0, tzinfo=UTC), "triads-major", 300_000, "review"),
        LogEntry(datetime(2026, 3, 9, 1, 0, tzinfo=UTC), "triads-major", 300_000, "review"),
    ]
    plan = build_plan(now, SETTINGS, manifest, [], logs)
    assert plan.remaining_seconds == 1500  # only the 20:00Z log counts


def test_estimate_ema(manifest: Manifest) -> None:
    logs = [
        LogEntry(NOW - timedelta(days=2), "triads-major", 20_000, "review"),
        LogEntry(NOW - timedelta(days=3), "triads-major", 10_000, "review"),  # earlier
    ]
    plan = build_plan(NOW, SETTINGS, manifest, [new_card("triads-major", "C")], logs)
    # chronological: 10s then 20s -> 0.3*20 + 0.7*10 = 13
    assert abs(plan.items[0].estimated_seconds - 13.0) < 1e-9
    other = build_plan(NOW, SETTINGS, manifest, [new_card("triads-minor", "C")], logs)
    assert other.items[0].estimated_seconds == 10


def test_skip_cards_that_do_not_fit(manifest: Manifest) -> None:
    logs = [LogEntry(NOW - timedelta(days=2), "triads-major", 100_000, "review")]
    settings = PlannerSettings(1, 0.5, 0.9, "Europe/Berlin", 4)  # 60s
    cards = [new_card("triads-major", "C"), new_card("triads-minor", "C")]
    plan = build_plan(NOW, settings, manifest, cards, logs)
    assert [i.card_id for i in plan.items] == ["triads-minor@C"]


def test_bucket_split_and_topup(manifest: Manifest) -> None:
    settings = PlannerSettings(1, 0.5, 0.9, "Europe/Berlin", 4)  # 30s reviews, 30s new
    old = NOW - timedelta(days=30)
    reviews = [reviewed_card("triads-major", k, old) for k in ("C", "F", "Bb", "Eb", "Ab")]
    news = [new_card("triads-minor", k) for k in ("C", "F", "Bb", "Eb", "Ab")]
    plan = build_plan(NOW, settings, manifest, reviews + news, [])
    assert sum(not i.is_new for i in plan.items) == 3
    assert sum(i.is_new for i in plan.items) == 3
    # No new cards -> reviews take the whole budget.
    plan = build_plan(NOW, settings, manifest, reviews, [])
    assert len(plan.items) == 5
    big = PlannerSettings(1, 0.5, 0.9, "Europe/Berlin", 4)
    plan = build_plan(NOW, big, manifest, reviews + news[:1], [])
    assert len(plan.items) == 6


def item(template: str, key: str) -> PlanItem:
    return PlanItem(f"{template}@{key}", template, key, 10, False)


def test_interleave_avoids_repeats() -> None:
    items = [
        item("a", "C"), item("a", "F"), item("a", "G"),
        item("b", "C"), item("b", "F"), item("b", "G"),
    ]  # fmt: skip
    out = _interleave(items)
    assert sorted(i.card_id for i in out) == sorted(i.card_id for i in items)
    for p, n in zip(out, out[1:], strict=False):
        assert p.template_id != n.template_id and p.key != n.key


def test_interleave_relaxes_when_impossible() -> None:
    items = [item("a", "C"), item("a", "F"), item("a", "G")]
    out = _interleave(items)
    assert [i.card_id for i in out] == ["a@C", "a@F", "a@G"]
    # same template forced, but keys still alternate
    items = [item("a", "C"), item("a", "C"), item("a", "F")]
    out = _interleave(items)
    assert [i.key for i in out] == ["C", "F", "C"]
