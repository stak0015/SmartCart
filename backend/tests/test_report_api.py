"""Contract and privacy tests for the synchronous stateless report endpoint."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import inspect
import json
from pathlib import Path
from typing import Mapping

import httpx
import psycopg2
import pytest
from fastapi.testclient import TestClient

from main import create_app
from smartcart import api
from smartcart.period_analytics import period_analytics
from smartcart.reporting import FallbackReportNarrator, ReportRateLimitRejected


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "fixtures"
    / "reports"
    / "G4-report-response.json"
)
REPORT_FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
FIXED_NOW = datetime.fromisoformat("2026-09-26T12:00:00+00:00")


def _instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _request_for(
    cadence: str = "weekly",
    locale: str = "en",
    now: datetime = FIXED_NOW,
) -> dict[str, object]:
    completed = period_analytics([], cadence, now)["previous"]
    return {
        "cadence": cadence,
        "periodStart": completed["periodStart"],
        "periodEnd": completed["periodEnd"],
        "locale": locale,
        "timeZone": "Asia/Kuala_Lumpur",
        "trips": [],
    }


def _client(
    *,
    now: datetime = FIXED_NOW,
    narrator=None,
    rate_limit_hook=None,
) -> TestClient:
    return TestClient(
        create_app(
            report_clock=lambda: now,
            report_narrator=(
                narrator if narrator is not None else FallbackReportNarrator()
            ),
            report_rate_limit_hook=rate_limit_hook,
        )
    )


class RecordingNarrator:
    def __init__(
        self, *, prose: str = "Injected observation", mutate_facts: bool = False
    ) -> None:
        self.calls: list[Mapping[str, object]] = []
        self.prose = prose
        self.mutate_facts = mutate_facts

    async def narrate(self, facts: Mapping[str, object]):
        self.calls.append(deepcopy(facts))
        if self.mutate_facts:
            facts["actualSpendingRm"] = 999999  # type: ignore[index]
            facts["categorySpending"][0]["amountRm"] = 999999  # type: ignore[index]
        return {
            key: {"heading": f"Injected {key}", "observation": self.prose}
            for key in ("overview", "categories", "savings", "essentials")
        } | {
            "newsletter": {
                "subject": "Injected report subject",
                "preview": "Injected report preview.",
                "opening": "Injected newsletter opening.",
                "insights": [],
                "tip": None,
            }
        }


def test_weekly_fixture_returns_the_complete_deterministic_four_section_report() -> None:
    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        response = client.post("/api/reports/generate", json=REPORT_FIXTURE["request"])

    assert response.status_code == 200
    assert response.json() == REPORT_FIXTURE["expected"]
    assert response.json()["newsletter"]["subject"] == "Your weekly shopping report"
    assert len(response.json()["newsletter"]["insights"]) <= 3
    newsletter = response.json()["newsletter"]
    newsletter_words = (
        newsletter["opening"]
        + " "
        + " ".join(
            insight["heading"] + " " + insight["body"]
            for insight in newsletter["insights"]
        )
        + " "
        + (newsletter["tip"] or "")
    ).split()
    assert 150 <= len(newsletter_words) <= 250
    assert [section["id"] for section in response.json()["sections"]] == [
        "overview",
        "categories",
        "savings",
        "essentials",
    ]
    assert [section["visualization"] for section in response.json()["sections"]] == [
        "overview-kpis",
        "category-pie",
        "savings-breakdown",
        "spending-class-bar",
    ]


def test_openapi_publishes_only_the_camel_case_allowlisted_request_fields() -> None:
    operation = create_app().openapi()["paths"]["/api/reports/generate"]["post"]
    schema = operation["requestBody"]["content"]["application/json"]["schema"]
    assert set(schema["properties"]) == {
        "cadence",
        "periodStart",
        "periodEnd",
        "locale",
        "timeZone",
        "trips",
    }
    assert schema["additionalProperties"] is False
    trip_schema = schema["$defs"]["ReportTripInput"]
    assert set(trip_schema["properties"]) == {
        "recordedAt",
        "boughtLines",
        "estimatedSavings",
    }
    assert trip_schema["additionalProperties"] is False
    line_schema = schema["$defs"]["ReportBoughtLineInput"]
    assert set(line_schema["properties"]) == {
        "name", "categoryId", "sourceCategory", "quantity", "lineTotalRm"
    }
    category_schema = schema["$defs"]["ReportSourceCategoryInput"]
    assert set(category_schema["properties"]) == {"id", "labelEn", "labelMs"}


@pytest.mark.parametrize(
    ("cadence", "locale"),
    [("weekly", "en"), ("weekly", "ms"), ("monthly", "en"), ("monthly", "ms")],
)
def test_empty_valid_reports_support_both_cadences_and_locales(cadence, locale) -> None:
    with _client() as client:
        response = client.post(
            "/api/reports/generate", json=_request_for(cadence, locale)
        )

    assert response.status_code == 200
    body = response.json()
    assert body["cadence"] == cadence
    assert body["tripCount"] == 0
    assert body["actualSpendingRm"] is None
    assert body["spendingIncomplete"] is False
    assert body["estimatedNetSavingsRm"] is None
    assert body["storeChoiceImpactRm"] is None
    assert body["itemChangeImpactRm"] is None
    assert body["comparison"] is None
    assert body["spendingClassBreakdown"] == [
        {"spendingClass": "essential", "amountRm": None},
        {"spendingClass": "discretionary", "amountRm": None},
        {"spendingClass": "mixed_or_unknown", "amountRm": None},
    ]
    assert body["generationSource"] == "fallback"
    assert body["newsletter"]["subject"] == (
        f"Your {cadence} shopping report"
        if locale == "en"
        else f"Laporan membeli-belah {'mingguan' if cadence == 'weekly' else 'bulanan'} anda"
    )
    assert body["newsletter"]["insights"] == []
    assert body["newsletter"]["tip"] is None
    assert body["sections"][0]["heading"] == (
        "Spending overview" if locale == "en" else "Ringkasan perbelanjaan"
    )
    assert any("penjimatan" in value for value in body["disclosures"]) is (
        locale == "ms"
    )
    assert all("RM0" not in value for value in body["disclosures"])


@pytest.mark.parametrize(
    ("now", "cadence", "expected_start", "expected_end"),
    [
        (
            datetime.fromisoformat("2026-09-20T16:00:00+00:00"),
            "weekly",
            "2026-09-13T16:00:00.000Z",
            "2026-09-20T16:00:00.000Z",
        ),
        (
            datetime.fromisoformat("2026-09-20T15:59:59+00:00"),
            "weekly",
            "2026-09-06T16:00:00.000Z",
            "2026-09-13T16:00:00.000Z",
        ),
        (
            datetime.fromisoformat("2026-08-31T16:00:00+00:00"),
            "monthly",
            "2026-07-31T16:00:00.000Z",
            "2026-08-31T16:00:00.000Z",
        ),
    ],
)
def test_exact_malaysia_completion_boundaries(now, cadence, expected_start, expected_end) -> None:
    with _client(now=now) as client:
        response = client.post(
            "/api/reports/generate", json=_request_for(cadence, now=now)
        )

    assert response.status_code == 200
    assert response.json()["periodStart"] == expected_start
    assert response.json()["periodEnd"] == expected_end


def test_current_period_can_be_requested_for_a_manual_snapshot() -> None:
    payload = deepcopy(_request_for())
    current = period_analytics([], "weekly", FIXED_NOW)["current"]
    payload["periodStart"] = current["periodStart"]
    payload["periodEnd"] = current["periodEnd"]

    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["id"] == f"weekly:{current['periodStart']}"


def test_stable_id_and_ranges_are_canonical_even_when_request_uses_another_offset() -> None:
    payload = deepcopy(REPORT_FIXTURE["request"])
    payload["periodStart"] = "2026-09-14T00:00:00+08:00"
    payload["periodEnd"] = "2026-09-21T00:00:00+08:00"

    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["id"] == "weekly:2026-09-13T16:00:00.000Z"
    assert response.json()["periodStart"] == "2026-09-13T16:00:00.000Z"


def test_comparison_is_recomputed_and_null_only_when_no_prior_trips_exist() -> None:
    payload = deepcopy(REPORT_FIXTURE["request"])
    payload["trips"] = payload["trips"][1:]
    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["actualSpendingRm"] == 11.7
    assert body["comparison"] is None


def test_monthly_report_recomputes_both_calendar_months_in_malay() -> None:
    payload = _request_for("monthly", "ms")
    payload["trips"] = [
        {
            "recordedAt": "2026-07-15T12:00:00Z",
            "boughtLines": [
                {
                    "name": "previous household item",
                    "categoryId": "household",
                    "quantity": 1,
                    "lineTotalRm": 7.5,
                }
            ],
            "estimatedSavings": {
                "storeChoiceImpactRm": 1,
                "itemChangeImpactRm": 0,
                "netSavingRm": 1,
            },
        },
        {
            "recordedAt": "2026-08-15T12:00:00Z",
            "boughtLines": [
                {
                    "name": "current protein item",
                    "categoryId": "protein",
                    "quantity": 3,
                    "lineTotalRm": 20,
                }
            ],
            "estimatedSavings": {
                "storeChoiceImpactRm": 2,
                "itemChangeImpactRm": -0.5,
                "netSavingRm": 1.5,
            },
        },
    ]

    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["periodStart"] == "2026-07-31T16:00:00.000Z"
    assert body["periodEnd"] == "2026-08-31T16:00:00.000Z"
    assert body["id"] == "monthly:2026-07-31T16:00:00.000Z"
    assert body["actualSpendingRm"] == 20
    assert body["comparison"]["periodStart"] == "2026-06-30T16:00:00.000Z"
    assert body["comparison"]["periodEnd"] == "2026-07-31T16:00:00.000Z"
    assert body["comparison"]["actualSpendingRm"] == 7.5
    assert body["sections"][0]["heading"] == "Ringkasan perbelanjaan"
    assert body["newsletter"]["subject"] == "Laporan membeli-belah bulanan anda"
    newsletter = body["newsletter"]
    newsletter_words = (
        newsletter["opening"]
        + " "
        + " ".join(
            insight["heading"] + " " + insight["body"]
            for insight in newsletter["insights"]
        )
        + " "
        + (newsletter["tip"] or "")
    ).split()
    assert 150 <= len(newsletter_words) <= 250


def test_null_category_is_recomputed_as_uncategorised_mixed_or_unknown() -> None:
    payload = _request_for()
    payload["trips"] = [
        {
            "recordedAt": "2026-09-15T03:00:00Z",
            "boughtLines": [
                {
                    "name": "manual priced item",
                    "categoryId": None,
                    "quantity": 2,
                    "lineTotalRm": 4.25,
                }
            ],
            "estimatedSavings": None,
        }
    ]

    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["categorySpending"] == [
        {
            "categoryId": "uncategorised",
            "spendingClass": "mixed_or_unknown",
            "amountRm": 4.25,
            "partial": False,
        }
    ]
    assert body["spendingClassBreakdown"] == [
        {"spendingClass": "essential", "amountRm": 0},
        {"spendingClass": "discretionary", "amountRm": 0},
        {"spendingClass": "mixed_or_unknown", "amountRm": 4.25},
    ]
    assert body["specificCategorySpending"] == [
        {
            "categoryId": "uncategorised",
            "labelEn": "Uncategorised",
            "labelMs": "Tidak dikategorikan",
            "amountRm": 4.25,
            "partial": False,
        }
    ]


def test_specific_category_totals_are_localized_sorted_and_partial_when_unpriced() -> None:
    payload = _request_for()
    payload["trips"] = [
        {
            "recordedAt": "2026-09-15T03:00:00Z",
            "boughtLines": [
                {
                    "name": "eggs",
                    "categoryId": "protein",
                    "sourceCategory": {
                        "id": "dairy-eggs",
                        "labelEn": "Dairy & eggs",
                        "labelMs": "Tenusu & telur",
                    },
                    "quantity": 1,
                    "lineTotalRm": 4.5,
                },
                {
                    "name": "milk",
                    "categoryId": "drinks-milk",
                    "sourceCategory": {
                        "id": "dairy-eggs",
                        "labelEn": "Dairy & eggs",
                        "labelMs": "Tenusu & telur",
                    },
                    "quantity": 1,
                    "lineTotalRm": None,
                },
                {
                    "name": "apples",
                    "categoryId": "fresh-produce",
                    "sourceCategory": {
                        "id": "fruit",
                        "labelEn": "Fruit",
                        "labelMs": "Buah-buahan",
                    },
                    "quantity": 1,
                    "lineTotalRm": 7.2,
                },
                {
                    "name": "manual item",
                    "categoryId": None,
                    "sourceCategory": None,
                    "quantity": 1,
                    "lineTotalRm": 1,
                },
            ],
            "estimatedSavings": None,
        }
    ]

    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["specificCategorySpending"] == [
        {
            "categoryId": "fruit",
            "labelEn": "Fruit",
            "labelMs": "Buah-buahan",
            "amountRm": 7.2,
            "partial": True,
        },
        {
            "categoryId": "dairy-eggs",
            "labelEn": "Dairy & eggs",
            "labelMs": "Tenusu & telur",
            "amountRm": 4.5,
            "partial": True,
        },
        {
            "categoryId": "uncategorised",
            "labelEn": "Uncategorised",
            "labelMs": "Tidak dikategorikan",
            "amountRm": 1.0,
            "partial": True,
        },
    ]


def test_malay_missing_price_and_incomplete_savings_disclosures_are_localized() -> None:
    payload = _request_for(locale="ms")
    payload["trips"] = [
        {
            "recordedAt": "2026-09-15T03:00:00Z",
            "boughtLines": [
                {
                    "name": "unpriced Malay item",
                    "categoryId": "other",
                    "quantity": 1,
                    "lineTotalRm": None,
                }
            ],
            "estimatedSavings": {
                "storeChoiceImpactRm": None,
                "itemChangeImpactRm": None,
                "netSavingRm": None,
            },
        }
    ]

    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    disclosures = response.json()["disclosures"]
    assert any("item yang dibeli" in item for item in disclosures)
    assert any("tidak lengkap" in item for item in disclosures)
    assert all("RM0" not in item for item in disclosures)


def test_narrator_receives_minimized_facts_and_cannot_change_metrics_or_bindings() -> None:
    narrator = RecordingNarrator(
        prose="Custom prose sentinel", mutate_facts=True
    )
    with _client(now=_instant(REPORT_FIXTURE["now"]), narrator=narrator) as client:
        response = client.post("/api/reports/generate", json=REPORT_FIXTURE["request"])

    assert response.status_code == 200
    body = response.json()
    assert body["actualSpendingRm"] == 11.7
    assert body["categorySpending"][0]["amountRm"] == 9.45
    assert body["comparison"]["tripCount"] == 1
    assert body["comparison"]["actualSpendingRm"] == 5.1
    assert body["sections"][0]["observation"] == "Custom prose sentinel"
    assert [section["visualization"] for section in body["sections"]] == [
        "overview-kpis",
        "category-pie",
        "savings-breakdown",
        "spending-class-bar",
    ]
    assert len(narrator.calls) == 1
    facts_text = json.dumps(narrator.calls[0], sort_keys=True)
    assert "apples sentinel current" in facts_text
    assert "unpriced previous" not in facts_text
    assert narrator.calls[0]["actualSpendingRm"] == 11.7


def test_rejecting_rate_limit_hook_prevents_narrator_invocation() -> None:
    narrator = RecordingNarrator()
    hook_calls = []

    async def reject(_request):
        hook_calls.append(True)
        raise ReportRateLimitRejected()

    with _client(narrator=narrator, rate_limit_hook=reject) as client:
        response = client.post("/api/reports/generate", json=_request_for())

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "REPORT_RATE_LIMITED"
    assert hook_calls == [True]
    assert narrator.calls == []


@pytest.mark.parametrize(
    ("path", "extra"),
    [
        ((), {"userId": "private-user-sentinel"}),
        ((), {"period_start": "snake-case-is-not-an-api-field"}),
        (("trips", 0), {"storeName": "private-store-sentinel"}),
        (("trips", 0, "boughtLines", 0), {"spendingClass": "essential"}),
        (("trips", 0, "estimatedSavings"), {"privateKey": "private-savings-sentinel"}),
    ],
)
def test_unknown_request_fields_are_rejected_recursively_without_echo(path, extra) -> None:
    payload = deepcopy(REPORT_FIXTURE["request"])
    if not path:
        payload.update(extra)
    elif len(path) == 2:
        payload[path[0]][path[1]].update(extra)
    elif len(path) == 4:
        payload[path[0]][path[1]][path[2]][path[3]].update(extra)
    else:
        payload[path[0]][path[1]][path[2]].update(extra)

    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REPORT_REQUEST"
    assert all(sentinel not in response.text for sentinel in extra.values())


@pytest.mark.parametrize(
    "mutate",
    [
        lambda body: body.update(cadence="yearly"),
        lambda body: body.update(locale="fr"),
        lambda body: body.update(timeZone="UTC"),
        lambda body: body.update(periodStart="2026-09-13T16:00:00"),
        lambda body: body.update(periodEnd="2026-09-20T15:59:59.000Z"),
        lambda body: body.update(
            periodStart="2026-09-27T16:00:00.000Z",
            periodEnd="2026-10-04T16:00:00.000Z",
        ),
    ],
)
def test_invalid_ranges_instants_and_supported_values_fail_closed(mutate) -> None:
    payload = deepcopy(_request_for())
    mutate(payload)
    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)
    assert response.status_code == 400
    assert "periodStart" not in response.text


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("quantity", 0),
        ("quantity", -1),
        ("quantity", float("nan")),
        ("quantity", float("inf")),
        ("quantity", "2"),
        ("lineTotalRm", -0.01),
        ("lineTotalRm", float("inf")),
        ("categoryId", "not-a-broad-category"),
        ("recordedAt", "yesterday"),
        ("savings.netSavingRm", float("nan")),
        ("savings.storeChoiceImpactRm", float("inf")),
    ],
)
def test_invalid_line_numbers_category_and_trip_instants_are_rejected(field, value) -> None:
    payload = deepcopy(REPORT_FIXTURE["request"])
    line = payload["trips"][1]["boughtLines"][0]
    trip = payload["trips"][1]
    if field == "recordedAt":
        trip[field] = value
    elif field.startswith("savings."):
        trip["estimatedSavings"][field.split(".", maxsplit=1)[1]] = value
    else:
        line[field] = value

    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        response = client.post(
            "/api/reports/generate",
            content=json.dumps(payload, allow_nan=True),
            headers={"Content-Type": "application/json"},
        )
    assert response.status_code == 400


@pytest.mark.parametrize(
    "offset",
    [
        "2026-09-06T15:59:59Z",
        "2026-09-20T16:00:00Z",
    ],
)
def test_trips_outside_the_exact_two_period_window_are_rejected(offset) -> None:
    payload = deepcopy(REPORT_FIXTURE["request"])
    payload["trips"].append(
        {
            "recordedAt": offset,
            "boughtLines": [],
            "estimatedSavings": None,
        }
    )
    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        response = client.post("/api/reports/generate", json=payload)
    assert response.status_code == 400


def test_name_length_and_trip_and_line_count_limits() -> None:
    valid = deepcopy(REPORT_FIXTURE["request"])
    valid["trips"][1]["boughtLines"][0]["name"] = "x" * 200
    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        assert client.post("/api/reports/generate", json=valid).status_code == 200

    valid = deepcopy(REPORT_FIXTURE["request"])
    valid["trips"][1]["boughtLines"][0]["name"] = "x" * 201
    with _client(now=_instant(REPORT_FIXTURE["now"])) as client:
        assert client.post("/api/reports/generate", json=valid).status_code == 400

        too_many_trips = deepcopy(_request_for())
        template_trip = {
            "recordedAt": "2026-09-15T03:00:00Z",
            "boughtLines": [],
            "estimatedSavings": None,
        }
        too_many_trips["trips"] = [deepcopy(template_trip) for _ in range(129)]
        assert client.post("/api/reports/generate", json=too_many_trips).status_code == 400

        too_many_lines = deepcopy(_request_for())
        too_many_lines["trips"] = [
            {
                "recordedAt": "2026-09-15T03:00:00Z",
                "estimatedSavings": None,
                "boughtLines": [
                    {
                        "name": "x",
                        "categoryId": "other",
                        "quantity": 1,
                        "lineTotalRm": 0,
                    }
                    for _ in range(1001)
                ],
            }
        ]
        assert client.post("/api/reports/generate", json=too_many_lines).status_code == 400


def test_exact_body_cap_and_inclusive_record_count_limits() -> None:
    payload = _request_for()
    trip = {
        "recordedAt": "2026-09-15T03:00:00Z",
        "boughtLines": [],
        "estimatedSavings": None,
    }
    payload["trips"] = [deepcopy(trip) for _ in range(128)]
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    assert len(body) < 512 * 1024
    body = body + b" " * (512 * 1024 - len(body))

    with _client() as client:
        response = client.post("/api/reports/generate", content=body)
        line_limit_request = deepcopy(_request_for())
        line_limit_request["trips"] = [
            {
                "recordedAt": "2026-09-15T03:00:00Z",
                "estimatedSavings": None,
                "boughtLines": [
                    {
                        "name": "x",
                        "categoryId": "other",
                        "quantity": 1,
                        "lineTotalRm": 0,
                    }
                    for _ in range(1000)
                ],
            }
        ]
        line_limit_response = client.post(
            "/api/reports/generate", json=line_limit_request
        )

    assert response.status_code == 200
    assert response.json()["tripCount"] == 128
    assert line_limit_response.status_code == 200
    assert line_limit_response.json()["actualSpendingRm"] == 0


def test_all_unpriced_bought_lines_remain_null_without_fabricated_zero_rows() -> None:
    payload = _request_for()
    payload["trips"] = [
        {
            "recordedAt": "2026-09-15T03:00:00Z",
            "boughtLines": [
                {
                    "name": "unpriced only",
                    "categoryId": "other",
                    "quantity": 2,
                    "lineTotalRm": None,
                }
            ],
            "estimatedSavings": None,
        }
    ]
    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["actualSpendingRm"] is None
    assert body["spendingIncomplete"] is True
    assert body["categorySpending"] == []
    assert all(item["amountRm"] is None for item in body["spendingClassBreakdown"])
    assert all("RM0" not in disclosure for disclosure in body["disclosures"])


def test_oversize_raw_body_is_rejected_before_validation() -> None:
    body = b"{" + b" " * (512 * 1024)
    with _client() as client:
        response = client.post("/api/reports/generate", content=body)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REPORT_REQUEST_TOO_LARGE"


def test_logging_contains_only_aggregate_metadata_and_redacts_payload_and_narrative(caplog) -> None:
    secret_name = "item-name-secret-98431"
    secret_prose = "narrative-secret-73592"
    payload = deepcopy(REPORT_FIXTURE["request"])
    payload["trips"][1]["boughtLines"][0]["name"] = secret_name
    narrator = RecordingNarrator(prose=secret_prose)
    caplog.set_level("INFO", logger=api.__name__)

    with _client(now=_instant(REPORT_FIXTURE["now"]), narrator=narrator) as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    report_records = [
        record
        for record in caplog.records
        if getattr(record, "event", None) == "report_generation"
    ]
    assert len(report_records) == 1
    record = report_records[0]
    assert record.request_id
    assert record.outcome == "success"
    assert record.duration_ms >= 0
    assert record.cadence == "weekly"
    assert record.locale == "en"
    assert record.trip_count == 3
    assert record.line_count == 5
    assert record.request_bytes > 0
    assert record.generation_source == "fallback"
    serialized_records = repr([record.__dict__ for record in report_records])
    assert secret_name not in serialized_records
    assert secret_prose not in serialized_records


def test_report_endpoint_does_not_touch_database_network_or_background_task_hooks(
    monkeypatch,
) -> None:
    activity = {"database": 0, "network": 0, "task": 0}

    def reject_database(*_args, **_kwargs):
        activity["database"] += 1
        raise AssertionError("report generation must not persist")

    async def reject_network(*_args, **_kwargs):
        activity["network"] += 1
        raise AssertionError("G4 must not call a provider or network service")

    original_create_task = asyncio.create_task

    def track_task(coro, *args, **kwargs):
        activity["task"] += 1
        return original_create_task(coro, *args, **kwargs)

    monkeypatch.setattr(psycopg2, "connect", reject_database)
    monkeypatch.setattr(httpx.AsyncClient, "send", reject_network)
    monkeypatch.setattr(asyncio, "create_task", track_task)

    with _client() as client:
        response = client.post("/api/reports/generate", json=_request_for())

    assert response.status_code == 200
    assert activity == {"database": 0, "network": 0, "task": 0}
    assert list(inspect.signature(api.generate_report_endpoint).parameters) == ["request"]


def test_malformed_request_error_does_not_echo_json_fields() -> None:
    secret = "private-payload-field-26531"
    payload = deepcopy(_request_for())
    payload["privateLocation"] = secret
    with _client() as client:
        response = client.post("/api/reports/generate", json=payload)
    assert response.status_code == 400
    assert secret not in response.text
