"""US 6.2 — second-store travel constraint tests.

Pure-logic coverage for every AC 6.2 rule: the two rule sets stay separate
(6.2.1), hard distance/time limits (6.2.2/6.2.3), AND semantics for ``both``
(6.2.4), visit-order selection (6.2.5), full return loop (6.2.6), exclusion
rather than invention when a route is unavailable (6.2.7), and honest empty
states (6.2.8).
"""

from smartcart.maps import RouteMatrixResult
from smartcart.models import TravelLimit
from smartcart.multi_store import (
    MAX_INTER_STORE_PAIRS,
    haversine_km,
    pair_passes_second_limit,
    plan_multi_store_trips,
    resolve_limit,
    select_pairs_for_routing,
)
from smartcart.premises import PremiseCandidate
from smartcart.recommendation import TravelCostRate

# RM0.50/km with no base fare keeps expected totals easy to verify by hand.
COST_RATE = TravelCostRate(
    base_fare_per_leg_rm=0,
    per_kilometre_rm=0.5,
    description="test rate",
)

HOME = "Home"

DISTANCE_5KM = TravelLimit(type="distance", value=5.0)
TIME_20MIN = TravelLimit(type="time", value=20.0)
BOTH_5KM_20MIN = TravelLimit(type="both", distance_km=5.0, time_minutes=20.0)


def candidate(premise_id: str, name: str, place_id: str | None = None) -> PremiseCandidate:
    return PremiseCandidate(
        premise_id=premise_id,
        premise_code=f"P{premise_id}",
        name=name,
        address=None,
        district="Petaling",
        state="Selangor",
        google_place_id=place_id or f"place-{premise_id}",
        straight_line_distance_km=1.0,
        sara_status="unverified",
    )


def origin_route(distance_meters: float, duration_seconds: float) -> RouteMatrixResult:
    return RouteMatrixResult(
        destination_index=0,
        distance_meters=distance_meters,
        duration_seconds=duration_seconds,
    )


def inter_route(
    distance_meters: float,
    duration_seconds: float,
    *,
    origin_index: int = 0,
    destination_index: int = 0,
) -> RouteMatrixResult:
    return RouteMatrixResult(
        destination_index=destination_index,
        distance_meters=distance_meters,
        duration_seconds=duration_seconds,
        origin_index=origin_index,
    )


STORE_A = candidate("1", "Kedai A")
STORE_B = candidate("2", "Kedai B")
COORDINATES = {"1": (3.10, 101.60), "2": (3.12, 101.62)}


def plan_request(
    *,
    inter_store_routes: dict[tuple[str, str], RouteMatrixResult],
    second_store_limit: TravelLimit,
    candidates: list[PremiseCandidate] | None = None,
    reachable: list[str] | None = None,
    origin_routes: dict[str, RouteMatrixResult] | None = None,
    pairs: list[tuple[str, str]] | None = None,
):
    """Call the planner with sensible defaults for the common two-store case."""
    candidates = candidates or [STORE_A, STORE_B]
    # ``reachable or default`` would swallow an intentionally empty list, which
    # is itself a test case (AC 6.2.8), so only substitute when not provided.
    reachable = ["1", "2"] if reachable is None else reachable
    origin_routes = origin_routes or {
        # home -> A is short, home -> B is long, so A-first is cheaper overall.
        "1": origin_route(2_000, 300),
        "2": origin_route(10_000, 900),
    }
    if pairs is None:
        pairs = [
            (first, second)
            for first in candidates
            for second in candidates
            if first.premise_id != second.premise_id
        ]
        pairs = [(first.premise_id, second.premise_id) for first, second in pairs]
    return plan_multi_store_trips(
        candidates=candidates,
        reachable_first_store_ids=reachable,
        pairs=pairs,
        origin_routes=origin_routes,
        inter_store_routes=inter_store_routes,
        second_store_limit=second_store_limit,
        cost_rate=COST_RATE,
        home_name=HOME,
    )


