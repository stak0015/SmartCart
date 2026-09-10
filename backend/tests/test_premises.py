from contextlib import contextmanager

from smartcart.premises import (
    find_nearest_premises,
    get_premise_location_coverage,
)


class RecordingCursor:
    def __init__(self, rows=(), row=None) -> None:
        self.rows = list(rows)
        self.row = row
        self.query = ""
        self.params = ()

    def execute(self, query, params) -> None:
        self.query = query
        self.params = params

    def fetchall(self):
        return self.rows

    def fetchone(self):
        return self.row


def install_cursor(monkeypatch, cursor: RecordingCursor) -> None:
    @contextmanager
    def fake_database_cursor():
        yield cursor

    monkeypatch.setattr("smartcart.premises.database_cursor", fake_database_cursor)


def test_nearest_premises_query_only_selects_open_locations(monkeypatch) -> None:
    cursor = RecordingCursor(
        rows=[
            (
                12,
                "P12",
                "Open Store",
                "12 Jalan Test",
                "Kinta",
                "Perak",
                "place-12",
                True,
                False,
                1.25,
            )
        ]
    )
    install_cursor(monkeypatch, cursor)

    result = find_nearest_premises(
        latitude=4.5975,
        longitude=101.0901,
        sara_filter="any",
        maximum_straight_line_km=5,
        limit=25,
        maximum_coordinate_age_days=30,
    )

    assert "open_closed_status = 'open'" in cursor.query
    assert [candidate.premise_id for candidate in result] == ["12"]


def test_location_coverage_counts_only_open_premises(monkeypatch) -> None:
    cursor = RecordingCursor(row=(7, 5))
    install_cursor(monkeypatch, cursor)

    assert get_premise_location_coverage(30) == (7, 5)
    assert cursor.query.count("open_closed_status = 'open'") == 2
