"""Pure recommendation ranking and transparent travel-cost calculations."""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from .config import Settings
from .maps import RouteMatrixResult
from .models import (
    BasketItemPrice,
    StoreRecommendation,
    TransportMode,
    TravelLimitType,
)
from .premises import PremiseCandidate


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
    basket_prices_by_premise: dict[str, list[BasketItemPrice]] | None = None,
) -> list[StoreRecommendation]:
    basket_prices_by_premise = basket_prices_by_premise or {}
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
        basket_prices = basket_prices_by_premise.get(premise.premise_id, [])
        basket_cost_rm = _round(
            sum(
                line.line_total_rm
                for line in basket_prices
                if line.line_total_rm is not None
            ),
            2,
        )
        travel_cost_rm = estimate_round_trip_cost_rm(route.distance_meters, cost_rate)
        priced_item_count = sum(
            line.unit_price_rm is not None for line in basket_prices
        )
        basket_item_count = len(basket_prices)
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
                estimated_round_trip_cost_rm=travel_cost_rm,
                basket_cost_rm=basket_cost_rm,
                estimated_total_cost_rm=_round(basket_cost_rm + travel_cost_rm, 2),
                priced_item_count=priced_item_count,
                basket_item_count=basket_item_count,
                is_complete_basket=priced_item_count == basket_item_count,
                basket_prices=basket_prices,
                sara_status=premise.sara_status,
            )
        )

    recommendations.sort(
        key=lambda store: (
            not store.is_complete_basket,
            store.estimated_total_cost_rm,
            store.estimated_travel_minutes,
            store.route_distance_km,
            store.name,
            int(store.premise_id),
        )
    )
    return recommendations
