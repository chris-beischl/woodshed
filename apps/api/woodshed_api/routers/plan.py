from fastapi import APIRouter
from sqlalchemy import select

from woodshed_api.deps import DbDep, ManifestDep, NowDep, get_settings_row
from woodshed_api.models import CardRow, ReviewLog
from woodshed_api.planner import LogEntry, PlannerCard, PlannerSettings, build_plan
from woodshed_api.schemas import PlanItemOut, PlanOut

router = APIRouter()


@router.get("/plan", response_model=PlanOut)
def get_plan(db: DbDep, manifest: ManifestDep, now: NowDep) -> PlanOut:
    s = get_settings_row(db)
    settings = PlannerSettings(
        s.daily_minutes, s.new_card_ratio, s.desired_retention, s.timezone, s.day_rollover_hour
    )
    cards = [
        PlannerCard(c.id, c.template_id, c.key, c.fsrs_state, c.due, c.suspended)
        for c in db.scalars(select(CardRow))
    ]
    template_of = {c.id: c.template_id for c in cards}
    logs = [
        LogEntry(r.ts, template_of[r.card_id], r.duration_ms, r.source)
        for r in db.scalars(select(ReviewLog))
        if r.card_id in template_of
    ]
    plan = build_plan(now, settings, manifest, cards, logs)
    db.commit()
    return PlanOut(
        items=[
            PlanItemOut(
                card_id=i.card_id,
                template_id=i.template_id,
                key=i.key,
                estimated_seconds=i.estimated_seconds,
                is_new=i.is_new,
            )
            for i in plan.items
        ],
        overflow=plan.overflow,
        remaining_seconds=plan.remaining_seconds,
        content_version=manifest.version,
    )
