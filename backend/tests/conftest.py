import pytest
import json
from pathlib import Path

from smartcart.fuel import FuelPrice


@pytest.fixture(autouse=True)
def offline_nutrition_records(monkeypatch):
    """Service tests supply food fixtures; production reads PostgreSQL."""
    from smartcart import item_nutrition
    path = Path(__file__).resolve().parents[2] / 'data/nutrition/item_nutrition.json'
    profiles = json.loads(path.read_text(encoding='utf-8'))
    def records(item_code=None):
        return {**profiles, 'mappings': [r for r in profiles['mappings']
                if item_code is None or r['item_code'] == item_code]}
    monkeypatch.setattr(item_nutrition, 'load_item_dataset', records)


@pytest.fixture(autouse=True)
def offline_fuel_prices(monkeypatch):
    """Recommendation endpoint tests must never depend on live fuel prices."""
    monkeypatch.setattr(
        "smartcart.api.get_fuel_price",
        lambda settings: FuelPrice(2.60, settings.fuel_price_field, "data.gov.my", "2026-10-08"),
    )
