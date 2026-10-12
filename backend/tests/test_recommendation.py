import pytest

from smartcart.maps import RouteMatrixResult
from smartcart.config import get_settings
from smartcart.fuel import FuelPrice
from smartcart.premises import PremiseCandidate
from smartcart.pricing import StoreBasketSummary
from smartcart.recommendation import (
    TravelCostRate,
    estimate_round_trip_cost_rm,
    apply_basket_pricing,
    rank_reachable_stores,
    straight_line_route_results,
    get_travel_cost_model,
    fuel_cost_breakdown,
)


COST_RATE = TravelCostRate(
    base_fare_per_leg_rm=0,
    per_kilometre_rm=0.5,
    description="test rate",
)


def test_fuel_breakdown_matches_return_total_and_ranking():
    rate = get_travel_cost_model(get_settings(), FuelPrice(2.60, "ron95", "data.gov.my", "2026-10-08"))["car"]
    stores = rank_reachable_stores(
        candidates=[candidate()], route_results=[route(0, 10_000, 600)],
        limit_type="distance", limit_value=20, cost_rate=rate,
    )
    store = stores[0]
    assert store.estimated_round_trip_cost_rm == 3.64
    assert store.travel_cost_breakdown.fuel_cost_rm == 3.64
    assert store.travel_cost_breakdown.fuel_litres == 1.4
    assert store.travel_cost_breakdown.toll_cost_rm is None
    assert store.travel_cost_breakdown.toll_status == "unavailable"
    assert fuel_cost_breakdown(1_000, COST_RATE) is None


def candidate(**overrides) -> PremiseCandidate:
    values = {
        "premise_id": "1",
        "premise_code": "P1",
        "name": "Test Store",
        "address": None,
        "district": "Kota Bharu",
        "state": "Kelantan",
        "google_place_id": "place-1",
        "straight_line_distance_km": 1,
        "sara_status": "unverified",
    }
    values.update(overrides)
    return PremiseCandidate(**values)


def route(index: int, distance: float, duration: float) -> RouteMatrixResult:
    return RouteMatrixResult(
        destination_index=index,
        distance_meters=distance,
        duration_seconds=duration,
    )


@pytest.mark.parametrize("mode, expected_minutes", [
    ("walk", 60), ("public_transport", 12), ("motorcycle", 10), ("car", 10),
])
def test_fallback_travel_time_uses_kilometres_for_speed(mode, expected_minutes):
    candidates = [candidate(straight_line_distance_km=5)]
    routes = straight_line_route_results(candidates, mode)
    assert routes[0].distance_meters == 5_000
    assert routes[0].duration_seconds == expected_minutes * 60
    stores = rank_reachable_stores(
        candidates=candidates, route_results=routes, limit_type="distance",
        limit_value=float("inf"), cost_rate=COST_RATE,
    )
    assert stores[0].estimated_travel_minutes == expected_minutes


def summary(subtotal: float, priced: int, lines: int) -> StoreBasketSummary:
    """A store's basket pricing as produced by pricing.summarize_basket_prices."""
    return StoreBasketSummary(subtotal_rm=subtotal, priced_count=priced, basket_line_count=lines)


def test_calculates_return_trip_cost_from_one_way_route() -> None:
    assert estimate_round_trip_cost_rm(2_000, COST_RATE) == 2


def test_uses_google_transit_fare_for_return_trip_when_available() -> None:
    assert (
        estimate_round_trip_cost_rm(
            20_000,
            COST_RATE,
            one_way_transit_fare_rm=2.35,
        )
        == 4.7
    )


def test_ranking_uses_route_transit_fare_when_available() -> None:
    public_rate = TravelCostRate(
        base_fare_per_leg_rm=1.0,
        per_kilometre_rm=0.08,
        description="public transport",
    )
    recommendations = rank_reachable_stores(
        candidates=[candidate()],
        route_results=[
            RouteMatrixResult(
                destination_index=0,
                distance_meters=20_000,
                duration_seconds=1_200,
                transit_fare_rm=2.35,
            )
        ],
        limit_type="distance",
        limit_value=50,
        cost_rate=public_rate,
    )

    assert recommendations[0].estimated_round_trip_cost_rm == 4.7


def test_filters_using_routed_distance_not_straight_line_distance() -> None:
    recommendations = rank_reachable_stores(
        candidates=[candidate(straight_line_distance_km=1.5)],
        route_results=[route(0, 5_100, 600)],
        limit_type="distance",
        limit_value=5,
        cost_rate=COST_RATE,
    )
    assert recommendations == []


