from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from woodshed_api.deps import DbDep
from woodshed_api.models import CardRow
from woodshed_api.scheduling.scheduler import state_name
from woodshed_api.schemas import CardOut, CardPatch, CardStateName

router = APIRouter()


def card_out(c: CardRow) -> CardOut:
    return CardOut(
        id=c.id,
        template_id=c.template_id,
        key=c.key,
        variant=c.variant,
        state=state_name(c.fsrs_state),
        due=c.due,
        suspended=c.suspended,
        introduced_at=c.introduced_at,
    )


@router.get("/cards", response_model=list[CardOut])
def list_cards(
    db: DbDep,
    template_id: Annotated[str | None, Query()] = None,
    key: Annotated[str | None, Query()] = None,
    state: Annotated[CardStateName | None, Query()] = None,
) -> list[CardOut]:
    stmt = select(CardRow).order_by(CardRow.id)
    if template_id is not None:
        stmt = stmt.where(CardRow.template_id == template_id)
    if key is not None:
        stmt = stmt.where(CardRow.key == key)
    out = [card_out(c) for c in db.scalars(stmt)]
    return [c for c in out if state is None or c.state == state]


@router.patch("/cards/{card_id}", response_model=CardOut)
def patch_card(card_id: str, body: CardPatch, db: DbDep) -> CardOut:
    card = db.get(CardRow, card_id)
    if card is None:
        raise HTTPException(404, f"Unknown card: {card_id}")
    card.suspended = body.suspended
    db.commit()
    return card_out(card)
