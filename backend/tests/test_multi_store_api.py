"""US 6.2 end-to-end wiring tests for the /api/recommendations endpoint.

These complement tests/test_multi_store.py (pure logic). What only an endpoint
test can prove:
* the multi-store block is omitted entirely for pre-Epic-6 clients (AC 6.1.9's
  "unchanged single-store response"),
* response fields are camelCase and match the frontend contract exactly,
* a cached candidate snapshot does not silently drop two-store plans,
* AC 6.2.7 (no route data -> excluded, no invented cost) and AC 6.2.8 (tight
  limit -> explainable empty state) survive the full request path.
"""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from main import create_app
from smartcart.config import get_settings
from smartcart.maps import RouteMatrixResult
from smartcart.premises import PremiseCandidate
from smartcart.pricing import StoreBasketSummary

ORIGIN = {"latitude": 6.1254, "longitude": 102.2381}


def request_body(second_store_limit: dict | None = None) -> dict:
    body = {
        "basket": [{"itemId": "12", "quantity": 2}, {"itemId": "13", "quantity": 1}],
        "travel": {
            "origin": {
                "label": "Kota Bharu, Kelantan",
                "latitude": ORIGIN["latitude"],
                "longitude": ORIGIN["longitude"],
                "source": "search",
            },
            "transportMode": "motorcycle",
            "limit": {"type": "distance", "value": 15},
            "saraFilter": "any",
        },
    }
    if second_store_limit is not None:
        body["secondStoreLimit"] = second_store_limit
    return body


def store(premise_id: str, name: str, place_id: str, km: float) -> PremiseCandidate:
    return PremiseCandidate(
        premise_id=premise_id,
        premise_code=f"P{premise_id}",
        name=name,
        address=f"Jalan {name}",
        district="Kota Bharu",
        state="Kelantan",
        google_place_id=place_id,
        straight_line_distance_km=km,
        sara_status="candidate",
    )


STORE_A = store("1", "Kedai A", "place-a", 1.0)
STORE_B = store("2", "Kedai B", "place-b", 2.0)
COORDINATES = {"1": (6.1254, 102.2381), "2": (6.1350, 102.2480)}


class TwoStoreMapsProvider:
    """Home routes are cheap; the A<->B leg is set per instance.

    ``inter_store`` maps an origin place ID to the list of RouteMatrixResult the
    provider returns for that origin, so a test can omit a pair entirely to
    exercise AC 6.2.7.
    """

    def __init__(self, inter_store: dict[str, list[RouteMatrixResult]] | None = None):
        self._inter_store = inter_store or {}
        self.multi_origin_calls = 0

    async def compute_route_matrix(self, origin, destination_place_ids, mode):
        # One home -> store route per candidate, in candidate order.
        place_to_distance = {"place-a": 2_000, "place-b": 3_000}
        return [
            RouteMatrixResult(
                destination_index=index,
                distance_meters=place_to_distance.get(place_id, 2_000),
                duration_seconds=600,
            )
            for index, place_id in enumerate(destination_place_ids)
        ]

    async def compute_route_matrix_multi_origin(
        self, origin_place_ids, destination_place_ids, mode
    ):
        self.multi_origin_calls += 1
        return [
            route
            for place_id in origin_place_ids
            for route in self._inter_store.get(place_id, [])
        ]


def inter_leg(
    origin_index: int, distance_meters: float, duration_seconds: float
) -> RouteMatrixResult:
    return RouteMatrixResult(
        destination_index=0,
        distance_meters=distance_meters,
        duration_seconds=duration_seconds,
        origin_index=origin_index,
    )


def install(monkeypatch, provider) -> None:
    monkeypatch.setattr(
        "smartcart.api.get_settings",
        lambda: replace(get_settings(), google_routes_api_key="test-routes-key"),
    )
    monkeypatch.setattr(
        "smartcart.api.find_nearest_premises",
        lambda **_options: [STORE_A, STORE_B],
    )
    monkeypatch.setattr(
        "smartcart.api.get_premise_coordinates",
        lambda _premise_ids: dict(COORDINATES),
    )
    monkeypatch.setattr("smartcart.api.get_maps_provider", lambda: provider)
    monkeypatch.setattr(
        "smartcart.api.get_basket_pricing",
        lambda premise_ids, _basket: {
            premise_id: StoreBasketSummary(
                subtotal_rm=10.0, priced_count=2, basket_line_count=2,
                lines=(official_line("12", 3 if premise_id == "1" else 2),
                       official_line("13", 2 if premise_id == "1" else 3)),
            )
            for premise_id in premise_ids
        },
    )


