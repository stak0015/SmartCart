from __future__ import annotations

from contextlib import contextmanager


def test_catalogue_image_manifest_omits_missing_downloads() -> None:
    from smartcart.catalogue_image_manifest import catalogue_image_url

    assert catalogue_image_url("1183") == "/pricecatcher-v1/1183.webp"
    assert catalogue_image_url("2022") is None


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
            return [(
                1, "1183", "BERAS", "1 kg", "BERAS", None,
                "Rice", "BERAS", "Rice & Noodles", "Beras & Mi",
            )]

    cursor = Cursor()

    @contextmanager
    def fake_database_cursor():
        yield cursor

    monkeypatch.setattr(catalogue, "database_cursor", fake_database_cursor)
    rows, total = catalogue.search_catalogue("rice", 1, 25, ["staples"])

    assert total == 1
    assert rows[0]["item_name_en"] == "Rice"
    assert rows[0]["item_category"] == "BERAS"
    assert rows[0]["source_category"] == {
        "id": "BERAS", "labelEn": "Rice & Noodles", "labelMs": "Beras & Mi",
    }
    assert rows[0]["category"] == {
        "id": "staples",
        "labelEn": "Rice, Noodles & Bread",
        "labelMs": "Beras, Mi & Roti",
        "spendingClass": "essential",
    }
    assert rows[0]["image_url"] == "/pricecatcher-v1/1183.webp"
    count_sql, count_params = cursor.queries[0]
    assert "item_name_en" in count_sql
    assert "item_translation" not in count_sql
    assert "category_translation" in count_sql
    assert "unnest" not in count_sql
    assert "i.item_category = ANY(%s::text[])" in count_sql
    assert "NOT (i.item_category = ANY(%s::text[]))" in count_sql
    assert count_params[0] == "%rice%"
    assert count_params[5] == [
        "BERAS", "BIHUN", "MEE / BIHUN / KUEY TEOW", "MEE/KUETIAU",
        "MI SEGERA", "NASI", "ROTI",
    ]
    assert count_params[6] == count_params[5]
    assert count_params[7] is False