# ---------------------------------------------------------------- AC 6.2.1


def test_first_store_limit_is_never_reapplied_by_the_planner() -> None:
    """Only the caller's reachable list governs the home -> first-store leg.

    The planner deliberately has no knowledge of the original travel limit, so
    the second-store limit cannot be applied to the home leg by construction.
    A store 30 km away that the caller already cleared stays eligible, while a
    store the caller excluded can never become a first store.
    """
    far_store = candidate("3", "Kedai Jauh")
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(1_000, 120)},
        second_store_limit=DISTANCE_5KM,
        candidates=[STORE_A, STORE_B, far_store],
        # Store 3 is 30 km from home but was cleared by the first-store limit.
        reachable=["1", "2", "3"],
        origin_routes={
            "1": origin_route(2_000, 300),
            "2": origin_route(10_000, 900),
            "3": origin_route(30_000, 2_400),
        },
    )
    visited_first = {plan.first_store_premise_id for plan in result.plans}
    assert visited_first <= {"1", "2", "3"}
    assert result.plans, "a cleared distant store may still be visited first"


def test_store_excluded_by_first_limit_cannot_be_visited_first() -> None:
    """AC 6.2.1: a store outside the original limit is never a first stop.

    Store 2 is reachable only as a *second* store here, so no plan may list it
    first even though the inter-store leg itself is trivially short.
    """
    result = plan_request(
        inter_store_routes={
            ("1", "2"): inter_route(1_000, 120),
            ("2", "1"): inter_route(1_000, 120),
        },
        second_store_limit=DISTANCE_5KM,
        reachable=["1"],
        pairs=[("1", "2")],
    )
    assert all(plan.first_store_premise_id == "1" for plan in result.plans)


# ---------------------------------------------------------------- AC 6.2.2


def test_inter_store_leg_over_time_limit_is_excluded() -> None:
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(3_000, 25 * 60)},
        second_store_limit=TIME_20MIN,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert result.plans == []
    assert result.empty_reason == "no_pairs_within_limit"


def test_inter_store_leg_exactly_at_time_limit_is_included() -> None:
    """Boundary: the limit is inclusive, matching single-store behaviour."""
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(3_000, 20 * 60)},
        second_store_limit=TIME_20MIN,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert len(result.plans) == 1


# ---------------------------------------------------------------- AC 6.2.3


def test_inter_store_leg_over_distance_limit_is_excluded() -> None:
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(8_000, 600)},
        second_store_limit=DISTANCE_5KM,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert result.plans == []
    assert result.empty_reason == "no_pairs_within_limit"


def test_inter_store_leg_exactly_at_distance_limit_is_included() -> None:
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(5_000, 600)},
        second_store_limit=DISTANCE_5KM,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert len(result.plans) == 1


# ---------------------------------------------------------------- AC 6.2.4


def test_both_mode_requires_distance_and_time_together() -> None:
    """Distance passes but time fails -> the plan must still be excluded."""
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(3_000, 25 * 60)},
        second_store_limit=BOTH_5KM_20MIN,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert result.plans == []


def test_both_mode_excludes_when_time_passes_but_distance_fails() -> None:
    """The mirror case, so AND cannot be mistaken for OR."""
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(8_000, 10 * 60)},
        second_store_limit=BOTH_5KM_20MIN,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert result.plans == []


def test_both_mode_includes_when_both_limits_pass() -> None:
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(3_000, 10 * 60)},
        second_store_limit=BOTH_5KM_20MIN,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert len(result.plans) == 1


def test_pair_passes_second_limit_treats_missing_ceiling_as_unconstrained() -> None:
    """A distance-only limit must not reject a leg on duration, and vice versa."""
    long_but_close = inter_route(4_000, 60 * 60)
    assert pair_passes_second_limit(long_but_close, resolve_limit(DISTANCE_5KM))
    assert not pair_passes_second_limit(long_but_close, resolve_limit(TIME_20MIN))


