from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from woodshed_api.db import init_schema, make_engine
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
