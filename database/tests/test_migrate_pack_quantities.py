from __future__ import annotations

import sys
import unittest
from contextlib import contextmanager
from pathlib import Path


DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from migrate_pack_quantities import backfill_pack_quantities  # noqa: E402


class FakeCursor:
    def __init__(self, rows: list[list[object]]) -> None:
        self.rows = rows

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, query: str, _params: object = None) -> None:
        if query.startswith("SELECT"):
            return None
        return None

    def fetchall(self) -> list[tuple[object, ...]]:
        return [tuple(row[:3]) for row in self.rows]

    def executemany(self, _query: str, updates: list[tuple[object, ...]]) -> None:
        by_id = {row[0]: row for row in self.rows}
        for value, unit, item_id in updates:
            by_id[item_id][3:] = [value, unit]


class FakeConnection:
    def __init__(self, rows: list[list[object]]) -> None:
        self.rows = rows

    @contextmanager
    def cursor(self):
        yield FakeCursor(self.rows)


class MigrationTests(unittest.TestCase):
    def test_migration_backfills_and_is_idempotent(self) -> None:
        rows: list[list[object]] = [
            [1, "Rice", "1 kg", None, None],
            [2, "Juice", "750 ml", None, None],
            [3, "Eggs", "10 pcs", None, None],
        ]
        connection = FakeConnection(rows)

        first = backfill_pack_quantities(connection)
        snapshot = [row[:] for row in rows]
        second = backfill_pack_quantities(connection)

        self.assertEqual(
            first,
            {
                "item_rows_total": 3,
                "item_rows_parsed": 2,
                "item_rows_unparseable": 1,
            },
        )
        self.assertEqual(second, first)
        self.assertEqual(rows, snapshot)
        self.assertEqual(rows[0][3:], [1.0, "KG"])
        self.assertEqual(rows[1][3:], [0.75, "L"])
        self.assertEqual(rows[2][3:], [None, None])
