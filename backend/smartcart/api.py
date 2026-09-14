"""HTTP endpoints for catalogue, location, and store recommendation features."""

from datetime import datetime, timezone

from fastapi import APIRouter, Path, Query, Response
from starlette.concurrency import run_in_threadpool

from .catalogue import (
    SARA_CATEGORY_SOURCE,
    count_items,
    list_catalogue_categories,
    search_catalogue,
)
from .config import get_settings
from .errors import AppError
from .candidate_cache import PreparedCandidateSet, candidate_preparations
from .alternatives import (
    get_basket_alternatives,
    get_basket_alternatives_with_pack_options,
    premise_exists,
)
from .maps import get_maps_provider
from .models import (
    LocationResolveRequest,
    ReverseLocationRequest,
    ReverseLocationResponse,
    LocationSearchResponse,
    RecommendationRequest,
    RecommendationResponse,
    CandidatePreparationRequest,
    CandidatePreparationResponse,
    ResolvedLocation,
    BasketAlternativesRequest,
    BasketLineRequest,
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

# Keep the historical helper imports as an intentionally small compatibility
# seam for callers/tests that override the old endpoint dependencies. The
# normal production path below uses the cohesive request service instead.
_DEFAULT_PREMISE_EXISTS = premise_exists
_DEFAULT_GET_BASKET_ALTERNATIVES = get_basket_alternatives
_DEFAULT_GET_PACK_OPTIONS = get_pack_options


def _load_basket_alternatives(
    premise_id: str,
    basket: list[BasketLineRequest],
) -> tuple[bool, list, dict]:
    if (
        premise_exists is not _DEFAULT_PREMISE_EXISTS
        or get_basket_alternatives is not _DEFAULT_GET_BASKET_ALTERNATIVES
        or get_pack_options is not _DEFAULT_GET_PACK_OPTIONS
    ):
        # Backward-compatible dependency overrides. This branch is only used
        # when an integration explicitly replaces the legacy helpers; normal
        # requests use one cursor via get_basket_alternatives_with_pack_options.
        if not premise_exists(premise_id):
            return False, [], {}
        lines = get_basket_alternatives(premise_id, basket)
        pack_options = (
            get_pack_options(premise_id, basket)
            if any(line.source.price_source == "store" for line in lines)
            else {}
        )
        return True, lines, pack_options
    return get_basket_alternatives_with_pack_options(premise_id, basket)


def _ranking_method(*, route_provider: str, has_basket: bool) -> str:
    if route_provider == "straight_line":
        if has_basket:
            return (
                "Nearest 25 premises by straight-line distance; stores are ranked by "
                "exact store-price coverage, then effective coverage including cached "
                "median estimates, then estimated combined cost using rough travel estimates. "
                "Google Routes is not configured, so travel limits and route feasibility "
                "are not verified."
            )
        return (
            "Nearest premises by straight-line distance; travel times and costs "
            "are rough planning estimates because Google Routes is not configured."
        )
    if has_basket:
        return (
            "Stores ranked by exact store-price coverage, then effective coverage "
            "including cached median estimates, then lowest combined cost: effective "
            "basket subtotal plus estimated return transport cost; ties by shortest "
            "travel time, route distance, store name, then premise ID."
        )
    return (
        "Lowest estimated return transport cost, then shortest travel time "
        "and route distance."
    )


async def _prepare_candidates(travel) -> PreparedCandidateSet:
    """Build the route-filtered candidate set without retaining the origin."""
    settings = get_settings()
    use_straight_line_fallback = not settings.google_routes_api_key
    maximum_straight_line_km = (
        travel.limit.value
        if travel.limit.type == "distance"
        else travel.limit.distance_km
        if travel.limit.type == "both"
        else None
    )
    if use_straight_line_fallback:
        # Without Routes there is no reliable way to apply distance/time
        # reachability. Keep the documented nearest-25 approximation.
        maximum_straight_line_km = None
    candidates = await run_in_threadpool(
        find_nearest_premises,
        latitude=travel.origin.latitude,
        longitude=travel.origin.longitude,
        sara_filter=travel.sara_filter,
        maximum_straight_line_km=maximum_straight_line_km,
        limit=(
            FALLBACK_NEAREST_LIMIT
            if use_straight_line_fallback
            else settings.route_matrix_candidate_limit
        ),
        maximum_coordinate_age_days=settings.premise_location_max_age_days,
    )
    if use_straight_line_fallback:
        candidates = candidates[:FALLBACK_NEAREST_LIMIT]

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

    if not candidates:
        route_results = []
        route_limit_type = travel.limit.type
        route_limit_value = travel.limit.value
    elif use_straight_line_fallback:
        route_results = straight_line_route_results(candidates, travel.transport_mode)
        # Synthetic straight-line values are estimates only, never route proof.
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
        limit_distance_km=travel.limit.distance_km,
        limit_time_minutes=travel.limit.time_minutes,
    )
    route_warning_parts = []
    if use_straight_line_fallback:
        route_warning_parts.append(
            "Google Routes is not configured. Showing the 25 nearest stores by "
            "straight-line distance with approximate travel times; the selected "
            "travel limit and route feasibility are not verified."
        )
    elif not recommendations:
        route_warning_parts.append(
            "No store was found inside your travel limit. Widen the limit or change "
            "the travel preferences and prepare candidates again."
        )
    if travel.transport_mode in ROUTE_WARNING_MODES:
        route_warning_parts.append(
            "Walking and motorcycle routes are beta estimates and may omit suitable "
            "paths or road restrictions. Check the route before travelling."
        )
    if travel.transport_mode == "public_transport":
        route_warning_parts.append(
            "Public transport estimates include walking to and from transit stops."
        )

    route_provider = "straight_line" if use_straight_line_fallback else "google"
    return PreparedCandidateSet(
        # Recommendations contain only derived store/route data. The selected
        # origin and the original travel request are intentionally discarded.
        recommendations=tuple(recommendations),
        total_candidates_evaluated=len(candidates),
        status=(
            "unverified"
            if use_straight_line_fallback
            else "ready"
            if recommendations
            else "no_reachable_stores"
        ),
        route_provider=route_provider,
        route_warning=" ".join(route_warning_parts) if route_warning_parts else None,
        cost_assumptions={mode: rate.description for mode, rate in cost_model.items()},
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "item_rows": count_items()}


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
    suggestions = await get_maps_provider().autocomplete(query, session_token)
    return LocationSearchResponse(suggestions=suggestions)


