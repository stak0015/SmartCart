"""Validated request and response contracts shared by FastAPI endpoints."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from pydantic_core import PydanticCustomError

from .categories import CategorySummary, SourceCategorySummary

TransportMode = Literal["walk", "public_transport", "motorcycle", "car"]
TravelLimitType = Literal["distance", "time", "both"]
SaraFilter = Literal["any", "candidate", "verified"]
SaraStoreStatus = Literal["verified", "candidate", "unverified"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
        str_strip_whitespace=True,
    )


class SelectedLocation(CamelModel):
    label: str = Field(min_length=1, max_length=300)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    place_id: str | None = None
    source: Literal["device", "search"]


class TravelLimit(CamelModel):
    type: TravelLimitType
    # ``value`` remains the wire field for the original distance/time modes.
    # Combined limits use the explicit fields so the UI can preserve both
    # controls when the mode changes.
    value: float | None = None
    distance_km: float | None = Field(default=None, ge=0.5, le=100)
    time_minutes: float | None = Field(default=None, ge=5, le=180)

    @model_validator(mode="after")
    def validate_supported_range(self) -> "TravelLimit":
        valid = False
        if self.type == "distance":
            valid = self.value is not None and 0.5 <= self.value <= 100
        elif self.type == "time":
            valid = self.value is not None and 5 <= self.value <= 180
        else:
            valid = (
                self.distance_km is not None
                and self.time_minutes is not None
                and 0.5 <= self.distance_km <= 100
                and 5 <= self.time_minutes <= 180
            )
        if not valid:
            raise PydanticCustomError(
                "invalid_travel_limit",
                "Distance must be 0.5-100 km and time must be 5-180 minutes.",
            )
        return self


class TravelPreferences(CamelModel):
    origin: SelectedLocation
    transport_mode: TransportMode
    limit: TravelLimit
    sara_filter: SaraFilter


class BasketLineRequest(CamelModel):
    # PostgreSQL stores item IDs as BIGINT. Keep values inside that range so
    # malformed requests are rejected before the pricing query can fail with
    # ``bigint out of range``.
    item_id: int = Field(gt=0, le=2**63 - 1)
    quantity: int = Field(ge=1, le=99)


class RecommendationRequest(CamelModel):
    # An omitted or empty basket keeps transport-first ranking. The bounded
    # list preserves the E2 request contract and prevents oversized queries.
    basket: list[BasketLineRequest] = Field(default_factory=list, max_length=100)
    travel: TravelPreferences
    # Opaque, short-lived token returned by candidate preparation. The server
    # validates that it belongs to the same travel settings before reuse.
    candidate_cache_id: str | None = Field(default=None, min_length=16, max_length=128)
    # US 6.1/6.2: limits for the first-store -> second-store leg only. Reuses
    # TravelLimit so the same 0.5-100 km / 5-180 min validation applies. None
    # keeps the response single-store, which is what every pre-Epic-6 client
    # sends, so omitting it cannot change existing behaviour.
    second_store_limit: TravelLimit | None = None


class CandidatePreparationRequest(CamelModel):
    travel: TravelPreferences


class CandidatePreparationResponse(CamelModel):
    candidate_cache_id: str
    candidate_count: int
    reachable_count: int
    generated_at: datetime
    expires_at: datetime


class LocationResolveRequest(CamelModel):
    place_id: str = Field(min_length=1, max_length=255)
    session_token: str = Field(min_length=8, max_length=128)


class ReverseLocationRequest(CamelModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ReverseLocationResponse(CamelModel):
    label: str | None = None


class LocationSuggestion(CamelModel):
    place_id: str
    main_text: str
    secondary_text: str
    full_text: str


class LocationSearchResponse(CamelModel):
    suggestions: list[LocationSuggestion]


class ResolvedLocation(CamelModel):
    place_id: str
    label: str
    latitude: float
    longitude: float


class BasketItemPrice(CamelModel):
    item_id: str
    item_name: str
    item_name_en: str | None = None
    item_name_ms: str | None = None
    package_size: str | None
    quantity: int
    unit_price_rm: float | None
    line_total_rm: float | None
    price_observed_date: date | None
    price_source: Literal["store", "median"] | None = None
    sara_eligible: bool | None = None
    sara_category_candidate: bool = False
    category: CategorySummary | None = None
    source_category: SourceCategorySummary | None = None


class BasketLineDetail(CamelModel):
    """One basket line's priced detail at a store (AC 2.3.9).

    A valid store observation is preferred, then the cached cross-store
    median. Price fields remain None when neither source is available.
    """

    item_id: str
    item_name: str | None
    item_name_en: str | None = None
    item_name_ms: str | None = None
    unit: str | None
    quantity: int
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: str | None
    price_source: Literal["store", "median"] | None = None
    category: CategorySummary | None = None
    source_category: SourceCategorySummary | None = None


class AlternativePriceItem(CamelModel):
    """One priced item used by the selected-store alternative comparison."""

    item_id: str
    item_name: str | None
    item_name_en: str | None = None
    item_name_ms: str | None = None
    unit: str | None
    package_size: str | None
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: date | None
    price_observed_days_ago: int | None
    sara_eligible: bool | None
    sara_category_candidate: bool = False
    is_sara_credit_candidate: bool = False
    price_source: Literal["store", "median"] | None = None
    image_url: str | None = None
    category: CategorySummary | None = None
    source_category: SourceCategorySummary | None = None


class PackSizeOption(CamelModel):
    """One pack size of the same product family priced at the selected store
    (AC 3.2.1). price_per_unit_rm is display-rounded to sen; ordering and the
    best-value pick use full precision server-side. unit_kind is 'KG' or 'L';
    KG and L families never mix in one comparison."""

    item_id: str
    item_name: str | None
    item_name_en: str | None = None
    item_name_ms: str | None = None
    package_size: str | None
    total_price_rm: float | None
    price_per_unit_rm: float | None
    unit_kind: str | None
    observed_date: date | None
    sara_eligible: bool | None = None
    sara_category_candidate: bool = False
    is_sara_credit_candidate: bool = False
    # AC 3.2.2: true for exactly one option per comparison — the cheapest
    # unit price at full precision (ties: newest observed price, then name,
    # then item id).
    is_best_value: bool = False
    # AC 3.2.3: trade-off versus the Best value option, computed server-side
    # in Decimal (total-price difference and unit-price difference). Both are
    # null on the Best value card itself, which the client labels as the
    # baseline of the comparison.
    upfront_diff_rm: float | None = None
    per_unit_diff_rm: float | None = None
    image_url: str | None = None
    category: CategorySummary | None = None
    source_category: SourceCategorySummary | None = None


class BasketAlternativeLine(CamelModel):
    quantity: int
    source: AlternativePriceItem
    alternative: AlternativePriceItem | None = None
    savings_rm: float | None = None
    # AC 3.2.1: every pack size of the same product family priced at the
    # selected store, cheapest unit price first. Empty when the item has no
    # comparable multi-size family (single size, unparseable quantity, or no
    # prices at this store) — the client then shows no comparison block.
    pack_options: list[PackSizeOption] = Field(default_factory=list)


class BasketAlternativesRequest(CamelModel):
    basket: list[BasketLineRequest] = Field(
        min_length=1, max_length=100
    )


class BasketAlternativesResponse(CamelModel):
    premise_id: str
    lines: list[BasketAlternativeLine]
    generated_at: datetime


class StoreRecommendation(CamelModel):
    premise_id: str
    premise_code: str
    name: str
    address: str | None
    district: str | None
    state: str | None
    google_place_id: str | None = None
    straight_line_distance_km: float
    route_distance_km: float
    estimated_travel_minutes: int
    estimated_round_trip_cost_rm: float
    sara_status: SaraStoreStatus
    # E2 compatibility fields. They mirror the richer pricing fields below so
    # existing clients keep working while the store-detail menu uses the new
    # subtotal, SARA split, freshness and line-detail contract.
    basket_cost_rm: float = 0.0
    estimated_total_cost_rm: float | None = 0.0
    priced_item_count: int = 0
    basket_item_count: int = 0
    is_complete_basket: bool = True
    basket_prices: list[BasketItemPrice] = Field(default_factory=list)
    # Effective basket coverage includes actual store prices and cached median
    # estimates. The split remains visible so callers can distinguish exact
    # store coverage from estimated fallback coverage.
    store_price_count: int = 0
    median_price_count: int = 0
    # Effective basket subtotal (AC 2.3.1): valid store prices plus cached
    # median estimates. It remains partial when neither source exists for a
    # line. None means no basket was sent or no line has an effective price.
    basket_subtotal_rm: float | None = None
    missing_items: list[str] = Field(default_factory=list)
    priced_count: int | None = None
    basket_line_count: int | None = None
    # SARA Credit / Cash Needed split of the displayed subtotal
    # (AC 2.3.7/2.3.8). Candidate-based estimate (item flag verified first,
    # then official SARA category list); both are None whenever the subtotal
    # is unavailable.
    sara_credit_rm: float | None = None
    cash_needed_rm: float | None = None
    # Combined ranking total (AC 2.3.4/2.3.5): priced basket subtotal plus
    # estimated return transport cost; null when no basket line has a price.
    combined_total_rm: float | None = None
    # Per-line priced detail behind "View item prices" (AC 2.3.9).
    basket_lines: list[BasketLineDetail] = Field(default_factory=list)
    # Age in days of the store's oldest directly observed basket-line price
    # (AC 2.3.5); cached medians never contribute an observation date.
    price_observed_days_ago: int | None = None
    # True when the store is beyond the shopper's chosen travel limit and was
    # only shown because no store matched inside it (iteration1 feedback: show
    # something rather than nothing).
    exceeds_limit: bool = False


class RouteLeg(CamelModel):
    """One segment of a two-store journey (AC 6.2.6).

    ``role`` names the segment so the client can explain the journey in order.
    ``cost_rm`` is that segment's own transport cost using the same cost model
    as single-store recommendations; the plan total is their sum.
    """

    role: Literal["origin_to_first", "first_to_second", "second_to_origin"]
    from_name: str
    to_name: str
    distance_km: float
    travel_minutes: int
    cost_rm: float


class MultiStorePlan(CamelModel):
    """One eligible two-store journey in visit order (US 6.2).

    The store fields are ordered by the visit sequence chosen under AC 6.2.5,
    so ``first_store_*`` is always visited first. ``inter_store_*`` describes
    only the leg governed by the second-store limits (AC 6.1.4/6.2.1); the
    home legs remain governed by the original travel limit.
    """

    first_store_premise_id: str
    second_store_premise_id: str
    first_store_name: str
    second_store_name: str
    # The first-to-second leg, i.e. what the second-store limits constrain.
    inter_store_distance_km: float
    inter_store_travel_minutes: int
    # Whole loop: home -> first -> second -> home (AC 6.2.6).
    total_route_distance_km: float
    total_travel_minutes: int
    total_travel_cost_rm: float
    legs: list[RouteLeg]
    # AC 6.2.5: cost of the rejected reverse order, kept for transparency so
    # the UI can explain why this order was chosen. None when the reverse
    # order was unrouteable.
    reverse_order_cost_rm: float | None = None
    route_provider: Literal["google", "straight_line"] = "google"


class PlanStoreAssignment(CamelModel):
    """One basket line assigned to a store within a two-store plan (AC 6.3.1).

    A line's full quantity always goes to a single store; it is never split.
    ``unit_price_rm`` is an official store observation (price_source "store"),
    never a median estimate, because AC 6.3.1 allocates on official prices.
    """

    item_id: str
    item_name: str | None
    quantity: int
    unit_price_rm: float
    line_total_rm: float
    store_premise_id: str
    store_name: str
    # AC 6.4.2: the pack spec (e.g. "500 g", "1 L") shown per assigned line.
    # Required (no default) so it cannot be silently omitted; may be None for
    # items the catalogue has no parsed pack size for.
    unit: str | None
    observed_date: str | None = None


class PricedPlan(CamelModel):
    """A single-store or two-store plan priced for comparison (US 6.3).

    Every money figure here uses the SAME basis: official store prices only
    (median estimates are excluded), so single-store and two-store plans are
    directly comparable and the saving in AC 6.3.5 subtracts like from like.
    This is deliberately separate from the single-store card's displayed
    ``combined_total_rm``, which mixes store and median prices.
    """

    plan_id: str
    store_count: Literal[1, 2]
    store_premise_ids: list[str]
    store_names: list[str]
    # AC 6.3.2: basket subtotal is the sum of assigned unit prices x quantities.
    basket_subtotal_rm: float
    # Complete-route transport: round trip for one store, the full loop for two.
    transport_cost_rm: float
    # AC 6.3.2: combined total = basket subtotal + transport.
    combined_total_rm: float
    # AC 6.3.4: complete means every requested basket line has an official price
    # at its assigned store(s); an incomplete plan is never ranked as cheapest.
    is_complete: bool
    priced_line_count: int
    basket_line_count: int
    missing_items: list[str] = Field(default_factory=list)
    total_travel_minutes: int
    total_route_distance_km: float
    # Two-store plans only: which store each line was assigned to (AC 6.3.1).
    assignments: list[PlanStoreAssignment] = Field(default_factory=list)
    # Two-store leg detail, echoed for the comparison view (US 6.4 renders it).
    inter_store_distance_km: float | None = None
    # AC 6.4.1: inter-store travel time, the full ordered legs and the rejected
    # reverse-order cost, echoed from the route plan so the detail view is
    # self-contained. A detail screen that had to re-join the route plan by
    # premise ID could silently lose the journey breakdown; carrying it here
    # makes that impossible. Empty/None for single-store plans.
    inter_store_travel_minutes: int | None = None
    legs: list[RouteLeg] = Field(default_factory=list)
    # AC 6.2.5 transparency: what the rejected reverse visit order would cost.
    reverse_order_cost_rm: float | None = None
    # AC 6.3.5/6.3.6: saving versus the cheapest COMPLETE single-store plan.
    # Two-store plans only; None when there is no eligible single-store baseline
    # (never fabricated as 0). Negative means the split costs more.
    saving_vs_single_rm: float | None = None


class PlanComparison(CamelModel):
    """AC 6.3: single-store and two-store plans compared by combined cost."""

    # AC 6.3.3: complete plans, cheapest combined total first.
    complete_plans: list[PricedPlan] = Field(default_factory=list)
    # AC 6.3.4: plans with at least one unpriced basket line, kept separate so
    # they are never presented as the cheapest complete option.
    incomplete_plans: list[PricedPlan] = Field(default_factory=list)
    # AC 6.3.5: the cheapest complete single-store combined total, used as the
    # savings baseline. None when no complete single-store plan exists, in which
    # case no saving is shown for any two-store plan (AC 6.3.6).
    single_store_baseline_rm: float | None = None
    single_store_baseline_name: str | None = None
    # Transparency: states that the comparison uses official store prices only.
    price_basis_note: str


class MultiStorePlans(CamelModel):
    """Two-store planning result for one recommendation request (US 6.2)."""

    plans: list[MultiStorePlan] = Field(default_factory=list)
    second_store_limit: TravelLimit | None = None
    # Ordered store pairs whose inter-store leg was checked against the limits.
    evaluated_pair_count: int = 0
    # AC 6.2.7: pairs dropped because the provider returned no route for the
    # inter-store leg. These are excluded rather than given an invented cost.
    unrouteable_pair_count: int = 0
    # AC 6.2.8: why the plan list is empty, so the client can show the right
    # empty state and an "edit limits" affordance instead of a blank panel.
    empty_reason: Literal[
        "no_pairs_within_limit",
        "no_inter_store_route_data",
        "insufficient_reachable_stores",
        "straight_line_fallback_unsupported",
    ] | None = None
    # US 6.3: priced comparison of single-store and two-store plans. Present
    # only when a basket was sent and at least one two-store plan exists; the
    # route-level ``plans`` above remain the US 6.2 output.
    comparison: PlanComparison | None = None


class RecommendationResponse(CamelModel):
    recommendations: list[StoreRecommendation]
    total_candidates_evaluated: int
    total_reachable: int
    generated_at: datetime
    route_provider: Literal["google", "straight_line"] = "google"
    ranking_method: str
    cost_assumptions: dict[TransportMode, str]
    route_warning: str | None
    # True when no store matched the shopper's travel limit and the nearest
    # stores were returned anyway (iteration1 feedback: always show something).
    expanded_search: bool = False
    # US 6.2: two-store plans. Stays None unless the client sent a second-store
    # limit, so existing clients see an unchanged response shape.
    multi_store: MultiStorePlans | None = None


# ---------------------------------------------------------------------------
# Epic 7 — Healthier alternatives and nutrition insights (US 7.1-7.3)
# ---------------------------------------------------------------------------

NutritionBasis = Literal["per_100g", "per_100ml"]
NutrientStatus = Literal["comparable", "non_comparable", "unavailable"]


class CataloguePriceRange(CamelModel):
    min_rm: float
    max_rm: float
    store_count: int
    oldest_observed_date: date | None = None
    price_source: Literal["store", "median"] = "store"


class CatalogueItemSummary(CamelModel):
    """The catalogue fields an alternative card and its detail view need.

    Mirrors the /items/search row shape so the client can open an
    alternative with the same controls as any other catalogue item.
    """

    item_id: int
    item_code: str
    item_name: str
    item_name_en: str | None = None
    item_name_ms: str | None = None
    unit: str | None
    item_category: str | None
    package_size: str | None
    image_url: str | None = None
    sara_eligible: bool | None = None
    sara_category_candidate: bool = False
    category: CategorySummary | None = None
    source_category: SourceCategorySummary | None = None
    # Same nearby-store range the search row carries, so opening an
    # alternative shows the same price context as any catalogue item.
    price_range: CataloguePriceRange | None = None


class NutritionSourceRef(CamelModel):
    """Identifies the nutrition dataset and record behind one item."""

    dataset: str
    dataset_name: str
    record_code: str
    description: str
    basis: NutritionBasis


class NutrientComparison(CamelModel):
    """One nutrient on the shared comparison basis (AC 7.3.4/7.3.11).

    A null value with status "unavailable" means the dataset has no value;
    it is never rendered as zero. "non_comparable" marks a pair whose
    measurement bases are not compatible (AC 7.3.9).
    """

    nutrient: str
    label: str
    unit: str
    original_value: float | None
    alternative_value: float | None
    status: NutrientStatus


class AlternativeUse(CamelModel):
    """Reviewed, inferred buying purpose and practical substitution guidance."""

    en: str
    ms: str


class HealthierAlternative(CamelModel):
    """One approved alternative with its supporting nutrition comparison."""

    item: CatalogueItemSummary
    rule: str
    # Short, supported comparison reason shown on the card (AC 7.1.2).
    headline: str
    # Conditional use, not a claim to know the shopper's actual intention.
    intention: AlternativeUse
    usage_note: AlternativeUse
    comparison_nutrient: str
    comparison_direction: Literal["lower_is_better", "higher_is_better"]
    comparison_category: str | None = None
    missing_guard_nutrients: list[str] = Field(default_factory=list)
    original_source: NutritionSourceRef
    alternative_source: NutritionSourceRef
    # True when the entry is a generic food rather than the exact product
    # (AC 7.3.10); the client must disclose it.
    generic_mapping: bool = False
    nutrients: list[NutrientComparison] = Field(default_factory=list)


class HealthierAlternativesResponse(CamelModel):
    item_code: str
    count: int
    alternatives: list[HealthierAlternative] = Field(default_factory=list)
