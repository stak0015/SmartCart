"""Estimated price ranges (AC 2.4.10) and item lookup (AC 4.9.1, 5.9.1)."""
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from main import create_app
from smartcart import api, estimate_ranges
from smartcart.models import AlternativePriceItem, BasketAlternativeLine, BasketAlternativesResponse


def _line(item_id: str, source: str) -> BasketAlternativeLine:
    return BasketAlternativeLine(quantity=1, source=AlternativePriceItem(
        item_id=item_id, item_name="Item", unit=None, package_size=None, unit_price_rm=3.2,
        line_total_rm=3.2, observed_date=None, price_observed_days_ago=None, sara_eligible=None,
        price_source=source,
    ))


def _response() -> BasketAlternativesResponse:
    return BasketAlternativesResponse(premise_id="1", generated_at=datetime.now(timezone.utc),
                                      lines=[_line("7", "median"), _line("8", "store")])


def test_median_lines_get_the_national_range(monkeypatch):
    asked = []
    def ranges(ids):
        asked.append(set(ids))
        return {7: (2.8, 3.6), 8: (1.0, 9.0)}
    monkeypatch.setattr(estimate_ranges, "national_price_ranges", ranges)
    response = estimate_ranges.attach_estimate_ranges(_response())
    # Only the median-priced line is looked up and labelled.
    assert asked == [{7}]
    assert (response.lines[0].source.estimate_low_rm, response.lines[0].source.estimate_high_rm) == (2.8, 3.6)
    assert response.lines[1].source.estimate_low_rm is None
    # Totals keep using the median.
    assert response.lines[0].source.unit_price_rm == 3.2


def test_a_failed_range_lookup_keeps_the_estimate(monkeypatch):
    def broken(ids):
        raise RuntimeError("database unavailable")
    monkeypatch.setattr(estimate_ranges, "national_price_ranges", broken)
    response = estimate_ranges.attach_estimate_ranges(_response())
    assert response.lines[0].source.estimate_low_rm is None
    assert response.lines[0].source.unit_price_rm == 3.2


def test_item_lookup_returns_catalogue_rows_with_prices(monkeypatch):
    monkeypatch.setattr(api, "get_catalogue_items", lambda ids: [{"item_id": value, "item_code": str(value)} for value in ids])
    monkeypatch.setattr(api, "catalogue_price_ranges", lambda ids, premises: {})
    response = TestClient(create_app()).get("/api/items/lookup?id=7&id=3&id=7").json()
    assert [item["item_id"] for item in response["items"]] == [3, 7]
    assert response["items"][0]["price_range"] is None
