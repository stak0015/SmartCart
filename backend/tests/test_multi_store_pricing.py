"""US 6.3 — priced comparison of single-store and two-store plans.

Covers every AC 6.3 rule plus the basis invariant that makes the whole story
honest: single-store and two-store plans are compared on the SAME official-price
basis, so the AC 6.3.5 saving subtracts like from like.
"""

import pytest

from smartcart.models import (
    BasketLineRequest,
    MultiStorePlan,
    StoreRecommendation,
)
from smartcart.pricing import BasketLinePrice, StoreBasketSummary
from smartcart.multi_store_pricing import (
    PRICE_BASIS_NOTE,
    _effective_line_map,
    allocate_basket,
    build_plan_comparison,
)

MILK = 1
BREAD = 2


# ---------------------------------------------------------------- helpers


def bl(item_id: int, qty: int) -> BasketLineRequest:
    return BasketLineRequest(item_id=item_id, quantity=qty)


def line_price(item_id: int, unit_price: float, source: str = "store") -> BasketLinePrice:
    return BasketLinePrice(
        item_id=str(item_id),
        item_name=f"Item {item_id}",
        unit=None,
        quantity=1,
        unit_price_rm=unit_price,
        line_total_rm=unit_price,
        observed_date="2026-08-01" if source == "store" else None,
        sara_eligible=None,
        sara_category_candidate=False,
        price_source=source,
    )


def store_summary(*lines: BasketLinePrice) -> StoreBasketSummary:
    return StoreBasketSummary(
        subtotal_rm=None,
        priced_count=len(lines),
        basket_line_count=len(lines),
        lines=tuple(lines),
    )


def rec(premise_id, name, round_trip, exceeds=False) -> StoreRecommendation:
    return StoreRecommendation(
        premise_id=str(premise_id),
        premise_code=f"P{premise_id}",
        name=name,
        address=None,
        district="D",
        state="S",
        straight_line_distance_km=3.0,
        route_distance_km=3.0,
        estimated_travel_minutes=10,
        estimated_round_trip_cost_rm=round_trip,
        sara_status="unverified",
        exceeds_limit=exceeds,
    )


def two_plan(first_id, second_id, first_name, second_name, travel_cost,
             travel_minutes=20, route_km=8.0, inter_km=4.0) -> MultiStorePlan:
    return MultiStorePlan(
        first_store_premise_id=str(first_id),
        second_store_premise_id=str(second_id),
        first_store_name=first_name,
        second_store_name=second_name,
        inter_store_distance_km=inter_km,
        inter_store_travel_minutes=8,
        total_route_distance_km=route_km,
        total_travel_minutes=travel_minutes,
        total_travel_cost_rm=travel_cost,
        legs=[],
    )


# ---------------------------------------------------------------- AC 6.3.1


def test_allocate_full_quantity_to_one_store_never_split():
    """Milk x2 goes entirely to the cheaper store; it is never 1 + 1."""
    official = {
        "1": _effective_line_map(store_summary(line_price(MILK, 3.00))),
        "2": _effective_line_map(store_summary(line_price(MILK, 2.50))),
    }
    subtotal, assignments, missing, priced = allocate_basket(
        basket=[bl(MILK, 2)],
        store_ids=["1", "2"],
        prices_by_store=official,
        store_names={"1": "A", "2": "B"},
        item_names={},
    )
    assert priced == 1
    assert missing == []
    assert len(assignments) == 1  # one line, not split across the two stores
    only = assignments[0]
    assert only.quantity == 2
    assert only.store_premise_id == "2"  # the cheaper official price
    assert only.unit_price_rm == 2.50
    assert only.line_total_rm == pytest.approx(5.00)
    assert float(subtotal) == pytest.approx(5.00)


def test_allocate_uses_official_price_not_median():
    """AC 6.3.1 says 'official price'; a cheaper median must not be used."""
    official = {
        "1": _effective_line_map(store_summary(line_price(MILK, 2.00, "median"))),
        "2": _effective_line_map(store_summary(line_price(MILK, 3.50, "store"))),
    }
    assert official["1"][str(MILK)].price_source == "median"
    _subtotal, assignments, _missing, priced = allocate_basket(
        basket=[bl(MILK, 1)],
        store_ids=["1", "2"],
        prices_by_store=official,
        store_names={"1": "A", "2": "B"},
        item_names={},
    )
    assert priced == 1
    assert assignments[0].store_premise_id == "2"
    assert assignments[0].unit_price_rm == 3.50


