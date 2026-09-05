from __future__ import annotations

from contextlib import contextmanager


def test_catalogue_search_sql_uses_lookup_item_english_name_and_categories(monkeypatch) -> None:
    from smartcart import catalogue

    class Cursor:
        def __init__(self) -> None:
            self.queries: list[tuple[str, object]] = []
            self.fetch_count = 0

        def __enter__(self) -> "Cursor":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def execute(self, query: str, params: object = None) -> None:
            self.queries.append((query, params))

        def fetchone(self) -> tuple[int]:
            return (1,)

        def fetchall(self) -> list[tuple[object, ...]]:
            return [(1, "BERAS", "1 kg", "BERAS", None, "Rice", "BERAS", "BERAS", "BERAS")]

    cursor = Cursor()

    @contextmanager
    def fake_database_cursor():
        yield cursor

    monkeypatch.setattr(catalogue, "database_cursor", fake_database_cursor)
    rows, total = catalogue.search_catalogue("rice", 1, 25, ["Rice"])

    assert total == 1
    assert rows[0]["item_name_en"] == "Rice"
    count_sql, count_params = cursor.queries[0]
    assert "item_name_en" in count_sql
    assert "item_translation" not in count_sql
    assert "category_translation" in count_sql
    assert "unnest" not in count_sql
    assert "ct_en.translated_name = ANY" in count_sql
    assert count_params[0] == "%rice%"
    assert count_params[5] == ["Rice"]
