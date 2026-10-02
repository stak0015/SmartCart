"""Behavior-focused report prose and broad-category provider context."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from smartcart.cerebras_narrator import _build_context
from smartcart.report_models import GenerateReportRequest
from smartcart.reporting import FallbackReportNarrator, _narrative_newsletter, generate_report


def _request(locale: str) -> GenerateReportRequest:
    return GenerateReportRequest.model_validate({
        "cadence": "weekly",
        "periodStart": "2026-09-20T16:00:00.000Z",
        "periodEnd": "2026-09-27T16:00:00.000Z",
        "locale": locale,
        "timeZone": "Asia/Kuala_Lumpur",
        "trips": [{
            "recordedAt": "2026-09-24T12:00:00.000Z",
            "boughtLines": [
                {
                    "name": "Eggs",
                    "categoryId": "protein",
                    "sourceCategory": {"id": "eggs", "labelEn": "Eggs", "labelMs": "Telur"},
                    "quantity": 1,
                    "lineTotalRm": 12.0,
                },
                {
                    "name": "Apples",
                    "categoryId": "fresh-produce",
                    "sourceCategory": {"id": "apples", "labelEn": "Apples", "labelMs": "Epal"},
                    "quantity": 1,
                    "lineTotalRm": 5.0,
                },
            ],
            "estimatedSavings": {
                "storeChoiceImpactRm": 2.0,
                "itemChangeImpactRm": 1.0,
                "netSavingRm": 3.0,
            },
        }],
    })


def test_fallback_report_describes_purchases_and_broad_categories_in_both_languages() -> None:
    for locale, broad_label, purchase_intro in (
        ("en", "Meat, Seafood & Protein", "Your recorded purchases included"),
        ("ms", "Daging, Makanan Laut & Protein", "Antara item yang anda beli ialah"),
    ):
        report = asyncio.run(generate_report(
            _request(locale),
            datetime(2026, 9, 26, 12, tzinfo=timezone.utc),
            FallbackReportNarrator(),
        )).model_dump(by_alias=True)

        assert report["generationSource"] == "fallback"
        assert report["actualSpendingRm"] == 17.0
        assert report["estimatedNetSavingsRm"] == 3.0
        assert report["categorySpending"][0]["categoryId"] == "protein"
        assert report["specificCategorySpending"][0]["categoryId"] == "eggs"
        assert report["newsletter"]["opening"].startswith(purchase_intro)
        assert broad_label in report["newsletter"]["opening"]
        assert broad_label in report["newsletter"]["insights"][0]["body"]
        assert broad_label in report["newsletter"]["tip"]
        assert "review your" not in report["newsletter"]["tip"].lower()


def test_cerebras_context_contains_broad_labels_but_no_source_categories() -> None:
    facts = {
        "locale": "en",
        "cadence": "weekly",
        "periodStart": "2026-09-20T16:00:00.000Z",
        "periodEnd": "2026-09-27T16:00:00.000Z",
        "tripCount": 1,
        "actualSpendingRm": 12.0,
        "spendingIncomplete": False,
        "estimatedNetSavingsRm": 2.0,
        "storeChoiceImpactRm": 2.0,
        "itemChangeImpactRm": 0.0,
        "savingsIncomplete": False,
        "categorySpending": [{"categoryId": "protein", "spendingClass": "essential", "amountRm": 12.0, "partial": False}],
        "specificCategorySpending": [{"categoryId": "eggs", "labelEn": "Eggs", "labelMs": "Telur", "amountRm": 12.0, "partial": False}],
        "spendingClassBreakdown": [{"spendingClass": "essential", "amountRm": 12.0}],
        "boughtItems": [{"name": "Eggs", "categoryId": "protein", "sourceCategory": {"id": "eggs", "labelEn": "Eggs", "labelMs": "Telur"}, "quantity": 1, "lineTotalRm": 12.0, "missingPrice": False}],
        "comparison": None,
        "disclosures": [],
    }
    context = _build_context(facts)

    assert context["report"]["categorySpending"][0]["labelEn"] == "Meat, Seafood & Protein"
    assert context["report"]["categorySpending"][0]["labelMs"] == "Daging, Makanan Laut & Protein"
    assert context["editorialHighlights"]["leadingCategoryLabels"] == ["Meat, Seafood & Protein"]
    assert "specificCategorySpending" not in context["report"]
    assert "spendingClassBreakdown" not in context["report"]
    assert "sourceCategory" not in context["boughtItems"][0]


def test_generic_list_advice_is_removed_even_when_it_names_a_category() -> None:
    narrative = {"newsletter": {
        "subject": "Your shopping note",
        "preview": "Your purchases",
        "opening": "Your purchases were recorded.",
        "insights": [],
        "tip": "Review your list for Fresh Produce before your next trip.",
    }}

    newsletter = _narrative_newsletter(
        narrative, "weekly", "en", "Your recorded purchases included Apples.",
        ("fresh produce",),
    )

    assert newsletter.tip is None


def test_sparse_report_is_short_and_does_not_invent_a_pattern() -> None:
    payload = _request("en").model_dump(by_alias=True)
    payload["trips"] = []
    report = asyncio.run(generate_report(
        GenerateReportRequest.model_validate(payload),
        datetime(2026, 9, 26, 12, tzinfo=timezone.utc),
        FallbackReportNarrator(),
    )).model_dump(by_alias=True)

    assert report["tripCount"] == 0
    assert report["categorySpending"] == []
    assert report["newsletter"]["tip"] is None
    assert "No shopping trips were recorded" in report["newsletter"]["opening"]
