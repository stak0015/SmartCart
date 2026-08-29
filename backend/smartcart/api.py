"""HTTP endpoints for catalogue, location, and store recommendation features."""

from datetime import datetime, timezone

from fastapi import APIRouter, Query
from starlette.concurrency import run_in_threadpool

from .catalogue import count_items, list_catalogue_categories, search_catalogue
from .config import get_settings
from .errors import AppError
from .maps import get_maps_provider
from .models import (
    LocationResolveRequest,
    LocationSearchResponse,
    RecommendationRequest,
    RecommendationResponse,
    ResolvedLocation,
)
from .premises import find_nearest_premises, get_premise_location_coverage
from .pricing import get_basket_pricing
from .recommendation import (
    apply_basket_pricing,
    get_travel_cost_model,
    rank_reachable_stores,
)

router = APIRouter(prefix="/api")
ROUTE_WARNING_MODES = {"walk", "motorcycle"}


@router.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "item_rows": count_items()}


@router.get("/items/search")
def search_items(q: str = "", limit: int = Query(default=20)) -> dict[str, object]:
    safe_limit = max(1, min(limit, 100))
    items = search_catalogue(q, safe_limit)
    return {"count": len(items), "items": items}


@router.get("/items/categories")
def list_categories() -> dict[str, object]:
    categories = list_catalogue_categories()
    return {"count": len(categories), "categories": categories}


@router.get("/locations/autocomplete", response_model=LocationSearchResponse)
async def autocomplete_location(
    query: str = "", sessionToken: str = ""  # noqa: N803 - public API is camelCase
) -> LocationSearchResponse:
    query = query.strip()
    session_token = sessionToken.strip()
    if not 3 <= len(query) <= 160:
        raise AppError(
            "INVALID_LOCATION_QUERY", "Enter at least three characters to search.", 400
        )
    if not 8 <= len(session_token) <= 128:
        raise AppError(
            "INVALID_SESSION_TOKEN", "The location search session is invalid.", 400
        )
    suggestions = await get_maps_provider().autocomplete(query, session_token)
    return LocationSearchResponse(suggestions=suggestions)


@router.post("/locations/resolve", response_model=ResolvedLocation)
async def resolve_location(payload: LocationResolveRequest) -> ResolvedLocation:
    return await get_maps_provider().resolve_place(
        payload.place_id.strip(), payload.session_token.strip()
    )


@router.post("/recommendations", response_model=RecommendationResponse)
async def recommend_stores(payload: RecommendationRequest) -> RecommendationResponse:
    settings = get_settings()
    travel = payload.travel
    maximum_straight_line_km = (
        travel.limit.value if travel.limit.type == "distance" else None
    )
    candidates = await run_in_threadpool(
        find_nearest_premises,
        latitude=travel.origin.latitude,
        longitude=travel.origin.longitude,
        sara_filter=travel.sara_filter,
        maximum_straight_line_km=maximum_straight_line_km,
        limit=settings.route_matrix_candidate_limit,
        maximum_coordinate_age_days=settings.premise_location_max_age_days,
    )

    if not candidates:
        routable, fresh = await run_in_threadpool(
            get_premise_location_coverage,
            settings.premise_location_max_age_days,
        )
        if routable > 0 and fresh == 0:
            raise AppError(
                "PREMISE_LOCATIONS_NOT_READY",
                "Store locations need to be prepared before recommendations can run.",
                503,
            )

    route_results = await get_maps_provider().compute_route_matrix(
        {
            "latitude": travel.origin.latitude,
            "longitude": travel.origin.longitude,
        },
        [candidate.google_place_id for candidate in candidates],
        travel.transport_mode,
    )
    cost_model = get_travel_cost_model(settings)
    recommendations = rank_reachable_stores(
        candidates=candidates,
        route_results=route_results,
        limit_type=travel.limit.type,
        limit_value=travel.limit.value,
        cost_rate=cost_model[travel.transport_mode],
    )
    ranking_method = (
        "Lowest estimated return transport cost, then shortest travel time "
        "and route distance."
    )
    if payload.basket:
        pricing = await run_in_threadpool(
            get_basket_pricing,
            [store.premise_id for store in recommendations],
            payload.basket,
        )
        recommendations = apply_basket_pricing(recommendations, pricing)
        ranking_method = (
            "Lowest total basket price among reachable stores with complete "
            "prices, then lowest estimated return transport cost, travel time "
            "and route distance. Stores missing basket prices are listed after."
        )
    return RecommendationResponse(
        recommendations=recommendations,
        total_candidates_evaluated=len(candidates),
        total_reachable=len(recommendations),
        generated_at=datetime.now(timezone.utc),
        ranking_method=ranking_method,
        cost_assumptions={mode: rate.description for mode, rate in cost_model.items()},
        route_warning=(
            "Walking and motorcycle routes are beta estimates and may omit suitable "
            "paths or road restrictions. Check the route before travelling."
            if travel.transport_mode in ROUTE_WARNING_MODES
            else None
        ),
    )