def test_allocate_reports_line_missing_when_no_official_price():
    official = {"1": _effective_line_map(store_summary(line_price(MILK, 3.00)))}
    _subtotal, assignments, missing, priced = allocate_basket(
        basket=[bl(MILK, 1), bl(BREAD, 1)],
        store_ids=["1", "2"],
        prices_by_store=official,
        store_names={"1": "A", "2": "B"},
        item_names={str(BREAD): "Eggs"},
    )
    assert priced == 1
    assert len(assignments) == 2
    assert assignments[1].unit_price_rm is None
    assert assignments[1].line_total_rm is None
    assert missing == ["Eggs"]


def test_allocate_picks_cheapest_official_price_across_stores():
    official = {
        "1": _effective_line_map(store_summary(line_price(MILK, 3.00))),
        "2": _effective_line_map(store_summary(line_price(MILK, 2.50))),
        "3": _effective_line_map(store_summary(line_price(MILK, 2.75))),
    }
    _subtotal, assignments, _missing, _priced = allocate_basket(
        basket=[bl(MILK, 1)],
        store_ids=["1", "2", "3"],
        prices_by_store=official,
        store_names={},
        item_names={},
    )
    assert assignments[0].store_premise_id == "2"


# ---------------------------------------------------------------- AC 6.3.2


def test_two_store_combined_is_subtotal_plus_full_loop_transport():
    pricing = {
        "1": store_summary(line_price(MILK, 3.00)),
        "2": store_summary(line_price(MILK, 2.50)),
    }
    pricing["1"] = store_summary(*pricing["1"].lines, line_price(BREAD, 1.00))
    pricing["2"] = store_summary(*pricing["2"].lines, line_price(BREAD, 2.00))
    comparison = build_plan_comparison(
        recommendations=[],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=4.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    plan = comparison.complete_plans[0]
    assert plan.store_count == 2
    assert plan.basket_subtotal_rm == pytest.approx(6.00)  # 2.50 x 2
    assert plan.transport_cost_rm == pytest.approx(4.00)
    assert plan.combined_total_rm == pytest.approx(10.00)  # subtotal + transport
    assert plan.is_complete


def test_single_store_combined_is_subtotal_plus_round_trip():
    pricing = {
        "1": store_summary(line_price(MILK, 3.00)),
        "2": store_summary(line_price(MILK, 2.50)),
    }
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", round_trip=2.50)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=4.00)],
        pricing=pricing,
        basket=[bl(MILK, 2)],
    )
    single = next(p for p in comparison.complete_plans if p.store_count == 1)
    assert single.basket_subtotal_rm == pytest.approx(6.00)  # 3.00 x 2 at A
    assert single.transport_cost_rm == pytest.approx(2.50)
    assert single.combined_total_rm == pytest.approx(8.50)


# ---------------------------------------------------------------- AC 6.3.3