# ------------------------------------------------------- AC 6.1.9 unchanged


def test_no_second_store_limit_returns_no_multi_store_block(monkeypatch) -> None:
    """Pre-Epic-6 clients send no limit and must see an unchanged response."""
    provider = TwoStoreMapsProvider()
    install(monkeypatch, provider)

    response = TestClient(create_app()).post(
        "/api/recommendations", json=request_body()
    )

    assert response.status_code == 200
    body = response.json()
    # Omitted, not an empty object: the response shape is identical to before.
    assert body.get("multiStore") is None
    # No inter-store routing was attempted, so no extra API quota was spent.
    assert provider.multi_origin_calls == 0
    assert len(body["recommendations"]) == 2


# --------------------------------------------------- AC 6.2.5 / 6.2.6 plans


def test_two_store_plan_is_returned_with_camel_case_fields(monkeypatch) -> None:
    """A qualifying pair produces one plan whose loop includes the return leg."""
    provider = TwoStoreMapsProvider(
        inter_store={
            # A -> B leg: 4 km / 8 min, inside a 5 km limit.
            "place-a": [inter_leg(0, 4_000, 480)],
            # B -> A leg, so the reverse order is also routable and comparable.
            "place-b": [inter_leg(1, 4_000, 480)],
        }
    )
    install(monkeypatch, provider)

    response = TestClient(create_app()).post(
        "/api/recommendations",
        json=request_body({"type": "distance", "value": 5}),
    )

    assert response.status_code == 200
    multi = response.json()["multiStore"]
    assert multi is not None
    assert multi["emptyReason"] is None
    assert multi["evaluatedPairCount"] >= 1
    assert len(multi["plans"]) == 1

    plan = multi["plans"][0]
    # Exactly the camelCase keys the frontend contract declares.
    assert set(plan) == {
        "firstStorePremiseId",
        "secondStorePremiseId",
        "firstStoreName",
        "secondStoreName",
        "interStoreDistanceKm",
        "interStoreTravelMinutes",
        "totalRouteDistanceKm",
        "totalTravelMinutes",
        "totalTravelCostRm",
        "legs",
        "reverseOrderCostRm",
        "routeProvider",
    }
    # AC 6.2.6: three legs covering the whole loop, return leg included.
    assert [leg["role"] for leg in plan["legs"]] == [
        "origin_to_first",
        "first_to_second",
        "second_to_origin",
    ]
    assert plan["totalTravelCostRm"] > 0
    # Legs reconcile to the total, so the UI cannot show numbers that disagree.
    assert round(sum(leg["costRm"] for leg in plan["legs"]), 2) == plan[
        "totalTravelCostRm"
    ]
    assert round(sum(leg["travelMinutes"] for leg in plan["legs"])) == plan[
        "totalTravelMinutes"
    ]


def test_plan_exceeding_second_store_distance_limit_is_excluded(monkeypatch) -> None:
    """AC 6.2.3: an 8 km leg fails a 5 km limit, so no plan is returned."""
    provider = TwoStoreMapsProvider(
        inter_store={
            "place-a": [inter_leg(0, 8_000, 600)],
            "place-b": [inter_leg(1, 8_000, 600)],
        }
    )
    install(monkeypatch, provider)

    response = TestClient(create_app()).post(
        "/api/recommendations",
        json=request_body({"type": "distance", "value": 5}),
    )

    assert response.status_code == 200
    multi = response.json()["multiStore"]
    assert multi["plans"] == []
    assert multi["emptyReason"] == "no_pairs_within_limit"
    # Single-store recommendations are untouched (AC 6.2.8).
    assert len(response.json()["recommendations"]) == 2


# ---------------------------------------------------------------- AC 6.2.7


