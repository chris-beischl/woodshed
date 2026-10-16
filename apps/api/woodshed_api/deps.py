import secrets
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from woodshed_api.content import Manifest
from woodshed_api.models import SettingsRow

_bearer = HTTPBearer(auto_error=False)


def require_token(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> None:
    expected: str = request.app.state.token
    if credentials is None or not secrets.compare_digest(
        credentials.credentials.encode(), expected.encode()
    ):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def get_manifest(request: Request) -> Manifest:
    return request.app.state.manifest


def optional_now(now: Annotated[datetime | None, Query()] = None) -> datetime:
    """Server time, overridable with `?now=` for tests/dev. Naive values are UTC."""
    if now is None:
        return datetime.now(UTC)
    return now.replace(tzinfo=UTC) if now.tzinfo is None else now.astimezone(UTC)


def get_settings_row(db: Session) -> SettingsRow:
    row = db.get(SettingsRow, 1)
    if row is None:
        row = SettingsRow(
            id=1,
            daily_minutes=30,
            new_card_ratio=0.2,
            desired_retention=0.9,
            timezone="Europe/Berlin",
            day_rollover_hour=4,
            new_cards_per_day=10,
            keys_in_progress=4,
        )
        db.add(row)
        db.flush()
    return row


DbDep = Annotated[Session, Depends(get_db)]
ManifestDep = Annotated[Manifest, Depends(get_manifest)]
NowDep = Annotated[datetime, Depends(optional_now)]