def test_filters_time_limit_using_exact_seconds() -> None:
    recommendations = rank_reachable_stores(
        candidates=[candidate(), candidate(premise_id="2", google_place_id="place-2")],
        route_results=[route(0, 2_000, 1_200), route(1, 2_000, 1_201)],
        limit_type="time",
        limit_value=20,
        cost_rate=COST_RATE,
    )
    assert [store.premise_id for store in recommendations] == ["1"]


def test_filters_combined_limit_using_both_route_dimensions() -> None:
    recommendations = rank_reachable_stores(
        candidates=[
            candidate(),
            candidate(premise_id="2", google_place_id="place-2"),
            candidate(premise_id="3", google_place_id="place-3"),
        ],
        route_results=[
            route(0, 5_000, 1_200),  # both boundaries are inclusive
            route(1, 5_001, 1_000),  # distance fails
            route(2, 4_000, 1_201),  # time fails
        ],
        limit_type="both",
        limit_value=None,
        limit_distance_km=5,
        limit_time_minutes=20,
        cost_rate=COST_RATE,
    )
    assert [store.premise_id for store in recommendations] == ["1"]


def test_sorts_by_cost_then_duration_and_distance() -> None:
    recommendations = rank_reachable_stores(
        candidates=[
            candidate(premise_id="1", name="Far"),
            candidate(premise_id="2", name="Slow", google_place_id="place-2"),
            candidate(premise_id="3", name="Fast", google_place_id="place-3"),
        ],
        route_results=[
            route(0, 3_000, 500),
            route(1, 2_000, 700),
            route(2, 2_000, 600),
        ],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
    )
    assert [store.premise_id for store in recommendations] == ["3", "2", "1"]


def test_sorts_by_basket_plus_transport_cost() -> None:
    ranked = rank_reachable_stores(
        candidates=[
            candidate(premise_id="1", name="Nearby expensive"),
            candidate(premise_id="2", name="Farther affordable", google_place_id="place-2"),
        ],
        route_results=[route(0, 1_000, 300), route(1, 3_000, 600)],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
    )
    recommendations = apply_basket_pricing(ranked, {"1": summary(20, 1, 1), "2": summary(14, 1, 1)})

    assert [store.premise_id for store in recommendations] == ["2", "1"]
    assert recommendations[0].basket_subtotal_rm == 14
    assert recommendations[0].estimated_round_trip_cost_rm == 3
    assert recommendations[0].combined_total_rm == 17

def test_ranks_all_candidates_when_limit_is_unbounded() -> None:
    """Iteration1 expansion pass: infinity limit returns every candidate."""
    recommendations = rank_reachable_stores(
        candidates=[
            candidate(premise_id="1", name="Near"),
            candidate(premise_id="2", name="Far", google_place_id="place-2"),
        ],
        route_results=[route(0, 1_000, 300), route(1, 9_000, 900)],
        limit_type="distance",
        limit_value=float("inf"),
        cost_rate=COST_RATE,
    )
    # No candidate is filtered out; they still sort by cost (near first).
    assert [store.premise_id for store in recommendations] == ["1", "2"]


def test_ignores_missing_store_prices_in_basket_subtotal() -> None:
    ranked = rank_reachable_stores(
        candidates=[candidate()],
        route_results=[route(0, 2_000, 600)],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
    )
    store = apply_basket_pricing(ranked, {"1": summary(8, 1, 2)})[0]

    assert store.basket_subtotal_rm == 8
    assert store.combined_total_rm == 10
    assert store.priced_count == 1
    assert store.basket_line_count == 2
    assert store.is_complete_basket is False

def test_ranks_cheaper_baskets_first_regardless_of_coverage() -> None:
    ranked = rank_reachable_stores(
        candidates=[
            candidate(premise_id="1", name="Incomplete cheap"),
            candidate(premise_id="2", name="Complete basket", google_place_id="place-2"),
        ],
        route_results=[route(0, 1_000, 300), route(1, 1_000, 300)],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
    )
    recommendations = apply_basket_pricing(ranked, {"1": summary(1, 1, 2), "2": summary(10, 2, 2)})

    assert [store.premise_id for store in recommendations] == ["1", "2"]
    assert recommendations[1].is_complete_basket is True