def test_missing_inter_store_route_yields_no_plan_and_no_invented_cost(
    monkeypatch,
) -> None:
    """AC 6.2.7: no route data -> excluded and reported, never estimated."""
    # Provider returns routes for neither direction.
    provider = TwoStoreMapsProvider(inter_store={})
    install(monkeypatch, provider)

    response = TestClient(create_app()).post(
        "/api/recommendations",
        json=request_body({"type": "distance", "value": 5}),
    )

    assert response.status_code == 200
    multi = response.json()["multiStore"]
    assert multi["plans"] == []
    assert multi["unrouteablePairCount"] >= 1
    assert multi["emptyReason"] == "no_inter_store_route_data"


@pytest.mark.parametrize("failure_stage", ["missing_key", "home", "inter_store"])
def test_straight_line_fallback_produces_estimated_plans(monkeypatch, failure_stage):
    from smartcart.errors import AppError

    class RejectedMaps(TwoStoreMapsProvider):
        async def compute_route_matrix(self, *args):
            if failure_stage == "home":
                raise AppError("MAPS_UNAVAILABLE", "Key rejected", 502)
            return await super().compute_route_matrix(*args)

        async def compute_route_matrix_multi_origin(self, *args):
            raise AppError("MAPS_UNAVAILABLE", "Key rejected", 502)

    provider = RejectedMaps()
    install(monkeypatch, provider)
    if failure_stage == "missing_key":
        monkeypatch.setattr("smartcart.api.get_settings",
                            lambda: replace(get_settings(), google_routes_api_key=None))
        def unexpected_maps_call():
            raise AssertionError("Missing-key fallback must not call Google")
        monkeypatch.setattr("smartcart.api.get_maps_provider", unexpected_maps_call)
    response = TestClient(create_app()).post(
        "/api/recommendations", json=request_body({"type": "distance", "value": 5}))
    assert response.status_code == 200
    body = response.json()
    assert body["routeProvider"] == "straight_line"
    multi = body["multiStore"]
    assert len(multi["plans"]) == 1
    plan = multi["plans"][0]
    assert plan["routeProvider"] == "straight_line"
    assert 1 < plan["interStoreDistanceKm"] < 2
    assert plan["totalTravelCostRm"] > 0
    assert len(plan["legs"]) == 3
    assert multi["comparison"] is not None


@pytest.mark.parametrize("home_limit, second_limit", [
    ({"type": "distance", "value": 0.5}, {"type": "distance", "value": 5}),
    ({"type": "distance", "value": 15}, {"type": "distance", "value": 0.5}),
    ({"type": "distance", "value": 15}, {"type": "time", "value": 5}),
    ({"type": "distance", "value": 15}, {"type": "both", "distanceKm": 5, "timeMinutes": 5}),
])
def test_fallback_respects_estimated_limits(monkeypatch, home_limit, second_limit):
    install(monkeypatch, TwoStoreMapsProvider())
    monkeypatch.setattr("smartcart.api.get_settings",
                        lambda: replace(get_settings(), google_routes_api_key=None))
    body = request_body(second_limit)
    body["travel"]["limit"] = home_limit
    body["travel"]["transportMode"] = "walk"
    response = TestClient(create_app()).post("/api/recommendations", json=body)
    assert response.status_code == 200
    assert response.json()["multiStore"]["plans"] == []


def test_fallback_excludes_missing_coordinates(monkeypatch):
    install(monkeypatch, TwoStoreMapsProvider())
    monkeypatch.setattr("smartcart.api.get_settings",
                        lambda: replace(get_settings(), google_routes_api_key=None))
    monkeypatch.setattr("smartcart.api.get_premise_coordinates", lambda _ids: {"2": COORDINATES["2"]})
    response = TestClient(create_app()).post(
        "/api/recommendations", json=request_body({"type": "distance", "value": 5}))
    assert response.status_code == 200
    assert response.json()["multiStore"]["plans"] == []


# ------------------------------------------------------- cache interaction


