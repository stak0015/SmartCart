from decimal import Decimal

from smartcart.models import BasketLineRequest, StoreRecommendation
from smartcart.pricing import StoreBasketSummary, summarize_basket_prices
from smartcart.recommendation import apply_basket_pricing


def line(item_id: str, quantity: int) -> BasketLineRequest:
    return BasketLineRequest(item_id=item_id, quantity=quantity)


def store(premise_id: str, cost: float) -> StoreRecommendation:
    return StoreRecommendation(
        premise_id=premise_id,
        premise_code=f"P{premise_id}",
        name=f"Store {premise_id}",
        address=None,
        district="Kota Bharu",
        state="Kelantan",
        straight_line_distance_km=1.0,
        route_distance_km=2.0,
        estimated_travel_minutes=10,
        estimated_round_trip_cost_rm=cost,
        sara_status="unverified",
    )


# Row shape: (premise_id, item_id, quantity, item_name, current_price,
#             sara_eligible, item_category)

def test_sums_line_totals_with_decimal_money_math() -> None:
    rows = [
        (1, 10, 3, "Beras", Decimal("0.07"), None, "BERAS"),
        (1, 11, 1, "Minyak", Decimal("0.13"), None, "LAUK"),
    ]
    summary = summarize_basket_prices(rows)["1"]
    # 3 * 0.07 + 0.13 = 0.34 exactly; a float pipeline would risk 0.340000...1
    assert summary.total_rm == 0.34
    assert summary.missing_items == []


def test_store_with_unpriced_line_is_incomplete() -> None:
    rows = [
        (1, 10, 1, "Beras", Decimal("5.00"), None, "BERAS"),
        (1, 11, 2, "Telur", None, None, "TELUR"),
        (2, 10, 1, "Beras", Decimal("6.00"), None, "BERAS"),
        (2, 11, 2, "Telur", Decimal("0.50"), None, "TELUR"),
    ]
    summaries = summarize_basket_prices(rows)
    assert summaries["1"].total_rm is None
    assert summaries["1"].missing_items == ["Telur"]
    assert summaries["2"].total_rm == 7.0
    assert summaries["2"].missing_items == []


def test_unknown_item_id_counts_as_missing() -> None:
    rows = [(1, 999, 1, None, None, None, None)]
    summary = summarize_basket_prices(rows)["1"]
    assert summary.total_rm is None
    assert summary.missing_items == ["Unknown item 999"]


def test_credit_and_cash_split_reconciles_to_total() -> None:
    rows = [
        (1, 10, 2, "Beras", Decimal("5.15"), None, "BERAS"),
        (1, 11, 1, "Ayam", Decimal("9.99"), None, "LAUK"),
        (1, 12, 1, "Ubat", Decimal("4.01"), True, "LAUK"),
    ]
    summary = summarize_basket_prices(rows)["1"]
    assert summary.total_rm == 24.30
    # credit = 2*5.15 + 4.01 (verified flag wins over the LAUK category)
    assert summary.sara_credit_rm == 14.31
    assert summary.cash_needed_rm == 9.99
    assert summary.sara_credit_rm + summary.cash_needed_rm == summary.total_rm


def test_basket_without_eligible_items_is_all_cash() -> None:
    rows = [
        (1, 10, 1, "Ayam", Decimal("9.00"), None, "LAUK"),
        (1, 11, 1, "Sayur", Decimal("3.50"), False, "SAYUR-SAYURAN"),
    ]
    summary = summarize_basket_prices(rows)["1"]
    assert summary.total_rm == 12.50
    assert summary.sara_credit_rm == 0.0
    assert summary.cash_needed_rm == 12.50


def test_incomplete_store_has_no_credit_or_cash() -> None:
    rows = [(1, 10, 1, "Beras", None, None, "BERAS")]
    summary = summarize_basket_prices(rows)["1"]
    assert summary.total_rm is None
    assert summary.sara_credit_rm is None
    assert summary.cash_needed_rm is None


def test_complete_stores_sort_by_total_then_incomplete_last() -> None:
    recommendations = [
        store("1", cost=1.0),
        store("2", cost=0.5),
        store("3", cost=0.2),
    ]
    pricing = {
        "1": StoreBasketSummary(total_rm=10.0, sara_credit_rm=4.0, cash_needed_rm=6.0),
        "2": StoreBasketSummary(total_rm=None, missing_items=["Beras"]),
        "3": StoreBasketSummary(total_rm=12.0, sara_credit_rm=0.0, cash_needed_rm=12.0),
    }
    ordered = apply_basket_pricing(recommendations, pricing)
    assert [s.premise_id for s in ordered] == ["1", "3", "2"]
    assert ordered[0].basket_total_rm == 10.0
    assert ordered[0].sara_credit_rm == 4.0
    assert ordered[0].cash_needed_rm == 6.0
    assert ordered[2].missing_items == ["Beras"]
    assert ordered[2].sara_credit_rm is None
    assert ordered[2].cash_needed_rm is None


def test_incomplete_stores_keep_reachability_order() -> None:
    recommendations = [store("1", cost=0.9), store("2", cost=0.1)]
    pricing = {
        "1": StoreBasketSummary(total_rm=None, missing_items=["Beras"]),
        "2": StoreBasketSummary(total_rm=None, missing_items=["Telur"]),
    }
    ordered = apply_basket_pricing(recommendations, pricing)
    assert [s.premise_id for s in ordered] == ["1", "2"]