def test_complete_plans_ranked_by_combined_cost():
    pricing = {
        "1": store_summary(line_price(MILK, 4.00)),
        "2": store_summary(line_price(MILK, 3.00)),
    }
    pricing["1"] = store_summary(*pricing["1"].lines, line_price(BREAD, 1.00))
    pricing["2"] = store_summary(*pricing["2"].lines, line_price(BREAD, 2.00))
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00), rec(2, "B", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=1.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    totals = [p.combined_total_rm for p in comparison.complete_plans]
    assert totals == sorted(totals)
    # two-store 7.00, single B 8.00, single A 10.00
    assert totals == pytest.approx([8.00, 10.00, 11.00])
    assert comparison.complete_plans[0].store_count == 2


def test_rank_tie_break_prefers_fewer_stores():
    pricing = {
        "1": store_summary(line_price(MILK, 4.00)),
        "2": store_summary(line_price(MILK, 3.00)),
    }
    pricing["1"] = store_summary(*pricing["1"].lines, line_price(BREAD, 1.00))
    pricing["2"] = store_summary(*pricing["2"].lines, line_price(BREAD, 2.00))
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=4.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    # single A: 8.00 + 2.00 = 10.00 ; two-store: 6.00 + 4.00 = 10.00
    assert comparison.complete_plans[0].combined_total_rm == pytest.approx(11.00)
    assert comparison.complete_plans[0].store_count == 1  # tie -> fewer stores
    assert comparison.complete_plans[1].store_count == 2


# ---------------------------------------------------------------- AC 6.3.4


def test_incomplete_plans_kept_separate_from_complete():
    pricing = {
        "1": store_summary(line_price(MILK, 4.00)),  # A: milk only
        "2": store_summary(line_price(BREAD, 1.50)),  # B: bread only
    }
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=1.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    assert len(comparison.complete_plans) == 1
    assert comparison.complete_plans[0].store_count == 2
    assert len(comparison.incomplete_plans) == 1
    incomplete = comparison.incomplete_plans[0]
    assert incomplete.store_count == 1
    assert incomplete.missing_items  # bread has no official price at A
    assert not incomplete.is_complete


def test_incomplete_plan_is_never_the_cheapest_complete_option():
    """A cheap-but-incomplete single store must not masquerade as a baseline."""
    pricing = {
        "1": store_summary(line_price(MILK, 1.00)),  # A: very cheap, milk only
        "2": store_summary(line_price(BREAD, 1.50)),  # B: bread only
    }
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=1.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    # Single A is incomplete (no bread), so it cannot be the baseline even
    # though its partial total is the lowest number in the response.
    assert comparison.single_store_baseline_rm is None
    assert all(p.store_count == 2 for p in comparison.complete_plans)


# ---------------------------------------------------------------- AC 6.3.5


def test_saving_uses_cheapest_complete_single_store_baseline():
    pricing = {
        "1": store_summary(line_price(MILK, 3.00)),  # A milk
        "2": store_summary(line_price(BREAD, 3.50)),  # B bread
        "3": store_summary(line_price(MILK, 4.00), line_price(BREAD, 2.10)),  # C
        "4": store_summary(line_price(MILK, 5.00), line_price(BREAD, 2.00)),  # D
    }
    comparison = build_plan_comparison(
        recommendations=[rec(3, "C", 2.00), rec(4, "D", 3.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=1.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    # C: 4.00*2 + 2.10 + 2.00 = 12.10 ; D: 5.00*2 + 2.00 + 3.00 = 15.00
    assert comparison.single_store_baseline_rm == pytest.approx(12.10)  # C, not D
    assert comparison.single_store_baseline_name == "C"
    two = next(p for p in comparison.complete_plans if p.store_count == 2)
    assert two.combined_total_rm == pytest.approx(10.50)
    assert two.saving_vs_single_rm == pytest.approx(1.60)  # 12.10 - 10.50


def test_saving_is_negative_when_the_split_costs_more():
    pricing = {
        "1": store_summary(line_price(MILK, 3.00)),
        "2": store_summary(line_price(MILK, 3.50)),
        "3": store_summary(line_price(MILK, 4.00)),
    }
    pricing["1"] = store_summary(*pricing["1"].lines, line_price(BREAD, 2.00))
    pricing["2"] = store_summary(*pricing["2"].lines, line_price(BREAD, 1.00))
    pricing["3"] = store_summary(*pricing["3"].lines, line_price(BREAD, 1.00))
    comparison = build_plan_comparison(
        recommendations=[rec(3, "C", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=8.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    two = next(p for p in comparison.complete_plans if p.store_count == 2)
    # single C: 8.00 + 2.00 = 10.00 ; two-store: 6.00 + 8.00 = 14.00
    assert comparison.single_store_baseline_rm == pytest.approx(11.00)
    assert two.combined_total_rm == pytest.approx(15.00)
    assert two.saving_vs_single_rm == pytest.approx(-4.00)


# ---------------------------------------------------------------- AC 6.3.6


def test_no_complete_single_store_baseline_shows_no_saving():
    pricing = {
        "1": store_summary(line_price(MILK, 4.00)),  # A milk only
        "2": store_summary(line_price(BREAD, 1.50)),  # B bread only
    }
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00), rec(2, "B", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=1.00)],
        pricing=pricing,
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    two = next(p for p in comparison.complete_plans if p.store_count == 2)
    assert two.is_complete
    # Both single stores are incomplete, so there is no baseline to compare to.
    assert comparison.single_store_baseline_rm is None
    assert two.saving_vs_single_rm is None  # never fabricated, never 0


def test_exceeds_limit_single_store_is_not_a_baseline():
    pricing = {
        "1": store_summary(line_price(MILK, 4.00)),
        "2": store_summary(line_price(MILK, 3.00)),
    }
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00, exceeds=True)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=1.00)],
        pricing=pricing,
        basket=[bl(MILK, 2)],
    )
    # The only single store is beyond the original travel limit, so it is not
    # eligible to be visited first (AC 6.2.1) and cannot anchor a saving.
    assert comparison.single_store_baseline_rm is None
    assert all(p.store_count == 2 for p in comparison.complete_plans)


# ------------------------------------------------------------- gating / notes


def test_returns_none_without_a_basket():
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00)],
        two_store_plans=[two_plan(1, 2, "A", "B", 1.00)],
        pricing={"1": store_summary(line_price(MILK, 3.00))},
        basket=[],
    )
    assert comparison is None


