"""HTTP endpoints for catalogue, location, and store recommendation features."""

from datetime import datetime, timezone

from fastapi import APIRouter, Path, Query
from starlette.concurrency import run_in_threadpool

from .catalogue import (
    SARA_CATEGORY_SOURCE,
    count_items,
    list_catalogue_categories,
    search_catalogue,
)
from .config import get_settings
from .errors import AppError
from .alternatives import get_basket_alternatives, premise_exists
from .maps import get_maps_provider
from .models import (
    LocationResolveRequest,
    LocationSearchResponse,
    RecommendationRequest,
    RecommendationResponse,
    ResolvedLocation,
    BasketAlternativesRequest,
    BasketAlternativesResponse,
    BasketAlternativeLine,
    AlternativePriceItem,
    PackSizeOption,
)
from .pack_ratios import get_pack_options
from .premises import find_nearest_premises, get_premise_location_coverage
from .pricing import get_basket_pricing
from .recommendation import (
    apply_basket_pricing,
    get_travel_cost_model,
    rank_reachable_stores,
    straight_line_route_results,
)

router = APIRouter(prefix="/api")
ROUTE_WARNING_MODES = {"walk", "motorcycle"}
CATALOGUE_PAGE_SIZE = 25
FALLBACK_NEAREST_LIMIT = 25
DEMO_COORDINATE_MAX_AGE_DAYS = 36500


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "item_rows": count_items(),
        "demo_mode": get_settings().demo_mode,
    }


@router.get("/items/search")
def search_items(
    q: str = "",
    page: int = Query(default=1, ge=1),
    category: list[str] = Query(default=[]),
) -> dict[str, object]:
    items, total = search_catalogue(q, page, CATALOGUE_PAGE_SIZE, category)
    total_pages = (total + CATALOGUE_PAGE_SIZE - 1) // CATALOGUE_PAGE_SIZE
    return {
        "count": len(items),
        "total": total,
        "page": page,
        "page_size": CATALOGUE_PAGE_SIZE,
        "total_pages": total_pages,
        "sara_category_source": SARA_CATEGORY_SOURCE,
        "items": items,
    }


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
    settings = get_settings()
    suggestions = await get_maps_provider().autocomplete(query, session_token)
    return LocationSearchResponse(
        suggestions=suggestions,
        provider="demo" if settings.demo_mode else "google",
    )


@router.post("/locations/resolve", response_model=ResolvedLocation)
async def resolve_location(payload: LocationResolveRequest) -> ResolvedLocation:
    return await get_maps_provider().resolve_place(
        payload.place_id.strip(), payload.session_token.strip()
    )


