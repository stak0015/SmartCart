from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from main import create_app
from smartcart import api, catalogue


@pytest.mark.parametrize("sort", ["price_asc", "price_desc", "name_asc", "name_desc"])
def test_filter_and_sort_apply_before_pagination(monkeypatch, sort):
    calls = []

    class Cursor:
        def execute(self, sql, params):
            calls.append((sql, params))

        def fetchone(self):
            return (40,)

        def fetchall(self):
            return []

    @contextmanager
    def cursor():
        yield Cursor()

    monkeypatch.setattr(catalogue, "database_cursor", cursor)
    _, total = catalogue.search_catalogue("rice", 2, 15, ["staples"], True, sort, ["12", "13"])
    assert total == 40
    count_sql, count_params = calls[0]
    result_sql, result_params = calls[1]
    assert "BTRIM(i.item_category) = ANY(%s::text[])" in count_sql
    assert count_params[-1] == sorted(catalogue.SARA_CATEGORY_CANDIDATES)
    assert "BTRIM(i.item_category) = ANY(%s::text[])" in result_sql
    assert result_params[-2:] == (15, 15)
    assert result_sql.index("ORDER BY") < result_sql.index("LIMIT")
    direction = "ASC" if sort.endswith("asc") else "DESC"
    if sort.startswith("price"):
        assert "MIN(current_price)" in result_sql
        assert "current_price > 0" in result_sql
        assert f"{direction} NULLS LAST" in result_sql
        assert "CASE WHEN i.median_price_rm > 0" in result_sql
        assert result_params[0] == [12, 13]
    else:
        assert "catalogue_prices" not in result_sql
        assert f"COALESCE(NULLIF(i.item_name_en, ''), i.item_name) {direction}" in result_sql
    assert "i.item_id ASC" in result_sql


def test_endpoint_defaults_to_cheapest_and_passes_category_checkbox(monkeypatch):
    calls = []
    monkeypatch.setattr(api, "search_catalogue", lambda *args: (calls.append(args) or [], 0))
    client = TestClient(create_app())
    assert client.get("/api/items/search").status_code == 200
    assert calls[-1][4:] == (False, "price_asc", [], "en")
    assert client.get("/api/items/search", params={"sara_category_only": True, "sort": "name_desc", "locale": "ms", "page": 2}).status_code == 200
    assert calls[-1][1] == 2
    assert calls[-1][4:] == (True, "name_desc", [], "ms")
    assert client.get("/api/items/search", params={"sort": "invalid"}).status_code == 400
    assert len(calls) == 2
