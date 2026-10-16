from collections import defaultdict

from fastapi import APIRouter
from sqlalchemy import select

from woodshed_api.deps import DbDep
from woodshed_api.models import CardRow, LessonProgress, ReviewLog
from woodshed_api.scheduling.scheduler import state_name
from woodshed_api.schemas import CardCounts, KeyStats, ProgressOut

router = APIRouter()


@router.get("/progress", response_model=ProgressOut)
def get_progress(db: DbDep) -> ProgressOut:
    lessons = list(
        db.scalars(select(LessonProgress.lesson_id).order_by(LessonProgress.completed_at))
    )
    counts = CardCounts()
    key_of: dict[str, str] = {}
    cards_per_key: dict[str, int] = defaultdict(int)
    for c in db.scalars(select(CardRow)):
        name = state_name(c.fsrs_state)
        setattr(counts, name, getattr(counts, name) + 1)
        key_of[c.id] = c.key
        cards_per_key[c.key] += 1
    reviews: dict[str, int] = defaultdict(int)
    agains: dict[str, int] = defaultdict(int)
    for card_id, rating in db.execute(
        select(ReviewLog.card_id, ReviewLog.rating).where(ReviewLog.source == "review")
    ):
        key = key_of.get(card_id)
        if key is None:
            continue
        reviews[key] += 1
        if rating == "again":
            agains[key] += 1
    per_key = {
        k: KeyStats(
            cards=n,
            reviews=reviews[k],
            again_rate=agains[k] / reviews[k] if reviews[k] else 0.0,
        )
        for k, n in cards_per_key.items()
    }
    return ProgressOut(completed_lessons=lessons, card_counts=counts, per_key=per_key)