# ---------------------------------------------------------------- AC 6.2.5


def test_cheaper_visit_order_is_chosen_and_the_other_is_reported() -> None:
    """home->A(2km) + A->B(1km) + B->home(10km) = 13km = RM6.50
    home->B(10km) + B->A(3km) + A->home(2km) = 15km = RM7.50
    The asymmetric inter-store leg makes the order choice observable.
    """
    result = plan_request(
        inter_store_routes={
            ("1", "2"): inter_route(1_000, 120),
            ("2", "1"): inter_route(3_000, 360),
        },
        second_store_limit=DISTANCE_5KM,
        reachable=["1", "2"],
        pairs=[("1", "2"), ("2", "1")],
    )
    # One plan per store pair, not one per direction.
    assert len(result.plans) == 1
    plan = result.plans[0]
    assert plan.first_store_premise_id == "1"
    assert plan.second_store_premise_id == "2"
    assert plan.total_travel_cost_rm == 6.5
    assert plan.reverse_order_cost_rm == 7.5


def test_both_orders_eligible_still_yields_one_plan_per_pair() -> None:
    result = plan_request(
        inter_store_routes={
            ("1", "2"): inter_route(2_000, 240),
            ("2", "1"): inter_route(2_000, 240),
        },
        second_store_limit=DISTANCE_5KM,
        reachable=["1", "2"],
        pairs=[("1", "2"), ("2", "1")],
    )
    assert len(result.plans) == 1


def test_reverse_order_is_not_tried_when_second_store_is_not_reachable() -> None:
    """Store 2 fails the first-store limit, so only A->B may be evaluated."""
    result = plan_request(
        inter_store_routes={
            ("1", "2"): inter_route(1_000, 120),
            ("2", "1"): inter_route(1_000, 120),
        },
        second_store_limit=DISTANCE_5KM,
        reachable=["1"],
        pairs=[("1", "2"), ("2", "1")],
    )
    assert [plan.first_store_premise_id for plan in result.plans] == ["1"]
    assert result.plans[0].reverse_order_cost_rm is None


# ---------------------------------------------------------------- AC 6.2.6


def test_plan_covers_the_full_loop_including_the_return_leg() -> None:
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(1_000, 120)},
        second_store_limit=DISTANCE_5KM,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    plan = result.plans[0]
    assert [leg.role for leg in plan.legs] == [
        "origin_to_first",
        "first_to_second",
        "second_to_origin",
    ]
    # 2 km + 1 km + 10 km, and the return leg is genuinely priced, not dropped.
    assert plan.total_route_distance_km == 13.0
    assert plan.total_travel_cost_rm == 6.5
    assert sum(leg.cost_rm for leg in plan.legs) == plan.total_travel_cost_rm
    assert sum(leg.travel_minutes for leg in plan.legs) == plan.total_travel_minutes


def test_return_leg_uses_the_second_store_home_route() -> None:
    """The loop home leg must be the second store's own home route."""
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(1_000, 120)},
        second_store_limit=DISTANCE_5KM,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    return_leg = result.plans[0].legs[-1]
    assert return_leg.from_name == "Kedai B"
    assert return_leg.to_name == HOME
    assert return_leg.distance_km == 10.0


def test_plan_is_dropped_when_the_second_store_has_no_home_route() -> None:
    """Without a return leg the loop cannot be priced, so nothing is shown."""
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(1_000, 120)},
        second_store_limit=DISTANCE_5KM,
        pairs=[("1", "2")],
        reachable=["1"],
        origin_routes={"1": origin_route(2_000, 300)},
    )
    assert result.plans == []
    # The inter-store route existed, so this is not an "unrouteable pair".
    assert result.unrouteable_pair_count == 0


# ---------------------------------------------------------------- AC 6.2.7


