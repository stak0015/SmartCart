"""Contract tests for the Epic 7 healthier-alternatives endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import create_app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app())


def _alternatives(client: TestClient, item_code: str) -> dict:
    response = client.get(f"/api/items/{item_code}/healthier-alternatives")
    assert response.status_code == 200, response.text
    return response.json()


def test_mapped_item_returns_an_approved_alternative(client: TestClient):
    body = _alternatives(client, "1852")
    assert body["item_code"] == "1852"
    assert body["count"] >= 1
    alternative = body["alternatives"][0]
    assert alternative["rule"] == "H2"
    assert alternative["comparison_nutrient"] == "fat_g"
    assert alternative["comparison_direction"] == "lower_is_better"
    assert alternative["headline"]
    assert alternative["item"]["item_code"] == "225"
    assert alternative["item"]["package_size"]


def test_alternative_identifies_both_sources_and_entries(client: TestClient):
    alternative = _alternatives(client, "1852")["alternatives"][0]
    original = alternative["original_source"]
    replacement = alternative["alternative_source"]
    for source in (original, replacement):
        assert source["dataset"] and source["dataset_name"]
        assert source["record_code"] and source["description"]
        assert source["basis"] == "per_100g"


def test_comparison_is_on_one_basis_with_labelled_units(client: TestClient):
    alternative = _alternatives(client, "1852")["alternatives"][0]
    nutrients = {row["nutrient"]: row for row in alternative["nutrients"]}
    assert nutrients["fat_g"]["status"] == "comparable"
    assert nutrients["fat_g"]["unit"] == "g"
    assert nutrients["fat_g"]["alternative_value"] < nutrients["fat_g"]["original_value"]
    for row in alternative["nutrients"]:
        assert row["status"] in {"comparable", "non_comparable", "unavailable"}
        assert row["unit"]


def test_missing_values_are_reported_not_zeroed(client: TestClient):
    """AC 7.3.11: an absent value is 'unavailable', never 0."""
    nutrients = _alternatives(client, "1852")["alternatives"][0]["nutrients"]
    unavailable = [row for row in nutrients if row["status"] == "unavailable"]
    for row in unavailable:
        assert row["original_value"] is None or row["alternative_value"] is None


def test_unmapped_item_returns_no_alternatives(client: TestClient):
    body = _alternatives(client, "992")
    assert body["count"] == 0
    assert body["alternatives"] == []


def test_unknown_item_code_returns_no_alternatives(client: TestClient):
    body = _alternatives(client, "NOT-A-REAL-CODE")
    assert body["count"] == 0


def test_trade_off_nutrients_are_included(client: TestClient):
    """AC 7.3.6: the comparison lists more than the headline nutrient."""
    nutrients = _alternatives(client, "1371")["alternatives"][0]["nutrients"]
    keys = {row["nutrient"] for row in nutrients}
    assert {"fat_g", "saturated_fat_g", "energy_kcal"} <= keys


def test_generic_mapping_is_disclosed(client: TestClient):
    """AC 7.3.10: a generic food entry must be flagged."""
    alternative = _alternatives(client, "1371")["alternatives"][0]
    assert alternative["rule"] == "H8"
    assert alternative["generic_mapping"] is True


def test_non_dairy_creamer_cannot_use_a_dairy_milk_reference(client: TestClient):
    body = _alternatives(client, "883")
    assert body["count"] == 0
    assert body["alternatives"] == []
