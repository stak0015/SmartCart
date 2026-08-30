from datetime import date
from decimal import Decimal

from smartcart.models import BasketLineRequest, StoreRecommendation
from smartcart.pricing import (
    PRICE_FRESHNESS_THRESHOLD_DAYS,
    StoreBasketSummary,
    summarize_basket_prices,
)
from smartcart.recommendation import apply_basket_pricing

TODAY = date(2026, 8, 30)
FRESH = date(2026, 8, 27)
STALE = date(2026, 1, 1)


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


# Row shape: (premise_id, item_id, quantity, item_name, unit, current_price,
#             sara_eligible, item_category, price_observed_date)

def test_sums_line_totals_with_decimal_money_math() -> None:
    rows = [
        (1, 10, 3, "Beras", "5kg", Decimal("0.07"), None, "BERAS", FRESH),
        (1, 11, 1, "Minyak", "1kg", Decimal("0.13"), None, "LAUK", FRESH),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    # 3 * 0.07 + 0.13 = 0.34 exactly; a float pipeline would risk 0.340000...1
    assert summary.subtotal_rm == 0.34
    assert summary.missing_items == []
    assert summary.is_complete


def test_missing_price_excluded_from_subtotal_not_zero() -> None:
    rows = [
        (1, 10, 1, "Beras", "5kg", Decimal("5.00"), None, "BERAS", FRESH),
        (1, 11, 2, "Telur", "30 biji", None, None, "TELUR", None),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    # Partial total covers only the priced line; the unpriced line is
    # excluded, never counted as RM0.00.
    assert summary.subtotal_rm == 5.0
    assert not summary.is_complete
    assert summary.priced_count == 1
    assert summary.basket_line_count == 2
    assert summary.missing_items == ["Telur"]
    unpriced = summary.lines[1]
    assert unpriced.unit_price_rm is None
    assert unpriced.line_total_rm is None
    assert unpriced.observed_date is None


def test_non_positive_price_is_not_a_valid_price() -> None:
    rows = [
        (1, 10, 1, "Beras", "5kg", Decimal("0.00"), None, "BERAS", FRESH),
        (1, 11, 1, "Minyak", "1kg", Decimal("-1.00"), None, "LAUK", FRESH),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    assert summary.subtotal_rm is None
    assert summary.priced_count == 0
    assert summary.missing_items == ["Beras", "Minyak"]


def test_unknown_item_id_counts_as_missing() -> None:
    rows = [(1, 999, 1, None, None, None, None, None, None)]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    assert summary.subtotal_rm is None
    assert summary.missing_items == ["Unknown item 999"]
    assert summary.price_observed_days_ago is None


def test_credit_and_cash_split_reconciles_to_partial_subtotal() -> None:
    rows = [
        (1, 10, 2, "Beras", "5kg", Decimal("5.15"), None, "BERAS", FRESH),
        (1, 11, 1, "Ayam", "1kg", Decimal("9.99"), None, "LAUK", FRESH),
        (1, 12, 1, "Ubat", "1 pkt", Decimal("4.01"), True, "LAUK", FRESH),
        (1, 13, 1, "Telur", "30 biji", None, None, "TELUR", None),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    assert summary.subtotal_rm == 24.30
    # credit = 2*5.15 + 4.01 (verified flag wins over the LAUK category)
    assert summary.sara_credit_rm == 14.31
    assert summary.cash_needed_rm == 9.99
    assert summary.sara_credit_rm + summary.cash_needed_rm == summary.subtotal_rm
    assert summary.priced_count == 3
    assert summary.basket_line_count == 4


def test_basket_without_eligible_items_is_all_cash() -> None:
    rows = [
        (1, 10, 1, "Ayam", "1kg", Decimal("9.00"), None, "LAUK", FRESH),
        (1, 11, 1, "Sayur", "1kg", Decimal("3.50"), False, "SAYUR-SAYURAN", FRESH),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    assert summary.subtotal_rm == 12.50
    assert summary.sara_credit_rm == 0.0
    assert summary.cash_needed_rm == 12.50


def test_priced_line_detail_carries_unit_price_total_and_date() -> None:
    rows = [
        (1, 10, 2, "Beras", "5kg", Decimal("5.15"), None, "BERAS", STALE),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    detail = summary.lines[0]
    assert detail.item_id == "10"
    assert detail.item_name == "Beras"
    assert detail.unit == "5kg"
    assert detail.quantity == 2
    assert detail.unit_price_rm == 5.15
    assert detail.line_total_rm == 10.30
    assert detail.observed_date == "2026-01-01"


def test_days_ago_uses_oldest_priced_basket_line() -> None:
    rows = [
        (1, 10, 1, "Beras", "5kg", Decimal("5.00"), None, "BERAS", FRESH),
        (1, 11, 1, "Ayam", "1kg", Decimal("9.00"), None, "LAUK", STALE),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    # 2026-08-30 minus 2026-01-01 = 241 days, driven by the oldest line
    assert summary.price_observed_days_ago == 241


def test_days_ago_threshold_boundary() -> None:
    assert PRICE_FRESHNESS_THRESHOLD_DAYS == 7
    for observed, expected in (
        (date(2026, 8, 23), 7),  # exactly at the threshold: no warning
        (date(2026, 8, 22), 8),  # one day past it: warning shows
    ):
        rows = [(1, 10, 1, "Beras", "5kg", Decimal("5.00"), None, "BERAS", observed)]
        summary = summarize_basket_prices(rows, today=TODAY)["1"]
        assert summary.price_observed_days_ago == expected
        assert (summary.price_observed_days_ago > PRICE_FRESHNESS_THRESHOLD_DAYS) is (
            expected > 7
        )


def test_incomplete_store_still_reports_price_age() -> None:
    rows = [
        (1, 10, 1, "Beras", "5kg", Decimal("5.00"), None, "BERAS", STALE),
        (1, 11, 1, "Telur", "30 biji", None, None, "TELUR", None),
    ]
    summary = summarize_basket_prices(rows, today=TODAY)["1"]
    assert summary.subtotal_rm == 5.0
    assert summary.price_observed_days_ago == 241


def test_complete_stores_sort_by_combined_cost_then_incomplete_last() -> None:
    recommendations = [
        store("1", cost=1.0),
        store("2", cost=0.5),
        store("3", cost=0.2),
    ]
    pricing = {
        # subtotal 10.0 + transport 1.0 = combined 11.0
        "1": StoreBasketSummary(
            subtotal_rm=10.0, priced_count=2, basket_line_count=2,
            sara_credit_rm=4.0, cash_needed_rm=6.0, price_observed_days_ago=3,
        ),
        "2": StoreBasketSummary(
            subtotal_rm=4.0, priced_count=1, basket_line_count=2,
            missing_items=["Beras"],
        ),
        # subtotal 10.5 + transport 0.2 = combined 10.7 beats store 1
        "3": StoreBasketSummary(
            subtotal_rm=10.5, priced_count=2, basket_line_count=2,
            sara_credit_rm=0.0, cash_needed_rm=10.5, price_observed_days_ago=30,
        ),
    }
    ordered = apply_basket_pricing(recommendations, pricing)
    assert [s.premise_id for s in ordered] == ["3", "1", "2"]
    assert ordered[0].combined_total_rm == 10.7
    assert ordered[1].combined_total_rm == 11.0
    assert ordered[0].basket_subtotal_rm == 10.5
    assert ordered[1].sara_credit_rm == 4.0
    assert ordered[1].price_observed_days_ago == 3
    # Incomplete store keeps its partial subtotal and coverage, no combined
    assert ordered[2].basket_subtotal_rm == 4.0
    assert ordered[2].combined_total_rm is None
    assert ordered[2].priced_count == 1
    assert ordered[2].basket_line_count == 2
    assert ordered[2].missing_items == ["Beras"]


def test_combined_ranking_tie_breaks_by_time_distance_name_id() -> None:
    def full_summary() -> StoreBasketSummary:
        return StoreBasketSummary(
            subtotal_rm=10.0, priced_count=1, basket_line_count=1
        )

    a = store("2", cost=1.0)
    a.estimated_travel_minutes = 12
    b = store("1", cost=1.0)
    b.estimated_travel_minutes = 9
    # Same combined total 11.0; shorter travel time wins
    ordered = apply_basket_pricing([a, b], {"1": full_summary(), "2": full_summary()})
    assert [s.premise_id for s in ordered] == ["1", "2"]


def test_basket_lines_detail_attached() -> None:
    rows = [
        (1, 10, 2, "Beras", "5kg", Decimal("5.15"), None, "BERAS", FRESH),
        (1, 11, 1, "Telur", "30 biji", None, None, "TELUR", None),
    ]
    pricing = summarize_basket_prices(rows, today=TODAY)
    ordered = apply_basket_pricing([store("1", cost=0.5)], pricing)
    lines = ordered[0].basket_lines
    assert len(lines) == 2
    assert lines[0].item_name == "Beras"
    assert lines[0].unit == "5kg"
    assert lines[0].quantity == 2
    assert lines[0].unit_price_rm == 5.15
    assert lines[0].line_total_rm == 10.30
    assert lines[0].observed_date == "2026-08-27"
    assert lines[1].item_name == "Telur"
    assert lines[1].unit_price_rm is None
    assert lines[1].line_total_rm is None
    assert lines[1].observed_date is None


def test_incomplete_stores_keep_reachability_order() -> None:
    recommendations = [store("1", cost=0.9), store("2", cost=0.1)]
    pricing = {
        "1": StoreBasketSummary(
            subtotal_rm=3.0, priced_count=1, basket_line_count=2,
            missing_items=["Beras"],
        ),
        "2": StoreBasketSummary(
            subtotal_rm=1.0, priced_count=1, basket_line_count=2,
            missing_items=["Telur"],
        ),
    }
    ordered = apply_basket_pricing(recommendations, pricing)
    assert [s.premise_id for s in ordered] == ["1", "2"]


def test_store_without_pricing_summary_is_untouched() -> None:
    recommendations = [store("1", cost=0.9)]
    ordered = apply_basket_pricing(recommendations, {})
    assert ordered[0].basket_subtotal_rm is None
    assert ordered[0].priced_count is None
