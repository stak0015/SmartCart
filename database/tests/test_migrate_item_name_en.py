from __future__ import annotations

import sys
from contextlib import contextmanager
from pathlib import Path

DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from migrate_item_name_en import migrate_item_name_en  # noqa: E402


class Cursor:
    def __init__(self, legacy_exists: bool) -> None:
        self.legacy_exists = legacy_exists
        self.queries: list[str] = []
        self.rowcount = 0
        self.fetchone_calls = 0

    def execute(self, query: str, _params=None) -> None:
        self.queries.append(query)
        self.rowcount = 4 if query.lstrip().startswith("UPDATE item AS i") else 0

    def fetchone(self):
        self.fetchone_calls += 1
        return (self.legacy_exists,) if self.fetchone_calls == 1 else (756,)


class Connection:
    def __init__(self, legacy_exists: bool) -> None:
        self.cursor_value = Cursor(legacy_exists)

    @contextmanager
    def transaction(self):
        yield

    @contextmanager
    def cursor(self):
        yield self.cursor_value


def test_migration_moves_legacy_english_rows_and_drops_table() -> None:
    connection = Connection(True)
    result = migrate_item_name_en(connection)
    sql = "\n".join(connection.cursor_value.queries)
    assert "ADD COLUMN IF NOT EXISTS item_name_en" in sql
    assert "FROM item_translation AS t" in sql
    assert "DROP TABLE item_translation" in sql
    assert result == {
        "legacy_rows_migrated": 4,
        "labelled_rows": 756,
        "legacy_table_dropped": 1,
    }


def test_migration_is_safe_after_legacy_table_is_gone() -> None:
    connection = Connection(False)
    result = migrate_item_name_en(connection)
    sql = "\n".join(connection.cursor_value.queries)
    assert "DROP TABLE item_translation" not in sql
    assert result["legacy_table_dropped"] == 0