def test_pair_without_route_data_is_excluded_not_estimated() -> None:
    result = plan_request(
        inter_store_routes={},
        second_store_limit=DISTANCE_5KM,
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert result.plans == []
    assert result.unrouteable_pair_count == 1
    assert result.empty_reason == "no_inter_store_route_data"


def test_partial_route_data_keeps_only_the_routable_pair() -> None:
    store_c = candidate("3", "Kedai C")
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(1_000, 120)},
        second_store_limit=DISTANCE_5KM,
        candidates=[STORE_A, STORE_B, store_c],
        reachable=["1"],
        origin_routes={
            "1": origin_route(2_000, 300),
            "2": origin_route(10_000, 900),
            "3": origin_route(4_000, 480),
        },
        pairs=[("1", "2"), ("1", "3")],
    )
    assert [plan.second_store_premise_id for plan in result.plans] == ["2"]
    assert result.evaluated_pair_count == 2
    assert result.unrouteable_pair_count == 1
    # A routable pair exists, so the empty reason must not be reported.
    assert result.empty_reason is None


def test_transit_fare_is_used_per_leg_when_the_provider_supplies_it() -> None:
    """Public transport fares are per leg, so a 3-leg loop sums three fares."""
    rate = TravelCostRate(
        base_fare_per_leg_rm=1.0,
        per_kilometre_rm=0.2,
        description="transit test rate",
    )
    result = plan_multi_store_trips(
        candidates=[STORE_A, STORE_B],
        reachable_first_store_ids=["1"],
        pairs=[("1", "2")],
        origin_routes={
            "1": RouteMatrixResult(0, 2_000, 300, transit_fare_rm=1.5),
            "2": RouteMatrixResult(0, 10_000, 900, transit_fare_rm=2.5),
        },
        inter_store_routes={
            ("1", "2"): RouteMatrixResult(0, 1_000, 120, transit_fare_rm=1.2)
        },
        second_store_limit=TIME_20MIN,
        cost_rate=rate,
        home_name=HOME,
    )
    plan = result.plans[0]
    assert [leg.cost_rm for leg in plan.legs] == [1.5, 1.2, 2.5]
    assert plan.total_travel_cost_rm == 5.2


# ---------------------------------------------------------------- AC 6.2.8


def test_no_matching_plans_reports_the_reason_and_keeps_counters() -> None:
    """A tight 2 km limit with a 5 km leg yields an explainable empty result."""
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(5_000, 600)},
        second_store_limit=TravelLimit(type="distance", value=2.0),
        pairs=[("1", "2")],
        reachable=["1"],
    )
    assert result.plans == []
    assert result.empty_reason == "no_pairs_within_limit"
    assert result.evaluated_pair_count == 1
    assert result.unrouteable_pair_count == 0
    # The client needs the limit echoed back to render "edit limits".
    assert result.second_store_limit is not None
    assert result.second_store_limit.value == 2.0


def test_insufficient_stores_reports_its_own_reason() -> None:
    result = plan_request(
        inter_store_routes={},
        second_store_limit=DISTANCE_5KM,
        candidates=[STORE_A],
        reachable=["1"],
        pairs=[],
    )
    assert result.plans == []
    assert result.empty_reason == "insufficient_reachable_stores"


def test_no_reachable_first_store_reports_its_own_reason() -> None:
    result = plan_request(
        inter_store_routes={("1", "2"): inter_route(1_000, 120)},
        second_store_limit=DISTANCE_5KM,
        reachable=[],
        pairs=[],
    )
    assert result.empty_reason == "insufficient_reachable_stores"


# ------------------------------------------------------- limit normalisation


def test_resolve_limit_handles_all_three_shapes() -> None:
    distance = resolve_limit(DISTANCE_5KM)
    assert distance.distance_km == 5.0 and distance.time_minutes is None

    time_limit = resolve_limit(TIME_20MIN)
    assert time_limit.distance_km is None and time_limit.time_minutes == 20.0

    both = resolve_limit(BOTH_5KM_20MIN)
    assert both.distance_km == 5.0 and both.time_minutes == 20.0


