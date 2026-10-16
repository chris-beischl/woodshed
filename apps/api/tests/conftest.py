from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from woodshed_api.content import Manifest, load_manifest
from woodshed_api.main import create_app

FIXTURE = Path(__file__).parent / "fixtures" / "manifest.json"
AUTH = {"Authorization": "Bearer test-token"}


@pytest.fixture
def manifest() -> Manifest:
    return load_manifest(FIXTURE)


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(token="test-token", manifest_path=str(FIXTURE), db_url="sqlite://")
    with TestClient(app, headers=AUTH) as c:
        yield c
