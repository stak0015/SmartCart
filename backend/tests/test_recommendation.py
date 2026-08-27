from smartcart.maps import RouteMatrixResult
from smartcart.premises import PremiseCandidate
from smartcart.recommendation import (
    TravelCostRate,
    estimate_round_trip_cost_rm,
    rank_reachable_stores,
)


COST_RATE = TravelCostRate(
    base_fare_per_leg_rm=0,
    per_kilometre_rm=0.5,
    description="test rate",
)


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


def test_calculates_return_trip_cost_from_one_way_route() -> None:
    assert estimate_round_trip_cost_rm(2_000, COST_RATE) == 2


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
