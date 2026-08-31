"""Google Places and Routes API adapter."""

from dataclasses import dataclass
import asyncio
import json as json_module
import logging
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from .config import get_settings
from .errors import AppError
from .models import LocationSuggestion, ResolvedLocation, TransportMode

logger = logging.getLogger(__name__)

PLACES_BASE_URL = "https://places.googleapis.com/v1"
ROUTES_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
TRAVEL_MODE: dict[TransportMode, str] = {
    "walk": "WALK",
    "public_transport": "TRANSIT",
    "motorcycle": "TWO_WHEELER",
    "car": "DRIVE",
}


@dataclass(frozen=True)
class RouteMatrixResult:
    destination_index: int
    distance_meters: float
    duration_seconds: float


def _parse_duration_seconds(duration: object) -> float | None:
    if not isinstance(duration, str) or not duration.endswith("s"):
        return None
    try:
        value = float(duration[:-1])
    except ValueError:
        return None
    return value if value >= 0 else None


class GoogleMapsProvider:
    def _api_key_for(self, service: str) -> str:
        settings = get_settings()
        api_key = (
            settings.google_places_api_key
            if service == "places"
            else settings.google_routes_api_key
        )
        if not api_key:
            raise AppError(
                "MAPS_NOT_CONFIGURED",
                "Location and route services have not been configured yet.",
                503,
            )
        return api_key

    def _headers(self, field_mask: str, api_key: str) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": field_mask,
        }

    async def _request(
        self,
        method: str,
        url: str,
        field_mask: str,
        service: str,
        *,
        json: dict[str, Any] | None = None,
    ) -> Any:
        def send_request() -> Any:
            body = json_module.dumps(json).encode("utf-8") if json is not None else None
            request = Request(
                url,
                data=body,
                headers=self._headers(field_mask, self._api_key_for(service)),
                method=method,
            )
            try:
                with urlopen(request, timeout=10) as response:  # noqa: S310
                    return json_module.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                diagnostic = error.read(500).decode("utf-8", errors="replace")
                logger.error("Google Maps returned %s: %s", error.code, diagnostic)
            except (URLError, TimeoutError, json_module.JSONDecodeError):
                logger.exception("Google Maps request failed")
            raise AppError(
                "MAPS_UNAVAILABLE",
                "The location service is temporarily unavailable. Please try again.",
                502,
            )

        return await asyncio.to_thread(send_request)

    async def autocomplete(
        self, input_value: str, session_token: str
    ) -> list[LocationSuggestion]:
        body = await self._request(
            "POST",
            f"{PLACES_BASE_URL}/places:autocomplete",
            ",".join(
                [
                    "suggestions.placePrediction.placeId",
                    "suggestions.placePrediction.text.text",
                    "suggestions.placePrediction.structuredFormat.mainText.text",
                    "suggestions.placePrediction.structuredFormat.secondaryText.text",
                ]
            ),
            "places",
            json={
                "input": input_value,
                "sessionToken": session_token,
                "includedRegionCodes": ["my"],
                "regionCode": "my",
                "languageCode": "en",
                "includeQueryPredictions": False,
            },
        )
        suggestions = []
        for entry in body.get("suggestions", []) if isinstance(body, dict) else []:
            prediction = entry.get("placePrediction") or {}
            place_id = prediction.get("placeId")
            full_text = ((prediction.get("text") or {}).get("text") or "").strip()
            structured = prediction.get("structuredFormat") or {}
            main_text = ((structured.get("mainText") or {}).get("text") or "").strip()
            secondary_text = (
                (structured.get("secondaryText") or {}).get("text") or ""
            ).strip()
            if place_id and (full_text or main_text):
                suggestions.append(
                    LocationSuggestion(
                        place_id=place_id,
                        main_text=main_text or full_text,
                        secondary_text=secondary_text,
                        full_text=full_text or main_text,
                    )
                )
        return suggestions

    async def resolve_place(
        self, place_id: str, session_token: str
    ) -> ResolvedLocation:
        query = urlencode({"sessionToken": session_token})
        response = await self._request(
            "GET",
            f"{PLACES_BASE_URL}/places/{quote(place_id, safe='')}?{query}",
            "id,formattedAddress,location",
            "places",
        )
        location = response.get("location") or {} if isinstance(response, dict) else {}
        latitude = location.get("latitude")
        longitude = location.get("longitude")
        if not (
            isinstance(response, dict)
            and response.get("id")
            and response.get("formattedAddress")
            and isinstance(latitude, (int, float))
            and isinstance(longitude, (int, float))
        ):
            raise AppError(
                "LOCATION_NOT_RESOLVED",
                "That location could not be resolved. Please choose another suggestion.",
                422,
            )
        return ResolvedLocation(
            place_id=response["id"],
            label=response["formattedAddress"],
            latitude=latitude,
            longitude=longitude,
        )

    async def compute_route_matrix(
        self,
        origin: dict[str, float],
        destination_place_ids: list[str],
        mode: TransportMode,
    ) -> list[RouteMatrixResult]:
        if not destination_place_ids:
            return []
        if len(destination_place_ids) > 49:
            raise AppError(
                "TOO_MANY_ROUTE_CANDIDATES",
                "Too many route candidates were requested.",
                500,
            )
        response = await self._request(
            "POST",
            ROUTES_MATRIX_URL,
            "originIndex,destinationIndex,status,condition,distanceMeters,duration",
            "routes",
            json={
                "origins": [{"waypoint": {"location": {"latLng": origin}}}],
                "destinations": [
                    {"waypoint": {"placeId": place_id}}
                    for place_id in destination_place_ids
                ],
                "travelMode": TRAVEL_MODE[mode],
                "languageCode": "en",
                "regionCode": "my",
                "units": "METRIC",
            },
        )
        if not isinstance(response, list):
            raise AppError(
                "MAPS_UNAVAILABLE",
                "The location service is temporarily unavailable. Please try again.",
                502,
            )

        routes = []
        for element in response:
            duration_seconds = _parse_duration_seconds(element.get("duration"))
            status = element.get("status") or {}
            destination_index = element.get("destinationIndex")
            distance_meters = element.get("distanceMeters")
            if (
                element.get("condition") == "ROUTE_EXISTS"
                and status.get("code", 0) == 0
                and isinstance(destination_index, int)
                and isinstance(distance_meters, (int, float))
                and duration_seconds is not None
            ):
                routes.append(
                    RouteMatrixResult(
                        destination_index=destination_index,
                        distance_meters=distance_meters,
                        duration_seconds=duration_seconds,
                    )
                )
        return routes


_provider = GoogleMapsProvider()


def get_maps_provider() -> GoogleMapsProvider:
    return _provider
