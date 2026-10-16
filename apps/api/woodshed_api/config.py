"""Environment configuration (plain os.environ; no pydantic-settings)."""

import os
from dataclasses import dataclass
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = "../web/public/manifest.json"
# Any local dev port (a second dev server falls back to 5174, 5175, ...).
CORS_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?"


@dataclass(frozen=True)
class Config:
    token: str
    manifest_path: Path
    db_url: str


def default_manifest_path() -> Path:
    return (API_ROOT / DEFAULT_MANIFEST).resolve()


def load_config() -> Config:
    manifest = os.environ.get("WOODSHED_MANIFEST", DEFAULT_MANIFEST)
    path = Path(manifest)
    if not path.is_absolute():
        path = (API_ROOT / path).resolve()
    return Config(
        token=os.environ.get("WOODSHED_TOKEN", "dev-token"),
        manifest_path=path,
        db_url=os.environ.get("WOODSHED_DB", "sqlite:///./woodshed.db"),
    )