def test_returns_none_without_two_store_plans():
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 2.00)],
        two_store_plans=[],
        pricing={"1": store_summary(line_price(MILK, 3.00))},
        basket=[bl(MILK, 2)],
    )
    assert comparison is None


def test_comparison_discloses_the_official_price_basis():
    pricing = {
        "1": store_summary(line_price(MILK, 3.00)),
        "2": store_summary(line_price(MILK, 2.50)),
    }
    comparison = build_plan_comparison(
        recommendations=[],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=4.00)],
        pricing=pricing,
        basket=[bl(MILK, 2)],
    )
    assert comparison.price_basis_note == PRICE_BASIS_NOTE
    assert "labelled median estimates" in comparison.price_basis_note


def test_median_estimates_complete_both_single_and_two_store_baskets():
    pricing = {
        "1": store_summary(line_price(MILK, 3), line_price(BREAD, 2, "median")),
        "2": store_summary(line_price(MILK, 2), line_price(BREAD, 2, "median")),
    }
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 1), rec(2, "B", 2)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=3)],
        pricing=pricing, basket=[bl(MILK, 2), bl(BREAD, 3)],
    )
    assert comparison.incomplete_plans == []
    assert len(comparison.complete_plans) == 3
    for plan in comparison.complete_plans:
        assert plan.is_complete
        assert plan.priced_line_count == 2
        median = next(line for line in plan.assignments if line.item_id == str(BREAD))
        assert median.price_source == "median"
        assert median.quantity == 3
        assert median.line_total_rm == 6
        assert median.observed_date is None
    two = next(plan for plan in comparison.complete_plans if plan.store_count == 2)
    assert two.basket_subtotal_rm == 10
    assert two.combined_total_rm == 13
    assert two.saving_vs_single_rm == -1


def test_no_effective_prices_does_not_claim_a_zero_basket():
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 1)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=3)],
        pricing={"1": store_summary(), "2": store_summary()}, basket=[bl(MILK, 1)],
    )
    for plan in comparison.incomplete_plans:
        assert plan.basket_subtotal_rm is None
        assert plan.combined_total_rm is None
        assert plan.assignments[0].unit_price_rm is None


def test_two_store_plan_with_no_purchases_at_second_store_is_excluded():
    comparison = build_plan_comparison(
        recommendations=[rec(1, "A", 1), rec(2, "B", 2)],
        two_store_plans=[two_plan(1, 2, "A", "B", travel_cost=3)],
        pricing={"1": store_summary(line_price(MILK, 2), line_price(BREAD, 2)),
                 "2": store_summary(line_price(MILK, 3), line_price(BREAD, 3))},
        basket=[bl(MILK, 2), bl(BREAD, 1)],
    )
    assert len(comparison.complete_plans) == 2
    assert all(plan.store_count == 1 for plan in comparison.complete_plans)
