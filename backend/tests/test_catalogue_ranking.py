from contextlib import contextmanager

from smartcart import catalogue


class Cursor:
    def __init__(self, calls):
        self.calls = calls

    def execute(self, sql, params):
        self.calls.append((sql, params))

    def fetchone(self):
        return (0,)

    def fetchall(self):
        return []


def _run_search(monkeypatch, query):
    calls = []

    @contextmanager
    def cursor():
        yield Cursor(calls)

    monkeypatch.setattr(catalogue, "database_cursor", cursor)
    catalogue.search_catalogue(query, 1, 25, [])
    return calls[1]


def test_search_orders_by_relevance_then_store_coverage(monkeypatch):
    sql, params = _run_search(monkeypatch, "onion")
    assert "WITH priced_items AS" in sql
    assert "price_store_count" in sql
    assert "i.median_price_rm IS NOT NULL" in sql
    assert params[-5:] == ("onion", "onion", "onion%", 25, 0)


def test_empty_search_keeps_richness_as_primary_order(monkeypatch):
    sql, params = _run_search(monkeypatch, "")
    assert "WHEN %s = '' THEN 0" in sql
    assert params[-5:] == ("", "", "%", 25, 0)
