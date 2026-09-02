from contextlib import contextmanager
from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from main import create_app
from smartcart.alternatives import (
    BasketAlternative,
    AlternativePriceItem,
    get_basket_alternatives,
    package_basis,
    product_family,
)
from smartcart.models import BasketLineRequest


TODAY = date(2026, 8, 31)


def test_family_and_package_keys_are_conservative() -> None:
    assert product_family("SARDIN CAP AYAM (SOS TOMATO)") == "SARDIN"
    assert product_family("MACKAREL CAP AYAM (SOS TOMATO)") == "MACKAREL"
    assert product_family("SOS TOMATO MAGGI") == "SOS TOMATO MAGGI"
    assert package_basis("SARDIN CAP AYAM (SOS TOMATO)", "425 g") == "425 G"
    assert package_basis("SARDIN CAP AYAM (SOS TOMATO)", "155 g") == "155 G"


def test_get_basket_alternatives_chooses_cheapest_same_family(monkeypatch) -> None:
    source_rows = [
        (1, 2, "SARDIN CAP SOURCE (SOS TOMATO)", "425 g", "IKAN DALAM TIN", None, Decimal("8.00"), TODAY),
    ]
    candidate_rows = [
        (2, "SARDIN CAP CHEAP (SOS TOMATO)", "425 g", "IKAN DALAM TIN", None, Decimal("5.00"), TODAY),
        (3, "MACKAREL CAP CHEAP (SOS TOMATO)", "425 g", "IKAN DALAM TIN", None, Decimal("1.00"), TODAY),
        (4, "SARDIN CAP DEAR (SOS TOMATO)", "425 g", "IKAN DALAM TIN", None, Decimal("9.00"), TODAY),
        (5, "SARDIN CAP SMALL (SOS TOMATO)", "155 g", "IKAN DALAM TIN", None, Decimal("2.00"), TODAY),
    ]

    class Cursor:
        def __init__(self) -> None:
            self.rows = []

        def execute(self, query, _params) -> None:
            self.rows = source_rows if "WITH requested" in query else candidate_rows

        def fetchall(self):
            return self.rows

    @contextmanager
    def fake_cursor():
        yield Cursor()

    monkeypatch.setattr("smartcart.alternatives.database_cursor", fake_cursor)
    lines = get_basket_alternatives("10", [BasketLineRequest(item_id=1, quantity=2)], today=TODAY)

    assert len(lines) == 1
    assert lines[0].source.line_total_rm == 16.0
    assert lines[0].alternative is not None
    assert lines[0].alternative.item_id == "2"
    assert lines[0].alternative.line_total_rm == 10.0
    assert lines[0].savings_rm == 6.0


def test_alternatives_endpoint_returns_camel_case_contract(monkeypatch) -> None:
    source = AlternativePriceItem(
        item_id="1", item_name="SARDIN", unit="425 g", package_size="425 g",
        unit_price_rm=8.0, line_total_rm=8.0, observed_date=TODAY,
        price_observed_days_ago=0, sara_eligible=None,
        sara_category_candidate=True, is_sara_credit_candidate=True,
    )
    alternative = AlternativePriceItem(
        item_id="2", item_name="SARDIN CHEAP", unit="425 g", package_size="425 g",
        unit_price_rm=5.0, line_total_rm=5.0, observed_date=TODAY,
        price_observed_days_ago=0, sara_eligible=None,
        sara_category_candidate=True, is_sara_credit_candidate=True,
    )
    monkeypatch.setattr("smartcart.api.premise_exists", lambda _premise_id: True)
    monkeypatch.setattr(
        "smartcart.api.get_basket_alternatives",
        lambda _premise_id, _basket: [BasketAlternative(1, source, alternative, 3.0)],
    )
    monkeypatch.setattr(
        "smartcart.api.get_pack_options",
        lambda _premise_id, _basket: {},
    )

    response = TestClient(create_app()).post(
        "/api/premises/10/basket-alternatives",
        json={"basket": [{"itemId": "1", "quantity": 1}]},
    )
    assert response.status_code == 200
    assert response.json()["premiseId"] == "10"
    assert response.json()["lines"][0]["alternative"]["itemId"] == "2"
    assert response.json()["lines"][0]["savingsRm"] == 3.0
    assert response.json()["lines"][0]["packOptions"] == []
