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


def test_catalogue_search_expands_broad_filters_and_preserves_raw_category(
    monkeypatch,
):
    calls = []
    row = (
        1, "1183", "ONIONS", "1 kg", "BAWANG", False,
        "Onions", "BAWANG", "Onions", "Bawang",
    )

    class Cursor:
        def execute(self, sql, params):
            calls.append((sql, params))

        def fetchone(self):
            return (1,)

        def fetchall(self):
            return [row]

    @contextmanager
    def cursor():
        yield Cursor()

    monkeypatch.setattr(catalogue, "database_cursor", cursor)

    rows, total = catalogue.search_catalogue(
        "onion", 3, 25, ["fresh-produce", "protein"]
    )

    assert total == 1
    assert rows[0]["item_category"] == "BAWANG"
    assert rows[0]["category"]["id"] == "fresh-produce"
    assert rows[0]["source_category"] == {
        "id": "BAWANG", "labelEn": "Onions", "labelMs": "Bawang",
    }
    assert rows[0]["sara_category_candidate"] is False
    count_sql, params = calls[0]
    expected_selected = [
        "BAWANG", "BUAH-BUAHAN", "KELAPA", "SAYUR-SAYURAN", "UBI KENTANG",
        "AYAM", "BAHAN LAUT", "DAGING", "HASIL LAUT KERING", "IKAN DALAM TIN",
        "IKAN DARAT", "KACANG", "TAUHU DAN TEMPE", "TELUR",
    ]
    assert "i.item_category = ANY(%s::text[])" in count_sql
    assert params[0] == "%onion%"
    assert params[5] == expected_selected
    assert params[6] == expected_selected
    assert params[7] is False
    assert params[8] == list(catalogue.ALL_MAPPED_RAW_CATEGORIES)
    assert "fresh-produce" not in params[5]
    assert calls[1][1][-2:] == (25, 50)

    catalogue.search_catalogue("onion", 1, 25, [])
    empty_filter_sql, empty_filter_params = calls[2]
    assert "cardinality(%s::text[]) = 0" in empty_filter_sql
    assert empty_filter_params[5] == []
    assert empty_filter_params[7] is False


def test_other_filter_includes_lain_lain_and_unmapped_nonempty_categories(
    monkeypatch,
):
    calls = []

    class Cursor:
        def execute(self, sql, params):
            calls.append((sql, params))

        def fetchone(self):
            return (0,)

        def fetchall(self):
            return []

    @contextmanager
    def cursor():
        yield Cursor()

    monkeypatch.setattr(catalogue, "database_cursor", cursor)

    rows, total = catalogue.search_catalogue("", 1, 25, ["other"])

    assert rows == []
    assert total == 0
    count_sql, params = calls[0]
    assert "NULLIF(BTRIM(i.item_category), '') IS NOT NULL" in count_sql
    assert "NOT (i.item_category = ANY(%s::text[]))" in count_sql
    assert params[5] == ["LAIN-LAIN"]
    assert params[6] == ["LAIN-LAIN"]
    assert params[7] is True
    assert params[8] == list(catalogue.ALL_MAPPED_RAW_CATEGORIES)


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
