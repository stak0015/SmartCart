"""Environment-backed application settings.

Owner: Shun | Contributors: Zhihao
"""

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


def _bounded_text(name: str, fallback: str, maximum: int) -> str:
    value = os.getenv(name, "").strip()
    if (
        not value
        or len(value) > maximum
        or any(ord(character) < 32 for character in value)
    ):
        return fallback
    return value


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings read from environment variables. See
    docs/07-operations/deployment-and-operations.md#configuration for every variable.
    """

    database_url: str | None
    database_ssl: bool
    google_maps_api_key: str | None
    google_places_api_key: str | None
    google_routes_api_key: str | None
    google_geocoding_api_key: str | None
    maps_request_timeout_seconds: float
    cors_origins: tuple[str, ...]
    route_matrix_candidate_limit: int
    public_transport_base_per_leg_rm: float
    public_transport_per_km_rm: float
    motorcycle_per_km_rm: float
    car_per_km_rm: float
    cerebras_api_key: str | None
    cerebras_model: str
    car_litres_per_100km: float = 7.0
    motorcycle_litres_per_100km: float = 2.5
    fuel_price_field: str = "ron95"
    fuel_price_fallback_rm: float = 2.60


@lru_cache
def get_settings() -> Settings:
    """Read settings once per process (cached). Malformed or negative numbers fall back to
    safe defaults and bounded settings (candidate limit, timeout) are clamped, instead of
    failing startup.
    """
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
        cerebras_api_key=(os.getenv("CEREBRAS_API_KEY", "").strip() or None),
        cerebras_model=_bounded_text("CEREBRAS_MODEL", "gpt-oss-120b", 100),
        car_litres_per_100km=_non_negative_number("TRAVEL_CAR_LITRES_PER_100KM", 7.0),
        motorcycle_litres_per_100km=_non_negative_number("TRAVEL_MOTORCYCLE_LITRES_PER_100KM", 2.5),
        fuel_price_field=("ron95_budi95" if os.getenv("TRAVEL_FUEL_PRICE_FIELD") == "ron95_budi95" else "ron95"),
        fuel_price_fallback_rm=_non_negative_number("TRAVEL_FUEL_PRICE_FALLBACK_RM", 2.60),
    )
