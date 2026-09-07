"""Environment-backed application settings."""

from dataclasses import dataclass
from functools import lru_cache
from math import isfinite
import os


def _bounded_integer(name: str, fallback: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, ""))
    except ValueError:
        return fallback
    return min(maximum, max(minimum, value))


def _non_negative_number(name: str, fallback: float) -> float:
    try:
        value = float(os.getenv(name, ""))
    except ValueError:
        return fallback
    return value if isfinite(value) and value >= 0 else fallback


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    database_ssl: bool
    google_maps_api_key: str | None
    google_places_api_key: str | None
    google_routes_api_key: str | None
    google_geocoding_api_key: str | None
    maps_request_timeout_seconds: float
    cors_origins: tuple[str, ...]
    route_matrix_candidate_limit: int
    premise_location_max_age_days: int
    public_transport_base_per_leg_rm: float
    public_transport_per_km_rm: float
    motorcycle_per_km_rm: float
    car_per_km_rm: float


@lru_cache
def get_settings() -> Settings:
    origins = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )
    return Settings(
        database_url=os.getenv("DATABASE_URL") or None,
        database_ssl=os.getenv("DATABASE_SSL", "false").lower() == "true",
        google_maps_api_key=os.getenv("GOOGLE_MAPS_API_KEY") or None,
        google_places_api_key=(
            os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY") or None
        ),
        google_routes_api_key=(
            os.getenv("GOOGLE_ROUTES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY") or None
        ),
        google_geocoding_api_key=(
            os.getenv("GOOGLE_GEOCODING_API_KEY")
            or os.getenv("GOOGLE_MAPS_API_KEY")
            or None
        ),
        maps_request_timeout_seconds=max(
            1.0,
            min(
                30.0,
                _non_negative_number("GOOGLE_MAPS_REQUEST_TIMEOUT_SECONDS", 10.0),
            ),
        ),
        cors_origins=origins,
        route_matrix_candidate_limit=_bounded_integer(
            "ROUTE_MATRIX_CANDIDATE_LIMIT", 25, 5, 49
        ),
        premise_location_max_age_days=_bounded_integer(
            "PREMISE_LOCATION_MAX_AGE_DAYS", 29, 1, 30
        ),
        public_transport_base_per_leg_rm=_non_negative_number(
            "TRAVEL_COST_PUBLIC_TRANSPORT_BASE_PER_LEG_RM", 1.0
        ),
        public_transport_per_km_rm=_non_negative_number(
            "TRAVEL_COST_PUBLIC_TRANSPORT_PER_KM_RM", 0.08
        ),
        motorcycle_per_km_rm=_non_negative_number(
            "TRAVEL_COST_MOTORCYCLE_PER_KM_RM", 0.12
        ),
        car_per_km_rm=_non_negative_number("TRAVEL_COST_CAR_PER_KM_RM", 0.45),
    )
