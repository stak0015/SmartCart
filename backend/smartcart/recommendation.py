"""Pure recommendation ranking and transparent travel-cost calculations."""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from .config import Settings
from .maps import RouteMatrixResult
from .models import StoreRecommendation, TransportMode, TravelLimitType
from .premises import PremiseCandidate
from .pricing import StoreBasketSummary


@dataclass(frozen=True)
class TravelCostRate:
    base_fare_per_leg_rm: float
    per_kilometre_rm: float
    description: str


def get_travel_cost_model(settings: Settings) -> dict[TransportMode, TravelCostRate]:
    public_base = settings.public_transport_base_per_leg_rm
    public_rate = settings.public_transport_per_km_rm
    motorcycle_rate = settings.motorcycle_per_km_rm
    car_rate = settings.car_per_km_rm
    return {
        "walk": TravelCostRate(
            0,
            0,
            "RM0 direct monetary cost; accessibility and effort are not represented.",
        ),
        "public_transport": TravelCostRate(
            public_base,
            public_rate,
            f"Planning estimate: RM{public_base:.2f} base per leg plus "
            f"RM{public_rate:.2f}/km. Actual fares may differ.",
        ),
        "motorcycle": TravelCostRate(
            0,
            motorcycle_rate,
            f"Planning estimate: RM{motorcycle_rate:.2f}/km. Parking, tolls and "
            "ownership costs are excluded.",
        ),
        "car": TravelCostRate(
            0,
            car_rate,
            f"Planning estimate: RM{car_rate:.2f}/km. Parking, tolls and "
            "ownership costs are excluded.",
        ),
    }


def _round(value: float, decimal_places: int) -> float:
    precision = Decimal("1").scaleb(-decimal_places)
    return float(Decimal(str(value)).quantize(precision, rounding=ROUND_HALF_UP))


def estimate_round_trip_cost_rm(
    one_way_distance_meters: float, rate: TravelCostRate
) -> float:
    return_distance_km = max(0, one_way_distance_meters) * 2 / 1000
    value = rate.base_fare_per_leg_rm * 2 + return_distance_km * rate.per_kilometre_rm
    return _round(value, 2)


def rank_reachable_stores(
    *,
    candidates: list[PremiseCandidate],
    route_results: list[RouteMatrixResult],
    limit_type: TravelLimitType,
    limit_value: float,
    cost_rate: TravelCostRate,
) -> list[StoreRecommendation]:
    recommendations = []
    for route in route_results:
        if not 0 <= route.destination_index < len(candidates):
            continue
        within_limit = (
            route.distance_meters <= limit_value * 1000
            if limit_type == "distance"
            else route.duration_seconds <= limit_value * 60
        )
        if not within_limit:
            continue
        premise = candidates[route.destination_index]
        recommendations.append(
            StoreRecommendation(
                premise_id=premise.premise_id,
                premise_code=premise.premise_code,
                name=premise.name,
                address=premise.address,
                district=premise.district,
                state=premise.state,
                straight_line_distance_km=_round(
                    premise.straight_line_distance_km, 2
                ),
                route_distance_km=_round(route.distance_meters / 1000, 2),
                estimated_travel_minutes=max(1, ceil(route.duration_seconds / 60)),
                estimated_round_trip_cost_rm=estimate_round_trip_cost_rm(
                    route.distance_meters, cost_rate
                ),
                sara_status=premise.sara_status,
            )
        )

    recommendations.sort(
        key=lambda store: (
            store.estimated_round_trip_cost_rm,
            store.estimated_travel_minutes,
            store.route_distance_km,
            store.name,
            int(store.premise_id),
        )
    )
    return recommendations


def apply_basket_pricing(
    recommendations: list[StoreRecommendation],
    pricing: dict[str, StoreBasketSummary],
) -> list[StoreRecommendation]:
    """Attach per-store basket totals with their SARA Credit / Cash Needed
    split and re-rank (AC 2.3.1): stores with a complete basket price sort by
    lowest total first; stores missing any basket line price are listed
    after, keeping the reachability order."""
    complete = []
    incomplete = []
    for store in recommendations:
        summary = pricing.get(store.premise_id)
        store.price_observed_days_ago = (
            summary.price_observed_days_ago if summary is not None else None
        )
        if summary is not None and summary.total_rm is not None:
            store.basket_total_rm = summary.total_rm
            store.sara_credit_rm = summary.sara_credit_rm
            store.cash_needed_rm = summary.cash_needed_rm
            complete.append(store)
        else:
            store.basket_total_rm = None
            store.sara_credit_rm = None
            store.cash_needed_rm = None
            store.missing_items = summary.missing_items if summary else []
            incomplete.append(store)
    complete.sort(
        key=lambda store: (
            store.basket_total_rm,
            store.estimated_round_trip_cost_rm,
            store.estimated_travel_minutes,
            store.route_distance_km,
            store.name,
            int(store.premise_id),
        )
    )
    return complete + incomplete
