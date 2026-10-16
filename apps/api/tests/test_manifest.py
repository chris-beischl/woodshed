import pytest

from tests.conftest import FIXTURE
from woodshed_api.config import default_manifest_path
from woodshed_api.content import Manifest, load_manifest


def test_fixture_loads(manifest: Manifest) -> None:
    assert manifest.version == "test-version-1"
    t = manifest.template("triads-major")
    assert t is not None
    assert t.estimated_seconds == 10 and t.keys[:3] == ["C", "F", "Bb"]
    lesson = manifest.lesson("triads-intro")
    assert lesson is not None and lesson.estimated_minutes == 15
    assert lesson.introduces == ["triads-major"]


def test_unknown_fields_ignored() -> None:
    m = Manifest.model_validate(
        {
            "version": "v",
            "extra": 1,
            "templates": [
                {"id": "a", "importance": 1, "estimatedSeconds": 3, "keys": ["C"], "zzz": {}}
            ],
            "lessons": [],
        }
    )
    assert m.templates[0].deprecated is False


def test_real_manifest_if_present() -> None:
    path = default_manifest_path()
    if not path.exists():
        pytest.skip(f"no manifest at {path}")
    m = load_manifest(path)
    assert m.version
    ids = {t.id for t in m.templates}
    assert len(ids) == len(m.templates)
    for lesson in m.lessons:
        assert set(lesson.introduces) <= ids
    assert FIXTURE.exists()
