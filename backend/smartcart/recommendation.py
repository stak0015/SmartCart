"""Pure recommendation ranking and transparent travel-cost calculations."""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from .config import Settings
from .catalogue import display_package_size
from .maps import RouteMatrixResult
from .models import (
    BasketItemPrice,
    BasketLineDetail,
    StoreRecommendation,
    TransportMode,
    TravelLimitType,
)
from .premises import PremiseCandidate
from .pricing import StoreBasketSummary


# Used only when Google Routes is not configured. These are deliberately
# labelled as planning estimates in the API response; they are not route or
# traffic data and do not prove that a store is reachable within the user's
# selected travel limit.
FALLBACK_TRAVEL_SPEED_KMH: dict[TransportMode, float] = {
    "walk": 5.0,
    "public_transport": 25.0,
    "motorcycle": 30.0,
    "car": 30.0,
}


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


def straight_line_route_results(
    candidates: list[PremiseCandidate], mode: TransportMode
) -> list[RouteMatrixResult]:
    """Create deterministic route-shaped values for the no-key fallback.

    The normal ranking pipeline can therefore still calculate transport-cost
    estimates and populate the existing response contract. Callers must not
    apply the user's route limit to these synthetic values: straight-line
    distance is only a nearest-store fallback, not a routability check.
    """

    speed_kmh = FALLBACK_TRAVEL_SPEED_KMH[mode]
    results = []
    for destination_index, premise in enumerate(candidates):
        distance_meters = max(0.0, premise.straight_line_distance_km) * 1000
        duration_seconds = distance_meters / speed_kmh * 3600
        results.append(
            RouteMatrixResult(
                destination_index=destination_index,
                distance_meters=distance_meters,
                duration_seconds=duration_seconds,
            )
        )
    return results


def rank_reachable_stores(
    *,
    candidates: list[PremiseCandidate],
    route_results: list[RouteMatrixResult],
    limit_type: TravelLimitType,
    limit_value: float,
    cost_rate: TravelCostRate,
    basket_prices_by_premise: dict[str, list[BasketItemPrice]] | None = None,
) -> list[StoreRecommendation]:
    # This optional argument is retained for E2 callers. The API's richer path
    # first ranks by transport, then applies StoreBasketSummary below.
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
                sara_status=premise.sara_status,
                basket_cost_rm=basket_cost_rm,
                estimated_total_cost_rm=_round(basket_cost_rm + travel_cost_rm, 2),
                priced_item_count=priced_item_count,
                basket_item_count=basket_item_count,
                is_complete_basket=priced_item_count == basket_item_count,
                basket_prices=basket_prices,
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


def apply_basket_pricing(
    recommendations: list[StoreRecommendation],
    pricing: dict[str, StoreBasketSummary],
) -> list[StoreRecommendation]:
    """Attach per-store basket subtotals with their SARA Credit / Cash
    Needed split, combined total and per-line detail, then re-rank
    (AC 2.3.4): complete baskets sort by lowest combined cost (priced
    subtotal + estimated return transport), ties by shortest travel time,
    shortest route distance, store name, then premise ID; incomplete
    baskets are listed after, keeping the reachability order."""
    complete = []
    incomplete = []
    for store in recommendations:
        summary = pricing.get(store.premise_id)
        if summary is None:
            incomplete.append(store)
            continue
        store.basket_subtotal_rm = summary.subtotal_rm
        store.priced_count = summary.priced_count
        store.basket_line_count = summary.basket_line_count
        store.missing_items = summary.missing_items
        store.sara_credit_rm = summary.sara_credit_rm
        store.cash_needed_rm = summary.cash_needed_rm
        store.price_observed_days_ago = summary.price_observed_days_ago
        store.basket_cost_rm = summary.subtotal_rm or 0.0
        store.estimated_total_cost_rm = _round(
            store.basket_cost_rm + store.estimated_round_trip_cost_rm, 2
        )
        store.priced_item_count = summary.priced_count
        store.basket_item_count = summary.basket_line_count
        store.is_complete_basket = summary.is_complete
        store.basket_prices = [
            BasketItemPrice(
                item_id=line.item_id,
                item_name=line.item_name or f"Catalogue item {line.item_id}",
                package_size=display_package_size(line.item_name, line.unit),
                quantity=line.quantity,
                unit_price_rm=line.unit_price_rm,
                line_total_rm=line.line_total_rm,
                price_observed_date=line.observed_date,
            )
            for line in summary.lines
        ]
        store.basket_lines = [
            BasketLineDetail(
                item_id=line.item_id,
                item_name=line.item_name,
                unit=line.unit,
                quantity=line.quantity,
                unit_price_rm=line.unit_price_rm,
                line_total_rm=line.line_total_rm,
                observed_date=line.observed_date,
            )
            for line in summary.lines
        ]
        if summary.is_complete:
            # Money math stays in Decimal so the displayed combined total
            # reconciles to the cent with the subtotal and transport figures.
            store.combined_total_rm = float(
                (
                    Decimal(str(summary.subtotal_rm))
                    + Decimal(str(store.estimated_round_trip_cost_rm))
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            )
            complete.append(store)
        else:
            incomplete.append(store)
    complete.sort(
        key=lambda store: (
            store.combined_total_rm,
            store.estimated_travel_minutes,
            store.route_distance_km,
            store.name,
            int(store.premise_id),
        )
    )
    return complete + incomplete
