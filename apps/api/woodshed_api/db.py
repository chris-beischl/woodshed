"""Engine setup and schema bootstrap."""

from pathlib import Path

from alembic.config import Config as AlembicConfig
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.pool import StaticPool

from alembic import command
from woodshed_api.config import API_ROOT
from woodshed_api.models import Base


def is_memory_db(url: str) -> bool:
    u = make_url(url)
    return u.get_backend_name() == "sqlite" and u.database in (None, "", ":memory:")


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        if is_memory_db(url):
            return create_engine(
                url, connect_args={"check_same_thread": False}, poolclass=StaticPool
            )
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url)


def alembic_config(url: str) -> AlembicConfig:
    cfg = AlembicConfig(str(Path(API_ROOT) / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def init_schema(engine: Engine, url: str) -> None:
    """File DBs: alembic upgrade head. In-memory DBs (tests): metadata.create_all."""
    if is_memory_db(url):
        Base.metadata.create_all(engine)
    else:
        command.upgrade(alembic_config(url), "head")