# --------------------------------------------------------------- geometry


def test_haversine_is_symmetric_and_zero_for_identical_points() -> None:
    point = (3.1579, 101.7117)
    assert haversine_km(point, point) == 0.0
    other = (2.9379, 101.6719)
    assert abs(haversine_km(point, other) - haversine_km(other, point)) < 1e-9


def test_haversine_matches_a_known_klang_valley_distance() -> None:
    """KLCC -> Putrajaya is about 25 km by great-circle distance."""
    distance = haversine_km((3.1579, 101.7117), (2.9379, 101.6719))
    assert 23.0 < distance < 27.0


def test_haversine_survives_antipodal_and_pole_inputs() -> None:
    """The acos domain guard must not raise on extreme coordinate pairs."""
    assert haversine_km((90.0, 0.0), (-90.0, 0.0)) > 19_000
    assert haversine_km((0.0, -180.0), (0.0, 180.0)) < 1.0


# ---------------------------------------------------------- pair pre-filter


def test_distance_prefilter_drops_pairs_beyond_the_limit() -> None:
    """Lossless pre-filter: a pair 50 km apart cannot fit a 5 km limit."""
    far = candidate("3", "Kedai Jauh")
    coordinates = {"1": (3.10, 101.60), "2": (3.12, 101.62), "3": (5.00, 103.00)}
    pairs = select_pairs_for_routing(
        first_stores=[STORE_A],
        candidates=[STORE_A, STORE_B, far],
        coordinates=coordinates,
        second_store_limit=DISTANCE_5KM,
    )
    assert ("1", "2") in pairs
    assert ("1", "3") not in pairs


def test_time_only_limit_prefilters_nothing() -> None:
    """No distance ceiling means no sound pre-filter, so every pair is kept."""
    far = candidate("3", "Kedai Jauh")
    coordinates = {"1": (3.10, 101.60), "2": (3.12, 101.62), "3": (5.00, 103.00)}
    pairs = select_pairs_for_routing(
        first_stores=[STORE_A],
        candidates=[STORE_A, STORE_B, far],
        coordinates=coordinates,
        second_store_limit=TIME_20MIN,
    )
    assert ("1", "2") in pairs
    assert ("1", "3") in pairs


def test_pairs_without_coordinates_are_kept_not_dropped() -> None:
    """A missing coordinate must not silently exclude a possibly valid pair."""
    pairs = select_pairs_for_routing(
        first_stores=[STORE_A],
        candidates=[STORE_A, STORE_B],
        coordinates={},
        second_store_limit=DISTANCE_5KM,
    )
    assert pairs == [("1", "2")]


def test_pair_selection_never_pairs_a_store_with_itself() -> None:
    pairs = select_pairs_for_routing(
        first_stores=[STORE_A, STORE_B],
        candidates=[STORE_A, STORE_B],
        coordinates=COORDINATES,
        second_store_limit=DISTANCE_5KM,
    )
    assert ("1", "1") not in pairs
    assert ("2", "2") not in pairs
    assert len(pairs) == 2


def test_pair_count_is_capped_to_bound_shared_api_quota() -> None:
    """Deterministic trim: the highest-ranked first stores are kept."""
    stores = [candidate(str(index), f"Kedai {index}") for index in range(1, 61)]
    coordinates = {
        store.premise_id: (3.10, 101.60)
        for store in stores
    }
    pairs = select_pairs_for_routing(
        first_stores=stores,
        candidates=stores,
        coordinates=coordinates,
        second_store_limit=TIME_20MIN,
    )
    assert len(pairs) <= MAX_INTER_STORE_PAIRS
    first_ids = {first_id for first_id, _ in pairs}
    # Ranked order is preserved, so trimming drops the tail rather than randomly.
    assert "1" in first_ids
    assert len(first_ids) < len(stores)
