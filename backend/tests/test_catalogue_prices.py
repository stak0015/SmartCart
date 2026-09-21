from collections import OrderedDict
from datetime import date
from decimal import Decimal
from time import monotonic
from types import SimpleNamespace
from contextlib import contextmanager

from fastapi.testclient import TestClient
from main import create_app
from smartcart import api, catalogue


def test_catalogue_ranges_use_nearest_25_cached_stores(monkeypatch):
    stores = [SimpleNamespace(premise_id=str(i), straight_line_distance_km=i) for i in range(30, 0, -1)]
    monkeypatch.setattr(api, "_candidate_cache", OrderedDict(token=(monotonic() + 100, "hash", SimpleNamespace(recommendations=stores))))
    monkeypatch.setattr(api, "search_catalogue", lambda *args: ([{"item_id": 1}, {"item_id": 2}], 2))
    def ranges(items, premises):
        assert items == [1, 2]
        assert premises == [str(i) for i in range(1, 26)]
        return {1: {"min_rm": 2.5, "max_rm": 4.0, "store_count": 3, "oldest_observed_date": None}}
    monkeypatch.setattr(api, "catalogue_price_ranges", ranges)
    response = TestClient(create_app()).get("/api/items/search?candidate_cache_id=token").json()
    assert response["price_store_count"] == 25
    assert response["items"][0]["price_range"]["min_rm"] == 2.5
    assert response["items"][1]["price_range"] is None


def test_expired_price_context_does_not_query_prices(monkeypatch):
    monkeypatch.setattr(api, "_candidate_cache", OrderedDict(token=(monotonic() - 1, "hash", None)))
    monkeypatch.setattr(api, "search_catalogue", lambda *args: ([{"item_id": 1}], 1))
    response = TestClient(create_app()).get("/api/items/search?candidate_cache_id=token").json()
    assert response["price_context"] == "unavailable"
    assert response["items"][0]["price_range"] is None


def test_price_aggregation_preserves_observation_date_and_money(monkeypatch):
    class Cursor:
        def execute(self, sql, params):
            assert "current_price > 0" in sql
            assert "median_price" not in sql
            assert params == ([1], [12, 13])
        def fetchall(self):
            return [(1, Decimal("2.50"), Decimal("4.10"), 2, date(2026, 9, 19))]
    @contextmanager
    def cursor():
        yield Cursor()
    monkeypatch.setattr(catalogue, "database_cursor", cursor)
    assert catalogue.catalogue_price_ranges([1], ["12", "13"]) == {
        1: {"min_rm": 2.5, "max_rm": 4.1, "store_count": 2, "oldest_observed_date": "2026-09-19"}
    }
