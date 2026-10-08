"""Two-store journey planning (US 6.2).

Pure functions: no I/O, no API calls, no mutation of caller state. The caller
(``api.py``) fetches routes and passes them in, which keeps every AC 6.2 rule
unit-testable without a Google key.

Two rule sets, deliberately kept apart (AC 6.2.1):

* ``travel.limit`` — the shopper's original limit — governs home -> first store.
  Stores that fail it are never eligible to be visited first.
* ``second_store_limit`` — governs only first store -> second store.

The second store is *not* required to satisfy the home limit; it is reached from
the first store, not from home. Its own home leg is still priced, because the
journey must return home (AC 6.2.6).
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from math import asin, ceil, cos, radians, sin, sqrt

from .maps import RouteMatrixResult
from .models import MultiStorePlan, MultiStorePlans, RouteLeg, TravelLimit
from .premises import PremiseCandidate
from .recommendation import TravelCostRate, estimate_one_way_leg_cost_rm

# Straight-line distance never exceeds real route distance, so a pair whose
# straight-line gap already beats the limit cannot possibly satisfy it. Skipping
# those pairs before any API call is lossless — it cannot drop an eligible plan.
EARTH_RADIUS_KM = 6371.0

# Hard cap on inter-store pairs sent to the provider, to bound shared API quota.
# Deterministic: when exceeded, only the highest-ranked first stores are used.
MAX_INTER_STORE_PAIRS = 600

# Plans returned to the client, cheapest loop first. US 6.4 renders this list.
MAX_RETURNED_PLANS = 10


@dataclass(frozen=True)
class ResolvedLimit:
    """A travel limit split into its optional distance/time ceilings."""

    distance_km: float | None
    time_minutes: float | None


def resolve_limit(limit: TravelLimit) -> ResolvedLimit:
    """Flatten the three limit shapes into comparable ceilings.

    Mirrors the single-store handling in ``api.py`` so both rule sets read the
    same way: ``distance`` and ``time`` carry their bound in ``value``, while
    ``both`` carries two explicit fields.
    """
    if limit.type == "distance":
        return ResolvedLimit(distance_km=limit.value, time_minutes=None)
    if limit.type == "time":
        return ResolvedLimit(distance_km=None, time_minutes=limit.value)
    return ResolvedLimit(
        distance_km=limit.distance_km,
        time_minutes=limit.time_minutes,
    )


def haversine_km(
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    """Great-circle distance between two (latitude, longitude) points.

    Standard haversine form ``2R asin(sqrt(a))``. The ``asin`` variant is used
    rather than the equivalent ``R acos(1 - 2a)`` because it stays accurate for
    very short distances, which is the range that matters here (kilometres
    between neighbouring stores). ``min(1.0, ...)`` guards the ``asin`` domain
    against floating-point rounding.
    """
    lat_a, lon_a = a
    lat_b, lon_b = b
    phi_a, phi_b = radians(lat_a), radians(lat_b)
    delta_phi = phi_b - phi_a
    delta_lambda = radians(lon_b - lon_a)
    inner = sin(delta_phi / 2) ** 2 + cos(phi_a) * cos(phi_b) * sin(
        delta_lambda / 2
    ) ** 2
    return EARTH_RADIUS_KM * 2 * asin(min(1.0, max(0.0, sqrt(inner))))


def pair_passes_second_limit(
    route: RouteMatrixResult,
    limit: ResolvedLimit,
) -> bool:
    """AC 6.2.2 / 6.2.3 / 6.2.4: hard constraints on the inter-store leg.

    ``both`` is an AND, not an OR: the leg must satisfy distance and time
    together. A ceiling of None means that dimension is unconstrained.
    """
    if limit.distance_km is not None and route.distance_meters > limit.distance_km * 1000:
        return False
    if limit.time_minutes is not None and route.duration_seconds > limit.time_minutes * 60:
        return False
    return True


def _leg_minutes(duration_seconds: float) -> int:
    return max(1, ceil(duration_seconds / 60))


def _leg(
    role: str,
    from_name: str,
    to_name: str,
    route: RouteMatrixResult,
    rate: TravelCostRate,
) -> tuple[RouteLeg, float]:
    """Build one displayed leg plus its unrounded cost contribution."""
    cost_rm = estimate_one_way_leg_cost_rm(
        route.distance_meters,
        rate,
        transit_fare_rm=route.transit_fare_rm,
    )
    leg = RouteLeg(
        role=role,
        from_name=from_name,
        to_name=to_name,
        distance_km=round(route.distance_meters / 1000, 2),
        travel_minutes=_leg_minutes(route.duration_seconds),
        cost_rm=cost_rm,
    )
    return leg, cost_rm


def _total(legs: list[RouteLeg], costs: list[float]) -> tuple[float, float, int]:
    """Loop totals in Decimal so displayed legs reconcile to the cent.

    Minutes are the sum of the rounded per-leg minutes, so the numbers shown on
    screen add up exactly rather than differing by a rounding step.
    """
    cost_total = float(
        sum((Decimal(str(value)) for value in costs), Decimal("0")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    )
    distance_total = float(
        sum((Decimal(str(leg.distance_km)) for leg in legs), Decimal("0")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    )
    return cost_total, distance_total, sum(leg.travel_minutes for leg in legs)


def _evaluate_direction(
    *,
    first: PremiseCandidate,
    second: PremiseCandidate,
    origin_routes: dict[str, RouteMatrixResult],
    inter_store_routes: dict[tuple[str, str], RouteMatrixResult],
    second_limit: ResolvedLimit,
    cost_rate: TravelCostRate,
    home_name: str,
) -> tuple[MultiStorePlan, float] | None:
    """Evaluate one visit order, or None if it is ineligible or unrouteable.

    Returns the plan plus its raw total cost so the caller can compare orders
    without re-deriving money values.
    """
    inter_store = inter_store_routes.get((first.premise_id, second.premise_id))
    if inter_store is None:
        # AC 6.2.7: no route data means excluded. Never substitute a made-up
        # distance, duration or fare for this leg.
        return None
    if not pair_passes_second_limit(inter_store, second_limit):
        return None

    origin_first = origin_routes.get(first.premise_id)
    origin_second = origin_routes.get(second.premise_id)
    if origin_first is None or origin_second is None:
        # The return leg (AC 6.2.6) reuses the already-fetched home -> store
        # route for the second store. Without it the loop cannot be priced
        # honestly, so the direction is excluded rather than estimated.
        return None

    legs: list[RouteLeg] = []
    costs: list[float] = []
    for role, from_name, to_name, route in (
        ("origin_to_first", home_name, first.name, origin_first),
        ("first_to_second", first.name, second.name, inter_store),
        ("second_to_origin", second.name, home_name, origin_second),
    ):
        leg, cost = _leg(role, from_name, to_name, route, cost_rate)
        legs.append(leg)
        costs.append(cost)

    cost_total, distance_total, minutes_total = _total(legs, costs)
    plan = MultiStorePlan(
        first_store_premise_id=first.premise_id,
        second_store_premise_id=second.premise_id,
        first_store_name=first.name,
        second_store_name=second.name,
        inter_store_distance_km=round(inter_store.distance_meters / 1000, 2),
        inter_store_travel_minutes=_leg_minutes(inter_store.duration_seconds),
        total_route_distance_km=distance_total,
        total_travel_minutes=minutes_total,
        total_travel_cost_rm=cost_total,
        legs=legs,
        route_provider="google",
    )
    return plan, cost_total


def plan_multi_store_trips(
    *,
    candidates: list[PremiseCandidate],
    reachable_first_store_ids: list[str],
    pairs: list[tuple[str, str]],
    origin_routes: dict[str, RouteMatrixResult],
    inter_store_routes: dict[tuple[str, str], RouteMatrixResult],
    second_store_limit: TravelLimit,
    cost_rate: TravelCostRate,
    home_name: str,
) -> MultiStorePlans:
    """Build every eligible two-store plan, cheapest loop first.

    ``reachable_first_store_ids`` must already be filtered by the *first* store
    limit (AC 6.2.1); this function never re-checks it, so the two rule sets
    cannot be conflated here.

    ``pairs`` is the caller's pre-filtered list of store pairs that were actually
    routed. Both counters are derived from it, so they report what was really
    evaluated rather than every conceivable pair (which would overstate the work
    done and mislabel pre-filtered pairs as unrouteable).
    """
    second_limit = resolve_limit(second_store_limit)
    by_id = {candidate.premise_id: candidate for candidate in candidates}
    reachable_set = set(reachable_first_store_ids)

    if len(candidates) < 2 or not reachable_first_store_ids or not pairs:
        return MultiStorePlans(
            second_store_limit=second_store_limit,
            empty_reason="insufficient_reachable_stores"
            if (len(candidates) < 2 or not reachable_first_store_ids)
            else "no_pairs_within_limit",
        )

    evaluated = 0
    unrouteable = 0
    best_by_pair: dict[frozenset[str], tuple[MultiStorePlan, float, float | None]] = {}

    for first_id, second_id in pairs:
        first = by_id.get(first_id)
        second = by_id.get(second_id)
        if first is None or second is None:
            continue
        evaluated += 1

        has_route_data = (first_id, second_id) in inter_store_routes or (
            second_id,
            first_id,
        ) in inter_store_routes

        forward = _evaluate_direction(
            first=first,
            second=second,
            origin_routes=origin_routes,
            inter_store_routes=inter_store_routes,
            second_limit=second_limit,
            cost_rate=cost_rate,
            home_name=home_name,
        )

        # AC 6.2.5: also try the reverse order, but only when the other store is
        # itself a valid first store under the home limit.
        reverse: tuple[MultiStorePlan, float] | None = None
        if second_id in reachable_set:
            reverse = _evaluate_direction(
                first=second,
                second=first,
                origin_routes=origin_routes,
                inter_store_routes=inter_store_routes,
                second_limit=second_limit,
                cost_rate=cost_rate,
                home_name=home_name,
            )

        if forward is None and reverse is None:
            if not has_route_data:
                # AC 6.2.7: the provider gave no route for this pair in either
                # direction. Counted separately from "outside your limit" so the
                # client can explain the right reason.
                unrouteable += 1
            continue

        eligible = [result for result in (forward, reverse) if result is not None]
        chosen_plan, chosen_cost = min(eligible, key=lambda item: item[1])
        other_cost = next(
            (cost for plan, cost in eligible if plan is not chosen_plan),
            None,
        )
        pair_key = frozenset({first_id, second_id})
        previous = best_by_pair.get(pair_key)
        if previous is None or chosen_cost < previous[1]:
            best_by_pair[pair_key] = (chosen_plan, chosen_cost, other_cost)

    plans = [
        plan.model_copy(update={"reverse_order_cost_rm": other_cost})
        for plan, _cost, other_cost in best_by_pair.values()
    ]
    plans.sort(
        key=lambda plan: (
            plan.total_travel_cost_rm,
            plan.total_travel_minutes,
            plan.total_route_distance_km,
            plan.first_store_name.casefold(),
            plan.second_store_name.casefold(),
            _premise_sort_key(plan.first_store_premise_id),
            _premise_sort_key(plan.second_store_premise_id),
        )
    )

    if not plans:
        empty_reason = (
            "no_inter_store_route_data"
            if evaluated > 0 and unrouteable >= evaluated
            else "no_pairs_within_limit"
        )
        return MultiStorePlans(
            second_store_limit=second_store_limit,
            evaluated_pair_count=evaluated,
            unrouteable_pair_count=unrouteable,
            empty_reason=empty_reason,
        )

    return MultiStorePlans(
        plans=plans[:MAX_RETURNED_PLANS],
        second_store_limit=second_store_limit,
        evaluated_pair_count=evaluated,
        unrouteable_pair_count=unrouteable,
    )


def select_pairs_for_routing(
    *,
    first_stores: list[PremiseCandidate],
    candidates: list[PremiseCandidate],
    coordinates: dict[str, tuple[float, float]],
    second_store_limit: TravelLimit,
) -> list[tuple[str, str]]:
    """Ordered store pairs worth sending to the provider.

    Applies the lossless straight-line pre-filter before any API call. When the
    limit has no distance ceiling (``time`` mode) no pre-filter is sound — real
    roads can be faster than the planning speed used for straight-line guesses —
    so every pair is kept rather than risk dropping an eligible plan.

    If the surviving pairs still exceed ``MAX_INTER_STORE_PAIRS``, the
    lowest-ranked first stores are dropped so quota stays bounded and the result
    stays deterministic.
    """
    limit = resolve_limit(second_store_limit)
    pairs: list[tuple[str, str]] = []
    for first in first_stores:
        first_coord = coordinates.get(first.premise_id)
        for second in candidates:
            if second.premise_id == first.premise_id:
                continue
            if limit.distance_km is not None and first_coord is not None:
                second_coord = coordinates.get(second.premise_id)
                if second_coord is not None:
                    if haversine_km(first_coord, second_coord) > limit.distance_km:
                        continue
            pairs.append((first.premise_id, second.premise_id))

    if len(pairs) <= MAX_INTER_STORE_PAIRS:
        return pairs

    allowed_first: set[str] = set()
    trimmed: list[tuple[str, str]] = []
    for first_id, second_id in pairs:
        if len(trimmed) >= MAX_INTER_STORE_PAIRS:
            break
        allowed_first.add(first_id)
        trimmed.append((first_id, second_id))
    return trimmed


def _premise_sort_key(value: str) -> tuple[int, object]:
    """Sort numeric premise IDs numerically while accepting other IDs."""
    try:
        return (0, int(value))
    except (TypeError, ValueError):
        return (1, str(value))
