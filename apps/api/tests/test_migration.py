from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from alembic import command
from woodshed_api.db import alembic_config, init_schema, make_engine
from woodshed_api.models import Base


def test_migration_matches_models(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'm.db'}"
    engine = make_engine(url)
    init_schema(engine, url)  # runs alembic upgrade head for file DBs
    assert set(inspect(engine).get_table_names()) - {"alembic_version"} == set(Base.metadata.tables)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == []


def test_memory_uses_create_all() -> None:
    engine = create_engine("sqlite://")
    init_schema(engine, "sqlite://")
    assert set(inspect(engine).get_table_names()) == set(Base.metadata.tables)


def test_upgrade_0002_preserves_data(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'old.db'}"
    command.upgrade(alembic_config(url), "0001")
    engine = make_engine(url)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO settings VALUES (1, 45, 0.3, 0.85, 'America/New_York', 5)"))
        conn.execute(
            text("INSERT INTO cards VALUES ('t@C','t','C',NULL,NULL,NULL,'2026-01-01 00:00:00',0)")
        )
        conn.execute(
            text(
                "INSERT INTO review_logs VALUES ('r1','ghost@C','2026-01-01 00:00:00',"
                "'good',100,1,'lesson','v','{}')"
            )
        )
    command.upgrade(alembic_config(url), "head")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT * FROM settings")).mappings().one()
        assert row["daily_minutes"] == 45 and row["timezone"] == "America/New_York"
        assert row["new_cards_per_day"] == 10 and row["keys_in_progress"] == 4
        assert conn.execute(text("SELECT count(*) FROM cards")).scalar() == 1
        assert conn.execute(text("SELECT count(*) FROM review_logs")).scalar() == 1
