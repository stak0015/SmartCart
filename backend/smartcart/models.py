"""Validated request and response contracts shared by FastAPI endpoints."""

from datetime import datetime
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
    # Numeric catalogue item id (frontend sends the "db-" prefix stripped).
    item_id: str = Field(pattern=r"^\d+$")
    quantity: int = Field(ge=1, le=99)


class RecommendationRequest(CamelModel):
    # When present, reachable stores are ranked by total basket price; when
    # omitted or empty, transport-first ranking applies (AC 2.3.1).
    basket: list[BasketLineRequest] | None = None
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
    # None when the store lacks a price for at least one basket line (or no
    # basket was sent); missing_items then names the unpriced lines.
    basket_total_rm: float | None = None
    missing_items: list[str] = Field(default_factory=list)
    # SARA Credit / Cash Needed split of the basket total (AC 2.3.3/2.3.4).
    # Candidate-based estimate (item flag verified first, then official SARA
    # category list); both are None whenever the basket total is unavailable.
    sara_credit_rm: float | None = None
    cash_needed_rm: float | None = None


class RecommendationResponse(CamelModel):
    recommendations: list[StoreRecommendation]
    total_candidates_evaluated: int
    total_reachable: int
    generated_at: datetime
    route_provider: Literal["google"] = "google"
    ranking_method: str
    cost_assumptions: dict[TransportMode, str]
    route_warning: str | None
