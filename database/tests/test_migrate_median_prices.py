from __future__ import annotations

import sys
import unittest
from contextlib import contextmanager
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from ingest_pricecatcher import refresh_touched_item_medians  # noqa: E402
from migrate_median_prices import backfill_median_prices  # noqa: E402


class FakeCursor:
    def __init__(self) -> None:
        self.queries: list[str] = []
        self.rowcount = 0

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, query: str, _params: object = None) -> None:
        self.queries.append(query)
        if query.lstrip().startswith("UPDATE item SET median_price_rm = NULL"):
            self.rowcount = 3
        elif "UPDATE item AS i" in query:
            self.rowcount = 2
        else:
            self.rowcount = -1


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_instance = FakeCursor()

    @contextmanager
    def transaction(self):
        yield

    @contextmanager
    def cursor(self):
        yield self.cursor_instance


class MedianPriceTests(unittest.TestCase):
    @staticmethod
    def continuous_median_as_sql(prices: list[str | None]) -> Decimal | None:
        """Mirror PostgreSQL percentile_cont(0.5), then round to cents."""

        values = sorted(
            Decimal(value)
            for value in prices
            if value is not None and Decimal(value) > 0
        )
        if not values:
            return None
        middle = len(values) // 2
        if len(values) % 2:
            median = values[middle]
        else:
            median = (values[middle - 1] + values[middle]) / 2
        return median.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def test_median_semantics_cover_odd_even_single_null_and_rounding(self) -> None:
        self.assertEqual(
            self.continuous_median_as_sql(["1.00", "9.00", "3.00"]),
            Decimal("3.00"),
        )
        self.assertEqual(
            self.continuous_median_as_sql(["1.00", "2.00", "3.00", "4.00"]),
            Decimal("2.50"),
        )
        self.assertEqual(
            self.continuous_median_as_sql(["1.00"]),
            Decimal("1.00"),
        )
        self.assertEqual(
            self.continuous_median_as_sql(["1.00", "1.01"]),
            Decimal("1.01"),
        )
        self.assertIsNone(self.continuous_median_as_sql([None, None]))

    def test_ingestion_refresh_is_touched_item_scoped_and_uses_all_statuses(self) -> None:
        cursor = FakeCursor()

        refreshed = refresh_touched_item_medians(cursor)

        self.assertEqual(refreshed, 2)
        query = cursor.queries[0]
        self.assertIn("stage_current_status", query)
        self.assertIn("FROM current_status AS cs", query)
        self.assertIn("percentile_cont(0.5)", query)
        self.assertIn("ORDER BY cs.current_price", query)
        self.assertIn("ROUND(", query)
        self.assertIn("WHERE cs.current_price > 0", query)

    def test_full_backfill_adds_column_and_recomputes_every_item(self) -> None:
        connection = FakeConnection()

        result = backfill_median_prices(connection)

        self.assertEqual(
            result,
            {
                "item_rows_cleared": 3,
                "item_rows_with_medians": 2,
            },
        )
        queries = connection.cursor_instance.queries
        self.assertIn("ADD COLUMN IF NOT EXISTS median_price_rm NUMERIC(12, 2)", queries[0])
        self.assertIn("item_median_price_positive", queries[1])
        self.assertIn("COMMENT ON COLUMN item.median_price_rm", queries[2])
        median_query = queries[4]
        self.assertIn("percentile_cont(0.5)", median_query)
        self.assertIn("ORDER BY current_price", median_query)
        self.assertIn("WHERE current_price > 0", median_query)
        self.assertIn("ROUND(", median_query)


if __name__ == "__main__":
    unittest.main()
