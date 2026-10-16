from fastapi import APIRouter

from woodshed_api.deps import DbDep, get_settings_row
from woodshed_api.schemas import SettingsModel

router = APIRouter()


@router.get("/settings", response_model=SettingsModel)
def read_settings(db: DbDep) -> SettingsModel:
    row = get_settings_row(db)
    db.commit()
    return SettingsModel(
        daily_minutes=row.daily_minutes,
        new_card_ratio=row.new_card_ratio,
        desired_retention=row.desired_retention,
        timezone=row.timezone,
        day_rollover_hour=row.day_rollover_hour,
        new_cards_per_day=row.new_cards_per_day,
        keys_in_progress=row.keys_in_progress,
    )


@router.put("/settings", response_model=SettingsModel)
def update_settings(body: SettingsModel, db: DbDep) -> SettingsModel:
    row = get_settings_row(db)
    row.daily_minutes = body.daily_minutes
    row.new_card_ratio = body.new_card_ratio
    row.desired_retention = body.desired_retention
    row.timezone = body.timezone
    row.day_rollover_hour = body.day_rollover_hour
    row.new_cards_per_day = body.new_cards_per_day
    row.keys_in_progress = body.keys_in_progress
    db.commit()
    return body