def test_second_store_limit_bypasses_the_candidate_cache(monkeypatch) -> None:
    """A prepared snapshot has no plans; applying limits must not reuse it.

    Without the bypass the shopper would press Apply and see nothing change
    (AC 6.1.9), because the cached response was built with no second-store
    limit and therefore has multiStore=None.
    """
    provider = TwoStoreMapsProvider(
        inter_store={
            "place-a": [inter_leg(0, 4_000, 480)],
            "place-b": [inter_leg(1, 4_000, 480)],
        }
    )
    install(monkeypatch, provider)
    client = TestClient(create_app())

    # Prepare a snapshot with no basket (as the real prepare endpoint does).
    prepare_travel = request_body()["travel"]
    prepared = client.post(
        "/api/recommendations/prepare", json={"travel": prepare_travel}
    )
    assert prepared.status_code == 200
    cache_id = prepared.json()["candidateCacheId"]

    # Reuse the cache id but add a second-store limit: plans must still appear.
    body = request_body({"type": "distance", "value": 5})
    body["candidateCacheId"] = cache_id
    response = client.post("/api/recommendations", json=body)

    assert response.status_code == 200
    multi = response.json()["multiStore"]
    assert multi is not None
    assert len(multi["plans"]) == 1


def test_request_without_limit_still_uses_the_candidate_cache(monkeypatch) -> None:
    """The bypass must not disable caching for ordinary single-store requests."""
    provider = TwoStoreMapsProvider()
    install(monkeypatch, provider)
    client = TestClient(create_app())

    prepared = client.post(
        "/api/recommendations/prepare", json={"travel": request_body()["travel"]}
    )
    cache_id = prepared.json()["candidateCacheId"]
    baseline_calls = provider.multi_origin_calls

    body = request_body()
    body["candidateCacheId"] = cache_id
    response = client.post("/api/recommendations", json=body)

    assert response.status_code == 200
    assert response.json().get("multiStore") is None
    # No multi-store routing happened on the cached path either.
    assert provider.multi_origin_calls == baseline_calls


# ------------------------------------------------------ US 6.3 comparison E2E


def official_line(item_id: str, unit_price: float) -> "object":
    from smartcart.pricing import BasketLinePrice

    return BasketLinePrice(
        item_id=item_id,
        item_name=f"Item {item_id}",
        unit=None,
        quantity=1,
        unit_price_rm=unit_price,
        line_total_rm=unit_price,
        observed_date="2026-08-01",
        sara_eligible=None,
        sara_category_candidate=False,
        price_source="store",
    )


def install_with_official_prices(monkeypatch, provider, price_by_store) -> None:
    """Like install(), but each store prices item "12" at a given official rate."""
    install(monkeypatch, provider)
    monkeypatch.setattr(
        "smartcart.api.get_basket_pricing",
        lambda premise_ids, _basket: {
            premise_id: StoreBasketSummary(
                subtotal_rm=None,
                priced_count=2,
                basket_line_count=2,
                lines=(official_line("12", price_by_store[premise_id]),
                       official_line("13", 1 if premise_id == "1" else 2)),
            )
            for premise_id in premise_ids
            if premise_id in price_by_store
        },
    )


def test_comparison_flows_through_api_with_camel_case_fields(monkeypatch) -> None:
    """US 6.3: the priced comparison reaches the client with correct field names."""
    provider = TwoStoreMapsProvider(
        inter_store={
            "place-a": [inter_leg(0, 4_000, 480)],
            "place-b": [inter_leg(1, 4_000, 480)],
        }
    )
    # A prices item 12 at 4.00, B at 3.00. Basket is item 12 x2.
    install_with_official_prices(monkeypatch, provider, {"1": 4.00, "2": 3.00})

    response = TestClient(create_app()).post(
        "/api/recommendations",
        json=request_body({"type": "distance", "value": 5}),
    )

    assert response.status_code == 200
    comparison = response.json()["multiStore"]["comparison"]
    assert comparison is not None
    # Exactly the camelCase keys the frontend contract will declare.
    assert set(comparison) == {
        "completePlans",
        "incompletePlans",
        "singleStoreBaselineRm",
        "singleStoreBaselineName",
        "priceBasisNote",
    }
    assert comparison["completePlans"], "a complete plan should exist"
    cheapest = comparison["completePlans"][0]
    assert set(cheapest) == {
        "planId",
        "storeCount",
        "storePremiseIds",
        "storeNames",
        "basketSubtotalRm",
        "transportCostRm",
        "combinedTotalRm",
        "isComplete",
        "pricedLineCount",
        "basketLineCount",
        "missingItems",
        "totalTravelMinutes",
        "totalRouteDistanceKm",
        "assignments",
        "interStoreDistanceKm",
        # AC 6.4.1: the journey breakdown echoed so the detail view is complete.
        "interStoreTravelMinutes",
        "legs",
        "reverseOrderCostRm",
        "savingVsSingleRm",
    }
    # Plans are ordered cheapest-first by combined cost.
    totals = [plan["combinedTotalRm"] for plan in comparison["completePlans"]]
    assert totals == sorted(totals)
    # AC 6.3.2: combined total reconciles with subtotal + transport.
    assert cheapest["combinedTotalRm"] == pytest.approx(
        cheapest["basketSubtotalRm"] + cheapest["transportCostRm"]
    )
    assert "labelled median estimates" in comparison["priceBasisNote"]