@router.post("/locations/resolve", response_model=ResolvedLocation)
async def resolve_location(payload: LocationResolveRequest) -> ResolvedLocation:
    return await get_maps_provider().resolve_place(
        payload.place_id.strip(), payload.session_token.strip()
    )


@router.post("/locations/reverse", response_model=ReverseLocationResponse)
async def reverse_location(
    payload: ReverseLocationRequest,
) -> ReverseLocationResponse:
    # Reverse geocoding is best-effort. The frontend can still use the device
    # coordinates for nearby-store recommendations when the optional provider
    # has no key or is temporarily unavailable.
    try:
        label = await get_maps_provider().reverse_geocode(
            payload.latitude, payload.longitude
        )
    except AppError as error:
        if error.code not in {"MAPS_NOT_CONFIGURED", "MAPS_UNAVAILABLE"}:
            raise
        label = None
    return ReverseLocationResponse(label=label)


@router.post(
    "/premises/{premise_id}/basket-alternatives",
    response_model=BasketAlternativesResponse,
)
async def basket_alternatives(
    payload: BasketAlternativesRequest,
    premise_id: int = Path(ge=1, le=2**63 - 1),
) -> BasketAlternativesResponse:
    premise_found, lines, pack_options = await run_in_threadpool(
        _load_basket_alternatives,
        str(premise_id),
        payload.basket,
    )
    if not premise_found:
        raise AppError(
            "PREMISE_NOT_FOUND",
            "That store is no longer available for price comparison.",
            404,
        )
    response_lines = [
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
            ] if line.source.price_source == "store" else [],
        )
        for line in lines
    ]
    return BasketAlternativesResponse(
        premise_id=str(premise_id),
        lines=response_lines,
        generated_at=datetime.now(timezone.utc),
    )


@router.post(
    "/recommendation-candidates",
    response_model=CandidatePreparationResponse,
)
async def prepare_recommendation_candidates(
    payload: CandidatePreparationRequest,
) -> CandidatePreparationResponse:
    prepared = await _prepare_candidates(payload.travel)
    preparation_id, prepared = candidate_preparations.put(prepared)
    return CandidatePreparationResponse(
        preparation_id=preparation_id,
        candidate_count=len(prepared.recommendations),
        total_candidates_evaluated=prepared.total_candidates_evaluated,
        status=prepared.status,
        route_provider=prepared.route_provider,
        route_warning=prepared.route_warning,
        generated_at=prepared.generated_at,
        expires_at=prepared.expires_at,
    )


@router.delete(
    "/recommendation-candidates/{preparation_id}",
    status_code=204,
    response_class=Response,
)
def delete_recommendation_candidates(
    preparation_id: str = Path(min_length=16, max_length=128),
) -> Response:
    # Do not disclose whether a handle existed or had already expired.
    candidate_preparations.delete(preparation_id)
    return Response(status_code=204)


@router.post("/recommendations", response_model=RecommendationResponse)
async def recommend_stores(payload: RecommendationRequest) -> RecommendationResponse:
    if payload.candidate_preparation_id is not None:
        prepared = candidate_preparations.get(payload.candidate_preparation_id)
        if prepared is None:
            raise AppError(
                "CANDIDATE_PREPARATION_EXPIRED",
                "Travel candidates expired. Prepare your travel preferences again.",
                410,
            )
    else:
        # The travel-bodied request remains available for existing clients.
        # It uses the same reachability rules, but does not need a cache entry.
        prepared = await _prepare_candidates(payload.travel)

    recommendations = [
        store.model_copy(deep=True) for store in prepared.recommendations
    ]
    if payload.basket and recommendations:
        # Always perform a fresh pricing query for each Search activation. The
        # route preparation may be reused, but basket prices never are.
        pricing = await run_in_threadpool(
            get_basket_pricing,
            [store.premise_id for store in recommendations],
            payload.basket,
        )
        recommendations = apply_basket_pricing(recommendations, pricing)

    return RecommendationResponse(
        recommendations=recommendations,
        total_candidates_evaluated=prepared.total_candidates_evaluated,
        total_reachable=len(prepared.recommendations),
        generated_at=datetime.now(timezone.utc),
        ranking_method=_ranking_method(
            route_provider=prepared.route_provider,
            has_basket=bool(payload.basket),
        ),
        cost_assumptions=prepared.cost_assumptions,
        route_provider=prepared.route_provider,
        route_warning=prepared.route_warning,
        expanded_search=False,
    )
