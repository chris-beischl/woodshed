import uuid

from fastapi.testclient import TestClient

from tests.conftest import FIXTURE
from woodshed_api.main import create_app

NOW = "2026-03-10T10:00:00Z"  # 11:00 Berlin (CET)


def review(client: TestClient, card_id: str, rating: str = "good", source: str = "review", **kw):
    body = {
        "id": str(uuid.uuid4()),
        "card_id": card_id,
        "rating": rating,
        "duration_ms": 5000,
        "attempts": 1,
        "details": {"x": 1},
        "source": source,
    } | kw
    return client.post("/reviews", params={"now": NOW}, json=body)


def test_health_is_public() -> None:
    app = create_app(token="t", manifest_path=str(FIXTURE), db_url="sqlite://")
    with TestClient(app) as c:
        assert c.get("/health").json() == {"status": "ok"}


def test_auth_required() -> None:
    app = create_app(token="t", manifest_path=str(FIXTURE), db_url="sqlite://")
    with TestClient(app) as c:
        for path in ("/plan", "/cards", "/progress", "/settings"):
            assert c.get(path).status_code == 401
            assert c.get(path, headers={"Authorization": "Bearer nope"}).status_code == 401
        assert c.get("/plan", headers={"Authorization": "Bearer t"}).status_code == 200


def test_cors_allows_dev_origin(client: TestClient) -> None:
    r = client.options(
        "/plan",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_lesson_complete_creates_cards_idempotently(client: TestClient) -> None:
    r = client.post("/lessons/triads-intro/complete")
    assert r.json() == {"lesson_id": "triads-intro", "cards_created": 12}
    assert client.post("/lessons/triads-intro/complete").json()["cards_created"] == 0
    cards = client.get("/cards", params={"template_id": "triads-major"}).json()
    assert len(cards) == 12
    assert all(c["state"] == "new" and c["due"] is None for c in cards)
    assert client.get("/cards", params={"key": "Bb"}).json()[0]["id"] == "triads-major@Bb"
    assert client.get("/progress").json()["completed_lessons"] == ["triads-intro"]


def test_lesson_skips_deprecated_and_unknown_404(client: TestClient) -> None:
    assert client.post("/lessons/minor-intro/complete").json()["cards_created"] == 14
    ids = {c["id"] for c in client.get("/cards").json()}
    assert not any(i.startswith("old-thing") for i in ids)
    assert client.post("/lessons/nope/complete").status_code == 404


def test_review_transitions_fsrs(client: TestClient) -> None:
    client.post("/lessons/triads-intro/complete")
    r = review(client, "triads-major@C")
    assert r.status_code == 200
    body = r.json()
    assert body["card_id"] == "triads-major@C"
    assert body["state"] == "learning"
    assert body["due"] > "2026-03-10T10:00:00"
    card = client.get("/cards", params={"key": "C"}).json()[0]
    assert card["state"] == "learning" and card["due"] == body["due"]
    # Good until it graduates to review state.
    for _ in range(3):
        body = review(client, "triads-major@C", "easy").json()
    assert body["state"] == "review"
    assert review(client, "triads-major@C", "again").json()["state"] == "relearning"


def test_review_idempotent(client: TestClient) -> None:
    client.post("/lessons/triads-intro/complete")
    rid = str(uuid.uuid4())
    first = review(client, "triads-major@C", id=rid)
    again = review(client, "triads-major@C", id=rid, rating="again")
    assert again.status_code == 200 and again.json() == first.json()
    assert client.get("/progress").json()["per_key"]["C"]["reviews"] == 1


def test_lesson_source_does_not_touch_fsrs(client: TestClient) -> None:
    client.post("/lessons/triads-intro/complete")
    r = review(client, "triads-major@C", source="lesson")
    assert r.json() == {"card_id": "triads-major@C", "state": "new", "due": None}
    assert client.get("/progress").json()["card_counts"]["new"] == 12


def test_review_unknown_card_404(client: TestClient) -> None:
    assert review(client, "nope@C").status_code == 404


def test_suspend_card(client: TestClient) -> None:
    client.post("/lessons/triads-intro/complete")
    r = client.patch("/cards/triads-major@C", json={"suspended": True})
    assert r.json()["suspended"] is True
    plan = client.get("/plan", params={"now": NOW}).json()
    assert "triads-major@C" not in [i["card_id"] for i in plan["items"]]
    assert client.patch("/cards/nope@C", json={"suspended": True}).status_code == 404


def test_plan_endpoint_and_budget_spent(client: TestClient) -> None:
    client.post("/lessons/triads-intro/complete")
    plan = client.get("/plan", params={"now": NOW}).json()
    assert plan["content_version"] == "test-version-1"
    assert plan["remaining_seconds"] == 1800
    assert plan["items"] and all(i["is_new"] for i in plan["items"])
    review(client, "triads-major@C")
    assert client.get("/plan", params={"now": NOW}).json()["remaining_seconds"] == 1795


def test_progress_per_key(client: TestClient) -> None:
    client.post("/lessons/triads-intro/complete")
    review(client, "triads-major@C", "again")
    review(client, "triads-major@C", "good")
    p = client.get("/progress").json()
    assert p["per_key"]["C"] == {"cards": 1, "reviews": 2, "again_rate": 0.5}
    assert p["card_counts"] == {"new": 11, "learning": 1, "review": 0, "relearning": 0}


def test_settings_defaults_and_update(client: TestClient) -> None:
    assert client.get("/settings").json() == {
        "daily_minutes": 30,
        "new_card_ratio": 0.2,
        "desired_retention": 0.9,
        "timezone": "Europe/Berlin",
        "day_rollover_hour": 4,
    }
    new = {
        "daily_minutes": 45,
        "new_card_ratio": 0.3,
        "desired_retention": 0.85,
        "timezone": "America/New_York",
        "day_rollover_hour": 5,
    }
    assert client.put("/settings", json=new).json() == new
    assert client.get("/settings").json() == new


def test_settings_validation(client: TestClient) -> None:
    base = client.get("/settings").json()
    for bad in (
        {"timezone": "Mars/Base"},
        {"day_rollover_hour": 24},
        {"day_rollover_hour": -1},
        {"daily_minutes": 0},
        {"new_card_ratio": 1.5},
        {"desired_retention": 1.0},
    ):
        assert client.put("/settings", json=base | bad).status_code == 422, bad
