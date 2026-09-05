from smartcart.maps import RouteMatrixResult
from smartcart.models import BasketItemPrice
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


def priced_line(item_id: str, unit_price: float, quantity: int = 1) -> BasketItemPrice:
    return BasketItemPrice(
        item_id=item_id,
        item_name=f"Item {item_id}",
        package_size=None,
        quantity=quantity,
        unit_price_rm=unit_price,
        line_total_rm=unit_price * quantity,
        price_observed_date=None,
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
    recommendations = rank_reachable_stores(
        candidates=[
            candidate(premise_id="1", name="Nearby expensive"),
            candidate(
                premise_id="2",
                name="Farther affordable",
                google_place_id="place-2",
            ),
        ],
        route_results=[route(0, 1_000, 300), route(1, 3_000, 600)],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
        basket_prices_by_premise={
            "1": [priced_line("10", 10, quantity=2)],
            "2": [priced_line("10", 7, quantity=2)],
        },
    )

    assert [store.premise_id for store in recommendations] == ["2", "1"]
    assert recommendations[0].basket_cost_rm == 14
    assert recommendations[0].estimated_round_trip_cost_rm == 3
    assert recommendations[0].estimated_total_cost_rm == 17


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
    missing_line = BasketItemPrice(
        item_id="11",
        item_name="Unpriced item",
        package_size=None,
        quantity=3,
        unit_price_rm=None,
        line_total_rm=None,
        price_observed_date=None,
    )
    recommendations = rank_reachable_stores(
        candidates=[candidate()],
        route_results=[route(0, 2_000, 600)],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
        basket_prices_by_premise={
            "1": [priced_line("10", 4, quantity=2), missing_line]
        },
    )

    store = recommendations[0]
    assert store.basket_cost_rm == 8
    assert store.estimated_total_cost_rm == 10
    assert store.priced_item_count == 1
    assert store.basket_item_count == 2
    assert store.is_complete_basket is False
    assert store.basket_prices[1].unit_price_rm is None


def test_ranks_complete_baskets_before_cheaper_incomplete_baskets() -> None:
    missing_line = BasketItemPrice(
        item_id="11",
        item_name="Missing item",
        package_size=None,
        quantity=1,
        unit_price_rm=None,
        line_total_rm=None,
        price_observed_date=None,
    )
    recommendations = rank_reachable_stores(
        candidates=[
            candidate(premise_id="1", name="Incomplete cheap"),
            candidate(
                premise_id="2",
                name="Complete basket",
                google_place_id="place-2",
            ),
        ],
        route_results=[route(0, 1_000, 300), route(1, 1_000, 300)],
        limit_type="distance",
        limit_value=10,
        cost_rate=COST_RATE,
        basket_prices_by_premise={
            "1": [priced_line("10", 1), missing_line],
            "2": [priced_line("10", 5), priced_line("11", 5)],
        },
    )

    assert [store.premise_id for store in recommendations] == ["2", "1"]
    assert recommendations[0].is_complete_basket is True