@router.post(
    "/premises/{premise_id}/basket-alternatives",
    response_model=BasketAlternativesResponse,
)
async def basket_alternatives(
    payload: BasketAlternativesRequest,
    premise_id: int = Path(ge=1, le=2**63 - 1),
) -> BasketAlternativesResponse:
    if not await run_in_threadpool(premise_exists, str(premise_id)):
        raise AppError(
            "PREMISE_NOT_FOUND",
            "That store is no longer available for price comparison.",
            404,
        )
    lines = await run_in_threadpool(
        get_basket_alternatives,
        str(premise_id),
        payload.basket,
    )
    pack_options = await run_in_threadpool(
        get_pack_options,
        str(premise_id),
        payload.basket,
    )
    return BasketAlternativesResponse(
        premise_id=str(premise_id),
        lines=[
            BasketAlternativeLine(
                quantity=line.quantity,
                source=AlternativePriceItem(**line.source.__dict__),
                alternative=(
                    AlternativePriceItem(**line.alternative.__dict__)
                    if line.alternative is not None
                    else None
                ),
                savings_rm=line.savings_rm,
                pack_options=[
                    PackSizeOption(**option.__dict__)
                    for option in pack_options.get(str(line.source.item_id), [])
                ],
            )
            for line in lines
        ],
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/recommendations", response_model=RecommendationResponse)
async def recommend_stores(payload: RecommendationRequest) -> RecommendationResponse:
    settings = get_settings()
    travel = payload.travel
    use_straight_line_fallback = settings.demo_mode or not settings.google_routes_api_key
    coordinate_max_age_days = (
        DEMO_COORDINATE_MAX_AGE_DAYS
        if settings.demo_mode
        else settings.premise_location_max_age_days
    )
    maximum_straight_line_km = (
        travel.limit.value if travel.limit.type == "distance" else None
    )
    if use_straight_line_fallback:
        # Without Routes there is no reliable way to apply a distance/time
        # route limit. Keep the fallback intentionally simple and bounded:
        # return the nearest 25 fresh premises and explain the approximation
        # in the response warning.
        maximum_straight_line_km = None
    candidates = await run_in_threadpool(
        find_nearest_premises,
        latitude=travel.origin.latitude,
        longitude=travel.origin.longitude,
        sara_filter=travel.sara_filter,
        maximum_straight_line_km=maximum_straight_line_km,
        limit=(FALLBACK_NEAREST_LIMIT if use_straight_line_fallback else settings.route_matrix_candidate_limit),
        maximum_coordinate_age_days=coordinate_max_age_days,
    )

    if use_straight_line_fallback:
        # The SQL query is already ordered by proximity, but slicing here
        # keeps the public fallback guarantee even for alternate query
        # implementations and makes the bound explicit.
        candidates = candidates[:FALLBACK_NEAREST_LIMIT]

    if not candidates:
        routable, fresh = await run_in_threadpool(
            get_premise_location_coverage,
            coordinate_max_age_days,
        )
        if routable > 0 and fresh == 0:
            raise AppError(
                "PREMISE_LOCATIONS_NOT_READY",
                "Store locations need to be prepared before recommendations can run.",
                503,
            )

    if use_straight_line_fallback:
        route_results = straight_line_route_results(candidates, travel.transport_mode)
        route_limit_type = "distance"
        route_limit_value = float("inf")
    else:
        route_results = await get_maps_provider().compute_route_matrix(
            {
                "latitude": travel.origin.latitude,
                "longitude": travel.origin.longitude,
            },
            [candidate.google_place_id for candidate in candidates],
            travel.transport_mode,
        )
        route_limit_type = travel.limit.type
        route_limit_value = travel.limit.value
    cost_model = get_travel_cost_model(settings)
    recommendations = rank_reachable_stores(
        candidates=candidates,
        route_results=route_results,
        limit_type=route_limit_type,
        limit_value=route_limit_value,
        cost_rate=cost_model[travel.transport_mode],
    )
    ranking_method = (
        "Demo mode uses seeded premises and deterministic straight-line travel "
        "estimates; basket prices still determine the complete-basket order."
        if settings.demo_mode
        else (
            "Nearest premises by straight-line distance; travel times and costs "
            "are rough planning estimates because Google Routes is not configured."
            if use_straight_line_fallback
            else "Lowest estimated return transport cost, then shortest travel time "
            "and route distance."
        )
    )
    if payload.basket:
        pricing = await run_in_threadpool(
            get_basket_pricing,
            [store.premise_id for store in recommendations],
            payload.basket,
        )
        recommendations = apply_basket_pricing(recommendations, pricing)
        ranking_method = (
            "Demo mode uses seeded premises and deterministic straight-line travel "
            "estimates; complete baskets are ranked by estimated combined cost, "
            "with incomplete baskets listed after."
            if settings.demo_mode
            else (
                "Nearest 25 premises by straight-line distance; complete baskets are "
                "then ranked by estimated combined cost using rough travel estimates. "
                "Google Routes is not configured, so travel limits and route feasibility "
                "are not verified."
                if use_straight_line_fallback
                else "Complete baskets ranked by lowest combined cost: priced basket "
                "subtotal plus estimated return transport cost; ties by shortest "
                "travel time, route distance, store name, then premise ID. "
                "Incomplete baskets are listed after with their partial totals."
            )
        )
    route_warning_parts = []
    if settings.demo_mode:
        route_warning_parts.append(
            "Demo mode is active. Recommendations use seeded mock data and "
            "deterministic straight-line travel estimates; prices are examples only."
        )
    elif use_straight_line_fallback:
        route_warning_parts.append(
            "Google Routes is not configured. Showing the 25 nearest stores by "
            "straight-line distance with approximate travel times; the selected "
            "travel limit and route feasibility are not verified."
        )
    if travel.transport_mode in ROUTE_WARNING_MODES:
        route_warning_parts.append(
            "Walking and motorcycle routes are beta estimates and may omit suitable "
            "paths or road restrictions. Check the route before travelling."
        )
    return RecommendationResponse(
        recommendations=recommendations,
        total_candidates_evaluated=len(candidates),
        total_reachable=len(recommendations),
        generated_at=datetime.now(timezone.utc),
        ranking_method=ranking_method,
        cost_assumptions={mode: rate.description for mode, rate in cost_model.items()},
        route_provider="straight_line" if use_straight_line_fallback else "google",
        route_warning=" ".join(route_warning_parts) if route_warning_parts else None,
    )
