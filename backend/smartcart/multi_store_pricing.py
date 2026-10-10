"""Compare store plans using the same store/median pricing as recommendations."""

from decimal import Decimal, ROUND_HALF_UP

from .models import (
    BasketLineRequest,
    MultiStorePlan,
    PricedPlan,
    PlanComparison,
    PlanStoreAssignment,
    StoreRecommendation,
)
from .pricing import BasketLinePrice, StoreBasketSummary

# States plainly, in the response, what the comparison does and does not include.
# Backend strings are English (like ranking_method / route_warning); the client
# localises its own labels.
PRICE_BASIS_NOTE = (
    "Store prices are used where available; missing store prices use labelled "
    "median estimates. Transport covers the complete return journey."
)


def _round2(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _premise_sort_key(value: str) -> tuple[int, object]:
    """Numeric premise IDs sort numerically; other IDs sort after, by text."""
    try:
        return (0, int(value))
    except (TypeError, ValueError):
        return (1, str(value))


def _effective_line_map(summary: StoreBasketSummary) -> dict[str, BasketLinePrice]:
    """Effective basket lines, including median estimates and unpriced items."""
    return {line.item_id: line for line in summary.lines}


def _item_name_lookup(pricing: dict[str, StoreBasketSummary]) -> dict[str, str]:
    """Best available display name per item, from any store's line (any source).

    Used only to label a line that no store priced officially, so the missing
    list is human-readable instead of a bare item ID.
    """
    names: dict[str, str] = {}
    for summary in pricing.values():
        for line in summary.lines:
            if line.item_id not in names and line.item_name:
                names[line.item_id] = line.item_name
    return names


def allocate_basket(
    *,
    basket: list[BasketLineRequest],
    store_ids: list[str],
    prices_by_store: dict[str, dict[str, BasketLinePrice]],
    store_names: dict[str, str],
    item_names: dict[str, str],
) -> tuple[Decimal, list[PlanStoreAssignment], list[str], int]:
    """Assign each full basket line to one store, retaining price provenance."""
    ordered_store_ids = sorted(store_ids, key=_premise_sort_key)
    subtotal = Decimal("0")
    assignments: list[PlanStoreAssignment] = []
    missing: list[str] = []
    priced_count = 0

    for request in basket:
        item_id = str(request.item_id)
        choices = [(sid, prices_by_store.get(sid, {}).get(item_id)) for sid in ordered_store_ids]
        priced_choices = [(sid, line) for sid, line in choices
                          if line is not None and line.unit_price_rm is not None and line.unit_price_rm > 0]
        if priced_choices:
            # Prefer an observed store price; use the median only when neither
            # participating store has a price. Ties preserve premise-ID order.
            best_store_id, best_line = min(priced_choices, key=lambda choice: (
                choice[1].price_source == "median", choice[1].unit_price_rm))
            unit_price = best_line.unit_price_rm
            line_total = Decimal(str(unit_price)) * request.quantity
            subtotal += line_total
            priced_count += 1
        else:
            best_store_id, best_line = next(((sid, line) for sid, line in choices if line is not None), choices[0])
            unit_price = None
            line_total = None
            missing.append(item_names.get(item_id, f"item {item_id}"))
        assignments.append(PlanStoreAssignment(
            item_id=item_id,
            item_name=best_line.item_name if best_line else item_names.get(item_id, item_id),
            item_name_en=best_line.item_name_en if best_line else None,
            item_name_ms=best_line.item_name_ms if best_line else None,
            category=best_line.category if best_line else None,
            source_category=best_line.source_category if best_line else None,
            sara_eligible=best_line.sara_eligible if best_line else None,
            sara_category_candidate=best_line.sara_category_candidate if best_line else False,
            quantity=request.quantity,
            unit_price_rm=unit_price,
            line_total_rm=_round2(line_total) if line_total is not None else None,
            price_source=(best_line.price_source or "store") if unit_price is not None else None,
            store_premise_id=best_store_id,
            store_name=store_names.get(best_store_id, best_store_id),
            unit=best_line.unit if best_line else None,
            observed_date=best_line.observed_date if best_line and best_line.price_source != "median" else None,
        ))

    return subtotal, assignments, missing, priced_count


def _single_store_plan(
    store: StoreRecommendation,
    *,
    basket: list[BasketLineRequest],
    prices_by_store: dict[str, dict[str, BasketLinePrice]],
    store_names: dict[str, str],
    item_names: dict[str, str],
) -> PricedPlan | None:
    """Price one eligible single-store plan on the store/median basis.

    Returns None when the store has no pricing row at all (it cannot be
    compared). Transport is the store's existing round-trip estimate, which is
    already a complete return journey.
    """
    if store.premise_id not in prices_by_store:
        return None
    subtotal, assignments, missing, priced = allocate_basket(
        basket=basket,
        store_ids=[store.premise_id],
        prices_by_store=prices_by_store,
        store_names=store_names,
        item_names=item_names,
    )
    transport = Decimal(str(store.estimated_round_trip_cost_rm))
    # Round trip, so the total travel figures are on the same footing as a
    # two-store loop when they are used as ranking tie-breakers.
    total_minutes = store.estimated_travel_minutes * 2
    total_distance = round(store.route_distance_km * 2, 2)
    return PricedPlan(
        plan_id=f"single:{store.premise_id}",
        store_count=1,
        store_premise_ids=[store.premise_id],
        store_names=[store.name],
        basket_subtotal_rm=_round2(subtotal) if priced else None,
        transport_cost_rm=_round2(transport),
        combined_total_rm=_round2(subtotal + transport) if priced else None,
        is_complete=priced == len(basket) and not missing,
        priced_line_count=priced,
        basket_line_count=len(basket),
        missing_items=missing,
        assignments=assignments,
        total_travel_minutes=total_minutes,
        total_route_distance_km=total_distance,
    )


def _two_store_plan(
    plan: MultiStorePlan,
    *,
    basket: list[BasketLineRequest],
    prices_by_store: dict[str, dict[str, BasketLinePrice]],
    store_names: dict[str, str],
    item_names: dict[str, str],
) -> PricedPlan:
    """Price one two-store plan: allocate the basket, add the loop transport."""
    store_ids = [plan.first_store_premise_id, plan.second_store_premise_id]
    subtotal, assignments, missing, priced = allocate_basket(
        basket=basket,
        store_ids=store_ids,
        prices_by_store=prices_by_store,
        store_names=store_names,
        item_names=item_names,
    )
    transport = Decimal(str(plan.total_travel_cost_rm))
    return PricedPlan(
        plan_id=f"two:{plan.first_store_premise_id}:{plan.second_store_premise_id}",
        store_count=2,
        store_premise_ids=store_ids,
        store_names=[plan.first_store_name, plan.second_store_name],
        basket_subtotal_rm=_round2(subtotal) if priced else None,
        transport_cost_rm=_round2(transport),
        combined_total_rm=_round2(subtotal + transport) if priced else None,
        is_complete=priced == len(basket) and not missing,
        priced_line_count=priced,
        basket_line_count=len(basket),
        missing_items=missing,
        total_travel_minutes=plan.total_travel_minutes,
        total_route_distance_km=plan.total_route_distance_km,
        assignments=assignments,
        inter_store_distance_km=plan.inter_store_distance_km,
        # AC 6.4.1: echo the journey breakdown so the detail view is complete
        # without re-joining the route plan.
        inter_store_travel_minutes=plan.inter_store_travel_minutes,
        legs=plan.legs,
        reverse_order_cost_rm=plan.reverse_order_cost_rm,
    )


def _ranking_key(plan: PricedPlan) -> tuple:
    """AC 6.3.3: combined cost, then fewer stores, shorter time, shorter
    distance, then stable store identifiers."""
    return (
        plan.combined_total_rm if plan.combined_total_rm is not None else float("inf"),
        plan.store_count,
        plan.total_travel_minutes,
        plan.total_route_distance_km,
        tuple(_premise_sort_key(pid) for pid in sorted(plan.store_premise_ids)),
    )


def build_plan_comparison(
    *,
    recommendations: list[StoreRecommendation],
    two_store_plans: list[MultiStorePlan],
    pricing: dict[str, StoreBasketSummary],
    basket: list[BasketLineRequest],
) -> PlanComparison | None:
    """Compare single-store and two-store plans by combined cost (US 6.3).

    Returns None when there is nothing to compare: no basket (no prices to
    allocate) or no two-store plans (nothing "mixed" to rank — the single-store
    list is already shown by Epic 2). The caller gates on this.
    """
    if not basket or not two_store_plans:
        return None

    prices_by_store = {
        premise_id: _effective_line_map(summary)
        for premise_id, summary in pricing.items()
    }
    # Store display names come from the recommendations, not the pricing rows.
    store_names = {store.premise_id: store.name for store in recommendations}
    for route_plan in two_store_plans:
        store_names[route_plan.first_store_premise_id] = route_plan.first_store_name
        store_names[route_plan.second_store_premise_id] = route_plan.second_store_name
    item_names = _item_name_lookup(pricing)

    single_plans: list[PricedPlan] = []
    for store in recommendations:
        # Only stores inside the original travel limit are eligible to be a
        # plan (AC 6.2.1); expanded-search stores are flagged and skipped.
        if store.exceeds_limit:
            continue
        plan = _single_store_plan(
            store,
            basket=basket,
            prices_by_store=prices_by_store,
            store_names=store_names,
            item_names=item_names,
        )
        if plan is not None:
            single_plans.append(plan)

    priced_two_store = [
        _two_store_plan(
            plan,
            basket=basket,
            prices_by_store=prices_by_store,
            store_names=store_names,
            item_names=item_names,
        )
        for plan in two_store_plans
    ]

    # A second stop is only a shopping plan when it has purchases assigned.
    priced_two_store = [plan for plan in priced_two_store
                        if {line.store_premise_id for line in plan.assignments} == set(plan.store_premise_ids)]
    all_plans = single_plans + priced_two_store
    complete = [plan for plan in all_plans if plan.is_complete]
    incomplete = [plan for plan in all_plans if not plan.is_complete]
    complete.sort(key=_ranking_key)
    incomplete.sort(key=_ranking_key)

    # AC 6.3.5: the baseline is the cheapest COMPLETE SINGLE-STORE plan.
    baseline_plan = next(
        (plan for plan in complete if plan.store_count == 1),
        None,
    )
    baseline_rm = baseline_plan.combined_total_rm if baseline_plan else None
    baseline_name = baseline_plan.store_names[0] if baseline_plan else None

    if baseline_rm is not None:
        for plan in complete:
            if plan.store_count == 2:
                # Same basis on both sides, so this subtraction is meaningful.
                # Negative means the split costs more than the best single store.
                plan.saving_vs_single_rm = _round2(
                    Decimal(str(baseline_rm)) - Decimal(str(plan.combined_total_rm))
                )
    # AC 6.3.6: with no baseline, saving_vs_single_rm stays None for every plan.

    return PlanComparison(
        complete_plans=complete,
        incomplete_plans=incomplete,
        single_store_baseline_rm=baseline_rm,
        single_store_baseline_name=baseline_name,
        price_basis_note=PRICE_BASIS_NOTE,
    )
