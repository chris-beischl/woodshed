from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from woodshed_api.config import CORS_ORIGINS, load_config
from woodshed_api.content import load_manifest
from woodshed_api.db import init_schema, make_engine
from woodshed_api.deps import require_token
from woodshed_api.routers import cards, lessons, plan, progress, reviews, settings
from woodshed_api.schemas import Health


def create_app(
    *,
    token: str | None = None,
    manifest_path: str | None = None,
    db_url: str | None = None,
) -> FastAPI:
    cfg = load_config()
    token = token if token is not None else cfg.token
    db_url = db_url if db_url is not None else cfg.db_url
    manifest_file = cfg.manifest_path if manifest_path is None else Path(manifest_path)
    engine = make_engine(db_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        init_schema(engine, db_url)
        app.state.manifest = load_manifest(manifest_file)
        yield
        engine.dispose()

    app = FastAPI(title="woodshed API", version="0.1.0", lifespan=lifespan)
    app.state.token = token
    app.state.session_factory = sessionmaker(engine, expire_on_commit=False)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=Health)
    def health() -> Health:
        return Health()

    protected = APIRouter(dependencies=[Depends(require_token)])
    for module in (plan, reviews, cards, lessons, progress, settings):
        protected.include_router(module.router)
    app.include_router(protected)
    return app


app = create_app()
