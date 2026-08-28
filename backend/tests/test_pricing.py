from contextlib import contextmanager
from datetime import date
from decimal import Decimal

from smartcart.models import BasketLineRequest
from smartcart.pricing import get_basket_prices_for_premises


class FakeCursor:
    def __init__(self) -> None:
        self.parameters = None

    def execute(self, _query, parameters) -> None:
        self.parameters = parameters

    def fetchall(self):
        return [
            (1, 10, "Item with price", "500g", 2, Decimal("3.25"), date(2026, 8, 20)),
            (1, 11, "Item without price", "1kg", 1, None, None),
        ]


def test_returns_priced_and_missing_lines_without_fabricating_prices(monkeypatch) -> None:
    cursor = FakeCursor()

    @contextmanager
    def fake_database_cursor():
        yield cursor

    monkeypatch.setattr("smartcart.pricing.database_cursor", fake_database_cursor)
    result = get_basket_prices_for_premises(
        premise_ids=["1"],
        basket=[
            BasketLineRequest(item_id=10, quantity=2),
            BasketLineRequest(item_id=11, quantity=1),
        ],
    )

    assert cursor.parameters == ([10, 11], [2, 1], [1])
    assert result["1"][0].unit_price_rm == 3.25
    assert result["1"][0].line_total_rm == 6.5
    assert result["1"][0].price_observed_date == date(2026, 8, 20)
    assert result["1"][1].unit_price_rm is None
    assert result["1"][1].line_total_rm is None
