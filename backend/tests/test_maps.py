import asyncio

from smartcart.maps import GoogleMapsProvider


def test_transit_matrix_requests_and_parses_myr_fare(monkeypatch) -> None:
    provider = GoogleMapsProvider()
    captured: dict[str, object] = {}

    async def fake_request(method, url, field_mask, service, *, json):
        captured.update(
            method=method,
            url=url,
            field_mask=field_mask,
            service=service,
            json=json,
        )
        return [
            {
                "destinationIndex": 0,
                "condition": "ROUTE_EXISTS",
                "status": {"code": 0},
                "distanceMeters": 4_000,
                "duration": "900s",
                "travelAdvisory": {
                    "transitFare": {
                        "currencyCode": "MYR",
                        "units": "2",
                        "nanos": 350000000,
                    }
                },
            }
        ]

    monkeypatch.setattr(provider, "_request", fake_request)

    results = asyncio.run(
        provider.compute_route_matrix(
            {"latitude": 3.14, "longitude": 101.69},
            ["place-1"],
            "public_transport",
        )
    )

    assert "travelAdvisory.transitFare" in captured["field_mask"]
    assert results[0].transit_fare_rm == 2.35


def test_non_myr_transit_fare_falls_back_to_estimate(monkeypatch) -> None:
    provider = GoogleMapsProvider()

    async def fake_request(*_args, **_kwargs):
        return [
            {
                "destinationIndex": 0,
                "condition": "ROUTE_EXISTS",
                "status": {"code": 0},
                "distanceMeters": 4_000,
                "duration": "900s",
                "travelAdvisory": {
                    "transitFare": {"currencyCode": "USD", "units": "2"}
                },
            }
        ]

    monkeypatch.setattr(provider, "_request", fake_request)

    results = asyncio.run(
        provider.compute_route_matrix(
            {"latitude": 3.14, "longitude": 101.69},
            ["place-1"],
            "public_transport",
        )
    )

    assert results[0].transit_fare_rm is None
