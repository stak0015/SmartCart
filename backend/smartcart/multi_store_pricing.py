"""Priced comparison of single-store and two-store plans (US 6.3).

Pure functions: no I/O, no mutation of caller state. ``api.py`` supplies the
already-fetched per-store pricing and the US 6.2 route plans.

One basis rule governs everything here, and it is the reason this module exists
separately from the Epic 2 store cards:

    Every figure in a PlanComparison uses OFFICIAL store prices only
    (price_source == "store"). Cached cross-store medians are excluded.

AC 6.3.1 allocates a basket line only where a "valid positive official price"
exists, and AC 6.3.5 compares a two-store plan against a single-store plan. For
that subtraction to be honest, both sides must use the same basis — so the
single-store plans here are re-priced on official prices too, rather than reusing
the store card's ``combined_total_rm`` (which mixes store and median prices).
The Epic 2 store cards are untouched; this is an additional comparison view.

Consequence, and it is intended: a single-store plan only becomes a savings
baseline (AC 6.3.5) when that store has an official price for *every* requested
line. When no such baseline exists, two-store plans show no saving number at all
rather than an invented or zero one (AC 6.3.6).
"""

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
    "Plans are compared using official store prices only; cached median "
    "estimates are excluded so single-store and two-store totals are directly "
    "comparable. Transport is the estimated complete return route."
)


def _round2(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _premise_sort_key(value: str) -> tuple[int, object]:
    """Numeric premise IDs sort numerically; other IDs sort after, by text."""
    try:
        return (0, int(value))
    except (TypeError, ValueError):
        return (1, str(value))


def _official_line_map(summary: StoreBasketSummary) -> dict[str, BasketLinePrice]:
    """Official-price lines for one store, keyed by item ID.

    A line qualifies only with price_source "store" and a positive unit price.
    Median-priced and unpriced lines are omitted, so a missing key means "no
    official price here" — exactly the AC 6.3.1 allocation condition.
    """
    official: dict[str, BasketLinePrice] = {}
    for line in summary.lines:
        if (
            line.price_source == "store"
            and line.unit_price_rm is not None
            and line.unit_price_rm > 0
        ):
            official[line.item_id] = line
    return official


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
    official_by_store: dict[str, dict[str, BasketLinePrice]],
    store_names: dict[str, str],
    item_names: dict[str, str],
) -> tuple[Decimal, list[PlanStoreAssignment], list[str], int]:
    """AC 6.3.1: assign each line's FULL quantity to one participating store.

    For every requested line, the participating stores that have an official
    price are compared and the cheapest is chosen (ties -> lower premise ID, for
    determinism). A line is never split across stores. A line no participating
    store prices officially is reported as missing.

    Returns (subtotal_decimal, assignments, missing_item_labels, priced_count).
    """
    ordered_store_ids = sorted(store_ids, key=_premise_sort_key)
    subtotal = Decimal("0")
    assignments: list[PlanStoreAssignment] = []
    missing: list[str] = []
    priced_count = 0

    for request in basket:
        item_id = str(request.item_id)
        best_store_id: str | None = None
        best_line: BasketLinePrice | None = None
        for store_id in ordered_store_ids:
            line = official_by_store.get(store_id, {}).get(item_id)
            if line is None:
                continue
            # Cheapest official unit price wins; ``ordered_store_ids`` is already
            # deterministic, and strict ``<`` keeps the first (lowest) ID on ties.
            if best_line is None or line.unit_price_rm < best_line.unit_price_rm:
                best_store_id = store_id
                best_line = line

        if best_line is None or best_store_id is None:
            missing.append(item_names.get(item_id, f"item {item_id}"))
            continue

        line_total = Decimal(str(best_line.unit_price_rm)) * request.quantity
        subtotal += line_total
        priced_count += 1
        assignments.append(
            PlanStoreAssignment(
                item_id=item_id,
                item_name=best_line.item_name,
                quantity=request.quantity,
                unit_price_rm=best_line.unit_price_rm,
                line_total_rm=_round2(line_total),
                store_premise_id=best_store_id,
                store_name=store_names.get(best_store_id, best_store_id),
                unit=best_line.unit,
                observed_date=best_line.observed_date,
            )
        )

    return subtotal, assignments, missing, priced_count


def _single_store_plan(
    store: StoreRecommendation,
    *,
    basket: list[BasketLineRequest],
    official_by_store: dict[str, dict[str, BasketLinePrice]],
    store_names: dict[str, str],
    item_names: dict[str, str],
) -> PricedPlan | None:
    """Price one eligible single-store plan on the official-price basis.

    Returns None when the store has no pricing row at all (it cannot be
    compared). Transport is the store's existing round-trip estimate, which is
    already a complete return journey.
    """
    if store.premise_id not in official_by_store:
        return None
    subtotal, _assignments, missing, priced = allocate_basket(
        basket=basket,
        store_ids=[store.premise_id],
        official_by_store=official_by_store,
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
        basket_subtotal_rm=_round2(subtotal),
        transport_cost_rm=_round2(transport),
        combined_total_rm=_round2(subtotal + transport),
        is_complete=priced == len(basket) and not missing,
        priced_line_count=priced,
        basket_line_count=len(basket),
        missing_items=missing,
        total_travel_minutes=total_minutes,
        total_route_distance_km=total_distance,
    )


def _two_store_plan(
    plan: MultiStorePlan,
    *,
    basket: list[BasketLineRequest],
    official_by_store: dict[str, dict[str, BasketLinePrice]],
    store_names: dict[str, str],
    item_names: dict[str, str],
) -> PricedPlan:
    """Price one two-store plan: allocate the basket, add the loop transport."""
    store_ids = [plan.first_store_premise_id, plan.second_store_premise_id]
    subtotal, assignments, missing, priced = allocate_basket(
        basket=basket,
        store_ids=store_ids,
        official_by_store=official_by_store,
        store_names=store_names,
        item_names=item_names,
    )
    transport = Decimal(str(plan.total_travel_cost_rm))
    return PricedPlan(
        plan_id=f"two:{plan.first_store_premise_id}:{plan.second_store_premise_id}",
        store_count=2,
        store_premise_ids=store_ids,
        store_names=[plan.first_store_name, plan.second_store_name],
        basket_subtotal_rm=_round2(subtotal),
        transport_cost_rm=_round2(transport),
        combined_total_rm=_round2(subtotal + transport),
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
        plan.combined_total_rm,
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

    official_by_store = {
        premise_id: _official_line_map(summary)
        for premise_id, summary in pricing.items()
    }
    # Store display names come from the recommendations, not the pricing rows.
    store_names = {store.premise_id: store.name for store in recommendations}
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
            official_by_store=official_by_store,
            store_names=store_names,
            item_names=item_names,
        )
        if plan is not None:
            single_plans.append(plan)

    priced_two_store = [
        _two_store_plan(
            plan,
            basket=basket,
            official_by_store=official_by_store,
            store_names=store_names,
            item_names=item_names,
        )
        for plan in two_store_plans
    ]

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
