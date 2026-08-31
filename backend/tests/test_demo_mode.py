import asyncio
from dataclasses import replace

from smartcart.config import get_settings
from smartcart.maps import DemoMapsProvider, DEMO_ORIGIN_PLACE_ID


def test_demo_connection_uses_the_separate_database(monkeypatch) -> None:
    from smartcart import database

    settings = replace(
        get_settings(),
        demo_mode=True,
        demo_database_url="postgresql://demo.example/smartcart_demo",
        database_url="postgresql://live.example/smartcart",
    )
    captured: dict[str, object] = {}

    def fake_connect(url, **options):
        captured["url"] = url
        captured["options"] = options
        return object()

    monkeypatch.setattr(database, "get_settings", lambda: settings)
    monkeypatch.setattr(database.psycopg2, "connect", fake_connect)

    database.get_connection()

    assert captured["url"] == "postgresql://demo.example/smartcart_demo"
    assert captured["options"] == {"connect_timeout": 5}


def test_demo_maps_provider_returns_a_deterministic_origin() -> None:
    provider = DemoMapsProvider()

    suggestions = asyncio.run(provider.autocomplete("demo", "session-token"))
    assert suggestions[0].place_id == DEMO_ORIGIN_PLACE_ID
    assert "Demo Centre" in suggestions[0].main_text

    resolved = asyncio.run(provider.resolve_place(DEMO_ORIGIN_PLACE_ID, "session-token"))
    assert resolved.label == "SmartCart Demo Centre, Kuala Lumpur"
    assert (resolved.latitude, resolved.longitude) == (3.139, 101.6869)


def test_demo_location_endpoint_marks_the_demo_provider(monkeypatch) -> None:
    from fastapi.testclient import TestClient
    from main import create_app
    from smartcart import api

    monkeypatch.setattr(api, "get_settings", lambda: replace(get_settings(), demo_mode=True))
    monkeypatch.setattr(api, "get_maps_provider", lambda: DemoMapsProvider())

    response = TestClient(create_app()).get(
        "/api/locations/autocomplete",
        params={"query": "demo", "sessionToken": "demo-session"},
    )

    assert response.status_code == 200
    assert response.json()["provider"] == "demo"
