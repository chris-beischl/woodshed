from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from woodshed_api.deps import DbDep, ManifestDep, NowDep, get_settings_row
from woodshed_api.models import CardRow, ReviewLog
from woodshed_api.scheduling import scheduler
from woodshed_api.schemas import ReviewIn, ReviewOut

router = APIRouter()


def _out(card: CardRow) -> ReviewOut:
    return ReviewOut(card_id=card.id, state=scheduler.state_name(card.fsrs_state), due=card.due)


def _card_or_404(db: Session, card_id: str) -> CardRow:
    card = db.get(CardRow, card_id)
    if card is None:
        raise HTTPException(404, f"Unknown card: {card_id}")
    return card


@router.post("/reviews", response_model=ReviewOut)
def post_review(body: ReviewIn, db: DbDep, manifest: ManifestDep, now: NowDep) -> ReviewOut:
    existing = db.get(ReviewLog, body.id)
    if existing is not None:
        return _out(_card_or_404(db, existing.card_id))
    card = _card_or_404(db, body.card_id)
    db.add(
        ReviewLog(
            id=body.id,
            card_id=card.id,
            ts=now,
            rating=body.rating,
            duration_ms=body.duration_ms,
            attempts=body.attempts,
            source=body.source,
            content_version=manifest.version,
            details=body.details,
        )
    )
    if body.source == "review":
        s = get_settings_row(db)
        state, due = scheduler.review(
            card.fsrs_state, body.rating, now, body.duration_ms, s.desired_retention
        )
        card.fsrs_state = state
        card.due = due
    db.commit()
    return _out(card)
