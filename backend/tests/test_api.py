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
    from smartcart.pricing import StoreBasketSummary

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
        "straightLineDistanceKm": 1.5,
        "routeDistanceKm": 2.0,
        "estimatedTravelMinutes": 11,
        "estimatedRoundTripCostRm": 0.48,
        "saraStatus": "candidate",
        "basketSubtotalRm": 12.34,
        "missingItems": [],
        "pricedCount": 1,
        "basketLineCount": 1,
        "saraCreditRm": 5.0,
        "cashNeededRm": 7.34,
        "combinedTotalRm": 12.82,
        "basketLines": [],
        "priceObservedDaysAgo": None,
    }


def test_recommendation_endpoint_without_basket_keeps_transport_ranking(
    monkeypatch,
) -> None:
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
