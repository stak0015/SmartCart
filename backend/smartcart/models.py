"""Validated request and response contracts shared by FastAPI endpoints."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from pydantic_core import PydanticCustomError

TransportMode = Literal["walk", "public_transport", "motorcycle", "car"]
TravelLimitType = Literal["distance", "time"]
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
    value: float

    @model_validator(mode="after")
    def validate_supported_range(self) -> "TravelLimit":
        valid = (
            self.type == "distance" and 0.5 <= self.value <= 100
        ) or (
            self.type == "time" and 5 <= self.value <= 180
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


class LocationResolveRequest(CamelModel):
    place_id: str = Field(min_length=1, max_length=255)
    session_token: str = Field(min_length=8, max_length=128)


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
    package_size: str | None
    quantity: int
    unit_price_rm: float | None
    line_total_rm: float | None
    price_observed_date: date | None
    sara_eligible: bool | None = None
    sara_category_candidate: bool = False


class BasketLineDetail(CamelModel):
    """One basket line's priced detail at a store (AC 2.3.9); price fields
    are None when the store has no valid price for the line."""

    item_id: str
    item_name: str | None
    unit: str | None
    quantity: int
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: str | None


class AlternativePriceItem(CamelModel):
    """One priced item used by the selected-store alternative comparison."""

    item_id: str
    item_name: str | None
    unit: str | None
    package_size: str | None
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: date | None
    price_observed_days_ago: int | None
    sara_eligible: bool | None
    sara_category_candidate: bool = False
    is_sara_credit_candidate: bool = False


class PackSizeOption(CamelModel):
    """One pack size of the same product family priced at the selected store
    (AC 3.2.1). price_per_unit_rm is display-rounded to sen; ordering and the
    best-value pick use full precision server-side. unit_kind is 'KG' or 'L';
    KG and L families never mix in one comparison."""

    item_id: str
    item_name: str | None
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
    straight_line_distance_km: float
    route_distance_km: float
    estimated_travel_minutes: int
    estimated_round_trip_cost_rm: float
    sara_status: SaraStoreStatus
    # E2 compatibility fields. They mirror the richer pricing fields below so
    # existing clients keep working while the store-detail menu uses the new
    # subtotal, SARA split, freshness and line-detail contract.
    basket_cost_rm: float = 0.0
    estimated_total_cost_rm: float = 0.0
    priced_item_count: int = 0
    basket_item_count: int = 0
    is_complete_basket: bool = True
    basket_prices: list[BasketItemPrice] = Field(default_factory=list)
    # Priced-basket subtotal (AC 2.3.1): sum of the valid positive priced
    # lines; partial when the store misses prices and then never presented
    # as the full basket cost (AC 2.3.3). None when no basket was sent or
    # no basket line is priced; priced_count / basket_line_count give the
    # coverage ("X of N items priced").
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
    # estimated return transport cost; set for complete baskets only.
    combined_total_rm: float | None = None
    # Per-line priced detail behind "View item prices" (AC 2.3.9).
    basket_lines: list[BasketLineDetail] = Field(default_factory=list)
    # Age in days of the store's oldest basket-line price (AC 2.3.5); None
    # when no basket line is priced at that store (or no basket was sent).
    price_observed_days_ago: int | None = None


class RecommendationResponse(CamelModel):
    recommendations: list[StoreRecommendation]
    total_candidates_evaluated: int
    total_reachable: int
    generated_at: datetime
    route_provider: Literal["google", "straight_line"] = "google"
    ranking_method: str
    cost_assumptions: dict[TransportMode, str]
    route_warning: str | None