def test_saving_baseline_survives_the_full_request_path(monkeypatch) -> None:
    """AC 6.3.5 wiring: the baseline and saving reach the client consistently.

    This asserts the *relationship*, not hand-computed money, because the exact
    combined totals depend on the real transport cost model. The economic rules
    (cheapest complete single store anchors the saving; a split can only win when
    different stores are cheapest for different lines) are covered exhaustively
    by the pure-logic tests in test_multi_store_pricing.py. Here we only prove
    the values survive the request path and stay mutually consistent.
    """
    provider = TwoStoreMapsProvider(
        inter_store={
            "place-a": [inter_leg(0, 4_000, 480)],
            "place-b": [inter_leg(1, 4_000, 480)],
        }
    )
    install_with_official_prices(monkeypatch, provider, {"1": 3.00, "2": 2.50})

    response = TestClient(create_app()).post(
        "/api/recommendations",
        json=request_body({"type": "distance", "value": 5}),
    )

    comparison = response.json()["multiStore"]["comparison"]
    complete = comparison["completePlans"]
    single_totals = [p["combinedTotalRm"] for p in complete if p["storeCount"] == 1]
    two_store = next(p for p in complete if p["storeCount"] == 2)

    # A complete single-store baseline exists and is the cheapest single store.
    assert single_totals, "expected at least one complete single-store plan"
    assert comparison["singleStoreBaselineRm"] == pytest.approx(min(single_totals))
    # AC 6.3.5: saving = baseline - two-store combined, same official basis.
    assert two_store["savingVsSingleRm"] == pytest.approx(
        comparison["singleStoreBaselineRm"] - two_store["combinedTotalRm"]
    )


def test_no_basket_means_no_comparison(monkeypatch) -> None:
    """Without a basket there is nothing to price, so comparison stays None."""
    provider = TwoStoreMapsProvider(
        inter_store={
            "place-a": [inter_leg(0, 4_000, 480)],
            "place-b": [inter_leg(1, 4_000, 480)],
        }
    )
    install_with_official_prices(monkeypatch, provider, {"1": 4.00, "2": 3.00})

    body = request_body({"type": "distance", "value": 5})
    body.pop("basket")  # transport-first request, no items
    response = TestClient(create_app()).post("/api/recommendations", json=body)

    assert response.status_code == 200
    multi = response.json()["multiStore"]
    # Route-level plans still exist (US 6.2), but no priced comparison (US 6.3).
    assert multi["plans"]
    assert multi["comparison"] is None


def test_basket_bought_entirely_at_one_store_has_no_two_stop_plans(monkeypatch):
    provider = TwoStoreMapsProvider(inter_store={
        "place-a": [inter_leg(0, 4_000, 480)], "place-b": [inter_leg(1, 4_000, 480)],
    })
    install_with_official_prices(monkeypatch, provider, {"1": 2, "2": 3})
    body = request_body({"type": "distance", "value": 5})
    body["basket"] = [{"itemId": "12", "quantity": 2}]
    response = TestClient(create_app()).post("/api/recommendations", json=body)
    assert response.status_code == 200
    multi = response.json()["multiStore"]
    assert multi["plans"] == []
    assert all(plan["storeCount"] == 1 for plan in multi["comparison"]["completePlans"])
    assert len(response.json()["recommendations"]) == 2
