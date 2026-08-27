from fastapi.testclient import TestClient

from main import create_app
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

    response = TestClient(create_app()).post("/api/recommendations", json=VALID_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["totalCandidatesEvaluated"] == 1
    assert body["totalReachable"] == 1
    assert body["routeProvider"] == "google"
    assert body["routeWarning"] is not None
    assert body["recommendations"][0] == {
        "premiseId": "1",
        "premiseCode": "P1",
        "name": "Kedai Test",
        "address": "Jalan Test",
        "district": "Kota Bharu",
        "state": "Kelantan",
        "straightLineDistanceKm": 1.5,
        "routeDistanceKm": 2.0,
        "estimatedTravelMinutes": 11,
        "estimatedRoundTripCostRm": 0.48,
        "saraStatus": "candidate",
    }


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


def test_item_name_parsing_extracts_brand_and_package_size() -> None:
    from smartcart.catalogue import parse_brand, parse_package_size

    assert parse_brand("BERAS CAP JATI (SST5%)") == "JATI"
    assert parse_brand("SARDIN CAP AYAM (SOS TOMATO)") == "AYAM"
    assert parse_brand("SANTAN KELAPA JENAMA KARA") == "KARA"
    assert parse_package_size("MAGGI 2 MINUTE NOODLE CURRY FLAVOUR (5X79G)") == "5X79G"
    assert parse_package_size("PANADOL ACTIFAST 10S") == "10S"


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
