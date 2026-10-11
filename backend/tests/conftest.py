import pytest

from smartcart.fuel import FuelPrice


@pytest.fixture(autouse=True)
def offline_fuel_prices(monkeypatch):
    """Recommendation endpoint tests must never depend on live fuel prices."""
    monkeypatch.setattr(
        "smartcart.api.get_fuel_price",
        lambda settings: FuelPrice(2.60, settings.fuel_price_field, "data.gov.my", "2026-10-08"),
    )
