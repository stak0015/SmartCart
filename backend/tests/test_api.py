from dataclasses import replace
import asyncio

from fastapi.testclient import TestClient

from main import create_app
from smartcart.config import get_settings
from smartcart.maps import RouteMatrixResult
from smartcart.premises import PremiseCandidate


VALID_REQUEST = {
    "basket": [{"itemId": "12", "quantity": 2}],
    "travel": {
        "origin": {
            "label": "Kota Bharu, Kelantan",
            "latitude": 6.1254,
            "longitude": 102.2381,
            "source": "search",
        },
        "transportMode": "motorcycle",
        "limit": {"type": "distance", "value": 5},
        "saraFilter": "candidate",
    },
}


class FakeMapsProvider:
    async def compute_route_matrix(self, origin, destination_place_ids, mode):
        assert origin == {"latitude": 6.1254, "longitude": 102.2381}
        assert destination_place_ids == ["google-place-1"]
        assert mode == "motorcycle"
        return [RouteMatrixResult(0, 2_000, 601)]


def test_recommendation_endpoint_preserves_frontend_contract(monkeypatch) -> None:
    from smartcart import api
    from smartcart.pricing import StoreBasketSummary

    monkeypatch.setattr(
        api,
        "get_settings",
        lambda: replace(get_settings(), google_routes_api_key="test-routes-key"),
    )

    monkeypatch.setattr(
        api,
        "find_nearest_premises",
        lambda **_options: [
            PremiseCandidate(
                premise_id="1",
                premise_code="P1",
                name="Kedai Test",
                address="Jalan Test",
                district="Kota Bharu",
                state="Kelantan",
                google_place_id="google-place-1",
                straight_line_distance_km=1.5,
                sara_status="candidate",
            )
        ],
    )
    monkeypatch.setattr(api, "get_maps_provider", lambda: FakeMapsProvider())
    monkeypatch.setattr(
        api,
        "get_basket_pricing",
        lambda premise_ids, basket: {
            premise_id: StoreBasketSummary(
                subtotal_rm=12.34, priced_count=1, basket_line_count=1,
                sara_credit_rm=5.0, cash_needed_rm=7.34,
            )
            for premise_id in premise_ids
        },
    )

    response = TestClient(create_app()).post("/api/recommendations", json=VALID_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["totalCandidatesEvaluated"] == 1
    assert body["totalReachable"] == 1
    assert body["routeProvider"] == "google"
    assert body["routeWarning"] is not None
    assert "basket subtotal" in body["rankingMethod"]
    assert body["recommendations"][0] == {
        "premiseId": "1",
        "premiseCode": "P1",
        "name": "Kedai Test",
        "address": "Jalan Test",
        "district": "Kota Bharu",
            "state": "Kelantan",
            "googlePlaceId": "google-place-1",
            "straightLineDistanceKm": 1.5,
        "routeDistanceKm": 2.0,
        "estimatedTravelMinutes": 11,
        "estimatedRoundTripCostRm": 0.48,
        "saraStatus": "candidate",
        "basketCostRm": 12.34,
        "estimatedTotalCostRm": 12.82,
        "pricedItemCount": 1,
        "basketItemCount": 1,
        "isCompleteBasket": True,
        "basketPrices": [],
        "basketSubtotalRm": 12.34,
        "missingItems": [],
        "pricedCount": 1,
        "basketLineCount": 1,
        "saraCreditRm": 5.0,
        "cashNeededRm": 7.34,
        "combinedTotalRm": 12.82,
        "basketLines": [],
        "priceObservedDaysAgo": None,
        "exceedsLimit": False,
    }


def test_recommendation_endpoint_without_basket_keeps_transport_ranking(
    monkeypatch,
) -> None:
    from smartcart import api

    monkeypatch.setattr(
        api,
        "get_settings",
        lambda: replace(get_settings(), google_routes_api_key="test-routes-key"),
    )

    monkeypatch.setattr(
        api,
        "find_nearest_premises",
        lambda **_options: [
            PremiseCandidate(
                premise_id="1",
                premise_code="P1",
                name="Kedai Test",
                address="Jalan Test",
                district="Kota Bharu",
                state="Kelantan",
                google_place_id="google-place-1",
                straight_line_distance_km=1.5,
                sara_status="candidate",
            )
        ],
    )
    monkeypatch.setattr(api, "get_maps_provider", lambda: FakeMapsProvider())
    payload = {key: value for key, value in VALID_REQUEST.items() if key != "basket"}
    response = TestClient(create_app()).post("/api/recommendations", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert "transport cost" in body["rankingMethod"]
    store = body["recommendations"][0]
    assert store["basketSubtotalRm"] is None
    assert store["missingItems"] == []
    assert store["saraCreditRm"] is None
    assert store["cashNeededRm"] is None
    assert store["pricedCount"] is None


def test_combined_limit_prefilters_candidates_by_distance(monkeypatch) -> None:
    from smartcart import api

    monkeypatch.setattr(
        api,
        "get_settings",
        lambda: replace(get_settings(), google_routes_api_key="test-routes-key"),
    )
    captured: dict[str, object] = {}

    def fake_find(**options):
        captured.update(options)
        return [
            PremiseCandidate(
                premise_id="1",
                premise_code="P1",
                name="Kedai Test",
                address=None,
                district=None,
                state=None,
                google_place_id="google-place-1",
                straight_line_distance_km=1.5,
                sara_status="candidate",
            )
        ]

    monkeypatch.setattr(api, "find_nearest_premises", fake_find)
    monkeypatch.setattr(api, "get_maps_provider", lambda: FakeMapsProvider())
    payload = {
        **{key: value for key, value in VALID_REQUEST.items() if key != "basket"},
        "travel": {
            **VALID_REQUEST["travel"],
            "limit": {"type": "both", "distanceKm": 5, "timeMinutes": 20},
        },
    }
    response = TestClient(create_app()).post("/api/recommendations", json=payload)

    assert response.status_code == 200
    assert captured["maximum_straight_line_km"] == 5


def test_recommendation_without_routes_key_uses_25_nearest_premises(monkeypatch) -> None:
    from smartcart import api

    settings = replace(get_settings(), google_routes_api_key=None)
    monkeypatch.setattr(api, "get_settings", lambda: settings)
    captured: dict[str, object] = {}

    def fake_find(**options):
        captured.update(options)
        return [
            PremiseCandidate(
                premise_id=str(index),
                premise_code=f"P{index}",
                name=f"Kedai {index}",
                address=None,
                district=None,
                state=None,
                google_place_id=f"google-place-{index}",
                straight_line_distance_km=float(index),
                sara_status="unverified",
            )
            for index in range(1, 31)
        ]

    class NoRouteProvider:
        async def compute_route_matrix(self, *_args, **_kwargs):
            raise AssertionError("Routes API must not be called without a key")

    monkeypatch.setattr(api, "find_nearest_premises", fake_find)
    monkeypatch.setattr(api, "get_maps_provider", lambda: NoRouteProvider())
    payload = {key: value for key, value in VALID_REQUEST.items() if key != "basket"}

    response = TestClient(create_app()).post("/api/recommendations", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["routeProvider"] == "straight_line"
    assert body["totalCandidatesEvaluated"] == 25
    assert body["totalReachable"] == 25
    assert [store["premiseId"] for store in body["recommendations"]] == [
        str(index) for index in range(1, 26)
    ]
    assert body["recommendations"][0]["routeDistanceKm"] == 1.0
    assert "25 nearest stores" in body["routeWarning"]
    assert captured["limit"] == 25
    assert captured["maximum_straight_line_km"] is None


def test_recommendation_expands_search_when_no_store_within_limit(
    monkeypatch,
) -> None:
    """Iteration1 feedback: show the nearest stores when none match the limit."""
    from smartcart import api
    from smartcart.pricing import StoreBasketSummary

    monkeypatch.setattr(
        api,
        "get_settings",
        lambda: replace(get_settings(), google_routes_api_key="test-routes-key"),
    )

    candidate = PremiseCandidate(
        premise_id="1",
        premise_code="P1",
        name="Kedai Jauh",
        address="Jalan Test",
        district="Kota Bharu",
        state="Kelantan",
        google_place_id="google-place-1",
        straight_line_distance_km=1.5,
        sara_status="candidate",
    )
    captured = {"find_calls": [], "route_calls": 0}

    def fake_find(**options):
        captured["find_calls"].append(options)
        return [candidate]

    monkeypatch.setattr(api, "find_nearest_premises", fake_find)

    class ExpandingProvider:
        async def compute_route_matrix(self, origin, destination_place_ids, mode):
            captured["route_calls"] += 1
            # 6 km route is beyond the 5 km distance limit, so the limited
            # pass yields nothing and the expansion pass must recover it.
            return [RouteMatrixResult(0, 6_000, 1_200)]

    monkeypatch.setattr(api, "get_maps_provider", lambda: ExpandingProvider())
    monkeypatch.setattr(
        api,
        "get_basket_pricing",
        lambda premise_ids, basket: {
            premise_id: StoreBasketSummary(
                subtotal_rm=12.34,
                priced_count=1,
                basket_line_count=1,
                sara_credit_rm=5.0,
                cash_needed_rm=7.34,
            )
            for premise_id in premise_ids
        },
    )

    response = TestClient(create_app()).post("/api/recommendations", json=VALID_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["expandedSearch"] is True
    assert body["recommendations"][0]["exceedsLimit"] is True
    assert "No store was found inside your travel limit" in body["routeWarning"]
    # The expansion pass requests candidates without a distance pre-filter.
    assert any(
        call["maximum_straight_line_km"] is None for call in captured["find_calls"]
    )
    assert captured["route_calls"] == 2


def test_recommendation_endpoint_rejects_invalid_basket_line() -> None:
    for bad_line in (
        {"itemId": "db-12", "quantity": 1},
        {"itemId": "12", "quantity": 0},
        {"itemId": "12", "quantity": 100},
    ):
        payload = {**VALID_REQUEST, "basket": [bad_line]}
        response = TestClient(create_app()).post("/api/recommendations", json=payload)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_recommendation_endpoint_keeps_invalid_limit_error_code() -> None:
    payload = {
        **VALID_REQUEST,
        "travel": {
            **VALID_REQUEST["travel"],
            "limit": {"type": "time", "value": 2},
        },
    }
    response = TestClient(create_app()).post("/api/recommendations", json=payload)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TRAVEL_LIMIT"


def test_recommendation_endpoint_rejects_item_ids_outside_database_range() -> None:
    payload = {
        **VALID_REQUEST,
        "basket": [{"itemId": str(2**63), "quantity": 1}],
    }

    response = TestClient(create_app()).post("/api/recommendations", json=payload)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_location_autocomplete_validates_before_calling_google() -> None:
    response = TestClient(create_app()).get(
        "/api/locations/autocomplete",
        params={"query": "ab", "sessionToken": "valid-token"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_LOCATION_QUERY"


def test_location_resolve_returns_existing_contract_for_invalid_body() -> None:
    response = TestClient(create_app()).post(
        "/api/locations/resolve",
        json={"placeId": "", "sessionToken": "short"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_LOCATION"


def test_reverse_location_returns_best_effort_address(monkeypatch) -> None:
    from smartcart import api

    class FakeProvider:
        async def reverse_geocode(self, latitude, longitude):
            assert latitude == 6.1254
            assert longitude == 102.2381
            return "Kota Bharu, Kelantan, Malaysia"

    monkeypatch.setattr(api, "get_maps_provider", lambda: FakeProvider())
    response = TestClient(create_app()).post(
        "/api/locations/reverse",
        json={"latitude": 6.1254, "longitude": 102.2381},
    )
    assert response.status_code == 200
    assert response.json() == {"label": "Kota Bharu, Kelantan, Malaysia"}


def test_reverse_location_validates_coordinates() -> None:
    response = TestClient(create_app()).post(
        "/api/locations/reverse",
        json={"latitude": 91, "longitude": 102.2381},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_LOCATION"


def test_reverse_geocode_ignores_malformed_result(monkeypatch) -> None:
    from smartcart import maps

    settings = replace(
        get_settings(), google_geocoding_api_key="test-geocoding-key"
    )
    monkeypatch.setattr(maps, "get_settings", lambda: settings)

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b'{"status":"OK","results":["malformed"]}'

    monkeypatch.setattr(maps, "urlopen", lambda *_args, **_kwargs: FakeResponse())
    label = asyncio.run(maps.GoogleMapsProvider().reverse_geocode(6.1254, 102.2381))
    assert label is None


def test_item_name_parsing_extracts_brand_and_package_size() -> None:
    from smartcart.catalogue import parse_brand, parse_package_size

    assert parse_brand("BERAS CAP JATI (SST5%)") == "JATI"
    assert parse_brand("SARDIN CAP AYAM (SOS TOMATO)") == "AYAM"
    assert parse_brand("SANTAN KELAPA JENAMA KARA") == "KARA"
    assert parse_package_size("MAGGI 2 MINUTE NOODLE CURRY FLAVOUR (5X79G)") == "5X79G"
    assert parse_package_size("PANADOL ACTIFAST 10S") == "10S"


def test_item_search_passes_page_and_multiple_category_filters(monkeypatch) -> None:
    from smartcart import api

    captured = {}

    def fake_search(query, page, page_size, categories):
        captured.update(
            query=query, page=page, page_size=page_size, categories=categories
        )
        return [], 0

    monkeypatch.setattr(api, "search_catalogue", fake_search)
    response = TestClient(create_app()).get(
        "/api/items/search",
        params=[
            ("q", "milk"),
            ("page", "3"),
            ("category", "DAIRY"),
            ("category", "DRINKS"),
        ],
    )

    assert response.status_code == 200
    assert captured == {
        "query": "milk",
        "page": 3,
        "page_size": 25,
        "categories": ["DAIRY", "DRINKS"],
    }
    assert response.json()["total_pages"] == 0


def test_item_search_allows_empty_query_for_default_catalogue(monkeypatch) -> None:
    from smartcart import api

    captured = {}

    def fake_search(query, page, page_size, categories):
        captured.update(
            query=query, page=page, page_size=page_size, categories=categories
        )
        return [{"item_id": 1}], 51

    monkeypatch.setattr(api, "search_catalogue", fake_search)
    response = TestClient(create_app()).get("/api/items/search")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["total"] == 51
    assert response.json()["page"] == 1
    assert response.json()["page_size"] == 25
    assert response.json()["total_pages"] == 3
    assert response.json()["sara_category_source"] == {
        "url": "https://sara.gov.my/en/home.html",
        "programmeYear": 2026,
        "reviewedAt": "2026-08-28",
    }
    assert captured == {
        "query": "",
        "page": 1,
        "page_size": 25,
        "categories": [],
    }


def test_sara_category_candidates_are_conservative() -> None:
    from smartcart.catalogue import is_sara_category_candidate

    assert is_sara_category_candidate("BERAS") is True
    assert is_sara_category_candidate("TELUR") is True
    assert is_sara_category_candidate("AYAM") is False
    assert is_sara_category_candidate("LAIN-LAIN") is False
    assert is_sara_category_candidate(None) is False


def test_item_name_parsing_returns_none_when_nothing_parseable() -> None:
    from smartcart.catalogue import parse_brand, parse_package_size

    # Various-brands and unbranded names must not invent a brand.
    assert parse_brand("BERAS PULUT THAILAND (SUSU) PELBAGAI JENAMA") is None
    assert parse_brand("AYAM BERSIH - STANDARD") is None
    assert parse_brand(None) is None
    # Grade weight ranges are not package sizes; plain names have none.
    assert parse_package_size("TELUR AYAM GRED A (BERAT 65.0 GM HINGGA 69.9 GM SEBIJI)") is None
    assert parse_package_size("AYAM BERSIH - STANDARD") is None
    assert parse_package_size(None) is None


def test_display_package_size_merges_parsed_size_and_unit() -> None:
    from smartcart.catalogue import display_package_size

    # Name-parsed size wins over the unit column.
    assert display_package_size("MAGGI 2 MINUTE NOODLE CURRY FLAVOUR (5X79G)", "5 X 79g") == "5X79G"
    # Without a parseable size, the unit is the quantity/pricing basis.
    assert display_package_size("AYAM BERSIH - STANDARD", "1kg") == "1kg"
    assert display_package_size("BERAS CAP JATI (SST5%)", "10 kg") == "10 kg"
    # Only when both are absent does the column fall back to nothing.
    assert display_package_size("AYAM BERSIH - STANDARD", None) is None
    assert display_package_size(None, "  ") is None
