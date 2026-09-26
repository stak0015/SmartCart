"""Mocked-provider contract and safety tests for G5 report narratives."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from dataclasses import replace
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from types import SimpleNamespace
from typing import Mapping

import pytest
from fastapi.testclient import TestClient

import main
from smartcart import cerebras_narrator
from smartcart.cerebras_narrator import (
    NARRATIVE_SCHEMA,
    PROVIDER_TIMEOUT_SECONDS,
    SDK_TIMEOUT_SECONDS,
    SYSTEM_INSTRUCTION,
    CerebrasReportNarrator,
)
from smartcart.config import get_settings
from smartcart.reporting import FallbackReportNarrator


API_KEY_SENTINEL = "synthetic-cerebras-test-key"
MODEL = "test-model"
FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "fixtures"
    / "reports"
    / "G4-report-response.json"
)

def _report_fixture() -> dict[str, object]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _facts(locale: str = "en") -> dict[str, object]:
    current = {
        "periodStart": "2026-09-13T16:00:00.000Z",
        "periodEnd": "2026-09-20T16:00:00.000Z",
        "tripCount": 1,
        "actualSpendingRm": 3.25,
        "spendingIncomplete": True,
        "estimatedNetSavingsRm": -0.5,
        "storeChoiceImpactRm": 1.25,
        "itemChangeImpactRm": -1.75,
        "savingsIncomplete": False,
        "categorySpending": [
            {
                "categoryId": "fresh-produce",
                "spendingClass": "essential",
                "amountRm": 3.25,
                "partial": False,
            }
        ],
        "specificCategorySpending": [
            {
                "categoryId": "apples",
                "labelEn": "Apples",
                "labelMs": "Epal",
                "amountRm": 3.25,
                "partial": False,
            }
        ],
        "spendingClassBreakdown": [
            {"spendingClass": "essential", "amountRm": 3.25},
            {"spendingClass": "discretionary", "amountRm": 0},
            {"spendingClass": "mixed_or_unknown", "amountRm": 0},
        ],
    }
    previous = deepcopy(current)
    previous.update(
        periodStart="2026-09-06T16:00:00.000Z",
        periodEnd="2026-09-13T16:00:00.000Z",
        tripCount=2,
        actualSpendingRm=8.5,
        specificCategorySpending=[
            {
                "categoryId": "apples",
                "labelEn": "Apples",
                "labelMs": "Epal",
                "amountRm": 8.5,
                "partial": False,
            }
        ],
    )
    return {
        "locale": locale,
        "cadence": "weekly",
        **current,
        "boughtItems": [
            {
                "name": "item-name-secret-991",
                "categoryId": "fresh-produce",
                "sourceCategory": {
                    "id": "apples",
                    "labelEn": "Apples",
                    "labelMs": "Epal",
                },
                "quantity": 2,
                "lineTotalRm": 3.25,
                "missingPrice": False,
            },
            {
                "name": "unpriced current item",
                "categoryId": None,
                "sourceCategory": None,
                "quantity": 1,
                "lineTotalRm": None,
                "missingPrice": True,
            },
        ],
        "comparison": previous,
        "disclosures": ["One bought item has no confirmed line total."],
        "userId": "private-user-sentinel",
        "reportId": "private-report-sentinel",
        "storeName": "private-store-sentinel",
        "storeId": "private-store-id-sentinel",
        "address": "private-address-sentinel",
        "origin": "private-origin-sentinel",
        "coordinates": "private-coordinates-sentinel",
        "route": "private-route-sentinel",
        "checklistId": "private-checklist-sentinel",
        "localStorageKey": "private-local-storage-sentinel",
        "apiKey": API_KEY_SENTINEL,
        "rawRequest": "private-raw-request-sentinel",
    }


def _narrative(locale: str = "en") -> dict[str, object]:
    if locale == "ms":
        return {
            "overview": {
                "heading": "Ringkasan perbelanjaan",
                "observation": "Perbelanjaan semasa merangkumi item yang dibeli.",
            },
            "categories": {
                "heading": "Kategori",
                "observation": "Item berharga dikumpulkan mengikut kategori umum.",
            },
            "savings": {
                "heading": "Anggaran penjimatan",
                "observation": "Anggaran penjimatan berdasarkan rekod tersimpan.",
            },
            "essentials": {
                "heading": "Kelas perbelanjaan",
                "observation": "Item dikelaskan dalam kumpulan perbelanjaan umum.",
            },
            "newsletter": {
                "subject": "Nota membeli-belah mingguan",
                "preview": "Kategori utama dalam rekod anda.",
                "opening": "Perjalanan yang anda rekodkan memberikan gambaran berguna tentang item dan kategori dalam tempoh semasa. Ringkasan ini menggunakan harga yang disimpan dan mengambil kira item tanpa harga sebagai batas kepada gambaran tersebut. Melihat rekod bagi tempoh yang setara boleh membantu anda memahami corak biasa dengan lebih jelas, tanpa membuat andaian tentang sebab sesuatu perubahan berlaku.",
                "insights": [
                    {"heading": "Kategori dalam rekod", "body": "Epal mempunyai jumlah perbelanjaan disahkan tertinggi dalam kategori semasa. Perbandingan ini merangkumi baris yang mempunyai harga disahkan, manakala item tanpa harga masih menjadi batas kepada jumlah tersebut. Ini menjadikan paparan kategori lebih khusus dan menjelaskan had rekod yang tersedia."},
                    {"heading": "Melihat tempoh setara", "body": "Rekod bagi tempoh semasa dan tempoh sebelumnya boleh dilihat bersama untuk memahami perubahan yang benar-benar muncul dalam jumlah tersimpan. Perbandingan itu menerangkan arah rekod sahaja dan tidak membuat andaian tentang sebab tabiat membeli-belah berubah. Nama item dan label kategori menambah konteks kepada gambaran ini."},
                    {"heading": "Anggaran penjimatan", "body": "Rekod perbandingan tersimpan mengandungi anggaran penjimatan dan komponen yang berkaitan. Anggaran ini memberikan konteks tambahan, tetapi ia berasingan daripada perbelanjaan disahkan dan tidak menjamin hasil pada masa hadapan. Nilai tersimpan yang tidak lengkap juga boleh mengehadkan gambaran keseluruhan."},
                ],
                "tip": "Jika berguna, catat item yang biasa dibeli dan sesuaikan senarai dengan keperluan semasa. Nota ringkas boleh membantu anda melihat corak seterusnya, sambil anda menentukan sendiri perkara yang sesuai.",
            },
        }
    return {
        "overview": {
            "heading": "Spending overview",
            "observation": "The current period includes confirmed spending.",
        },
        "categories": {
            "heading": "Category spending",
            "observation": "Priced items are grouped by broad category.",
        },
        "savings": {
            "heading": "Estimated savings",
            "observation": "The previous period has available saved values.",
        },
        "essentials": {
            "heading": "Spending classes",
            "observation": "Items are grouped by their broad classifications.",
        },
        "newsletter": {
            "subject": "Your weekly shopping note",
            "preview": "Your leading category has the most confirmed spending.",
            "opening": "Your recorded trips give a useful view of the items and categories that made up this period. The summary below follows the prices you saved and keeps unpriced items visible as a limit on the picture. Looking across equivalent periods can make everyday patterns easier to notice without guessing why a change happened.",
            "insights": [
                {"heading": "Your category mix", "body": "Apples has the largest confirmed category total in the current records. The comparison includes bought lines with a confirmed total, while unpriced items remain outside that amount. This keeps the category view specific and makes its limits clear for anyone reading the summary."},
                {"heading": "A comparison across periods", "body": "The current and previous equivalent periods can be viewed together to see the change present in the saved totals. That comparison describes the recorded direction without guessing why shopping habits may have changed. Item names and category labels add context to the picture while staying close to the information you recorded."},
                {"heading": "Estimated savings", "body": "The saved comparison snapshot includes estimated savings and related components. These estimates add context, but remain separate from confirmed spending and do not promise a future result. Missing saved values can also leave the overall picture incomplete, so the report keeps that uncertainty visible."},
            ],
            "tip": "If useful, keep a short note of usual items and adjust it for the plans that matter to you now. A simple reminder can make a future trip feel more focused while leaving every choice in your hands.",
        },
    }


def _content(values: object | None = None, *, locale: str = "en") -> str:
    return json.dumps(_narrative(locale) if values is None else values, ensure_ascii=False)


def _output_fields(values: Mapping[str, object]) -> list[str]:
    fields: list[str] = []
    for section_id in ("overview", "categories", "savings", "essentials"):
        section = values[section_id]
        fields.extend((section["heading"], section["observation"]))
    newsletter = values["newsletter"]
    fields.extend((newsletter["subject"], newsletter["preview"], newsletter["opening"]))
    for insight in newsletter["insights"]:
        fields.extend((insight["heading"], insight["body"]))
    if newsletter["tip"] is not None:
        fields.append(newsletter["tip"])
    return fields


def _response(content: str, choice_count: int = 1) -> object:
    return SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content=content))
            for _ in range(choice_count)
        ]
    )


class _Completions:
    def __init__(self, *, response=None, error=None, delay: float = 0) -> None:
        self.response = response
        self.error = error
        self.delay = delay
        self.calls: list[dict[str, object]] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.error is not None:
            raise self.error
        return self.response


class _Client:
    def __init__(self, completions: _Completions) -> None:
        self.chat = SimpleNamespace(completions=completions)
        self.entered = 0
        self.exited = 0

    async def __aenter__(self):
        self.entered += 1
        return self

    async def __aexit__(self, *_args):
        self.exited += 1


class _Factory:
    def __init__(self, completions: _Completions) -> None:
        self.completions = completions
        self.calls: list[dict[str, object]] = []
        self.client = _Client(completions)

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        return self.client


def _run(narrator: CerebrasReportNarrator, facts: Mapping[str, object]):
    return asyncio.run(narrator.narrate(facts))


def _narrator(monkeypatch, *, content=None, locale="en", error=None, delay=0):
    completion = _Completions(
        response=_response(content if content is not None else _content(locale=locale)),
        error=error,
        delay=delay,
    )
    factory = _Factory(completion)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", factory)
    narrator = CerebrasReportNarrator(api_key=API_KEY_SENTINEL, model=MODEL)
    return narrator, factory


def test_strict_schema_has_exact_keys_and_every_object_is_closed() -> None:
    assert set(NARRATIVE_SCHEMA["properties"]) == {
        "overview",
        "categories",
        "savings",
        "essentials",
        "newsletter",
    }
    assert NARRATIVE_SCHEMA["required"] == [
        "overview",
        "categories",
        "savings",
        "essentials",
        "newsletter",
    ]
    assert NARRATIVE_SCHEMA["additionalProperties"] is False
    for section_id in ("overview", "categories", "savings", "essentials"):
        section = NARRATIVE_SCHEMA["properties"][section_id]
        assert set(section["properties"]) == {"heading", "observation"}
        assert section["required"] == ["heading", "observation"]
        assert section["additionalProperties"] is False
        assert section["properties"]["heading"] == {
            "type": "string",
            "minLength": 1,
            "maxLength": 80,
        }
        assert section["properties"]["observation"] == {
            "type": "string",
            "minLength": 1,
            "maxLength": 320,
        }
    newsletter = NARRATIVE_SCHEMA["properties"]["newsletter"]
    assert set(newsletter["properties"]) == {
        "subject", "preview", "opening", "insights", "tip"
    }
    assert newsletter["required"] == ["subject", "preview", "opening", "insights", "tip"]
    assert newsletter["additionalProperties"] is False
    assert newsletter["properties"]["insights"]["maxItems"] == 3
    assert newsletter["properties"]["tip"]["type"] == ["string", "null"]


def test_provider_call_is_async_strict_and_uses_only_allowlisted_prompt_context(monkeypatch) -> None:
    monkeypatch.setattr(
        logging.getLogger("cerebras.cloud.sdk"), "level", logging.DEBUG
    )
    monkeypatch.setattr(logging.getLogger("httpx"), "level", logging.DEBUG)
    narrator, factory = _narrator(monkeypatch)
    result = _run(narrator, _facts())

    assert result.generation_source == "llm"
    assert len(factory.calls) == 1
    assert factory.calls == [
        {
            "api_key": API_KEY_SENTINEL,
            "timeout": 20.0,
            "max_retries": 0,
            "warm_tcp_connection": False,
        }
    ]
    assert SDK_TIMEOUT_SECONDS == 20.0
    assert logging.getLogger("cerebras.cloud.sdk").getEffectiveLevel() >= logging.WARNING
    assert logging.getLogger("httpx").getEffectiveLevel() >= logging.WARNING
    assert factory.client.entered == factory.client.exited == 1
    assert len(factory.completions.calls) == 1
    call = factory.completions.calls[0]
    assert set(call) == {"model", "messages", "response_format", "stream"}
    assert call["model"] == MODEL
    assert call["stream"] is False
    assert "tools" not in call
    assert call["messages"][0] == {
        "role": "system",
        "content": SYSTEM_INSTRUCTION,
    }
    assert call["response_format"] == {
        "type": "json_schema",
        "json_schema": {
            "name": "smartcart_report_narrative",
            "strict": True,
            "schema": NARRATIVE_SCHEMA,
        },
    }

    prompt = call["messages"][1]["content"]
    context = json.loads(prompt)
    assert prompt == json.dumps(
        context, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    assert set(context) == {
        "locale",
        "cadence",
        "report",
        "boughtItems",
        "comparison",
        "spendingTrend",
        "hasActivity",
        "richNarrative",
        "editorialHighlights",
        "disclosures",
    }
    assert set(context["report"]) == {
        "dateRange",
        "tripCount",
        "actualSpendingRm",
        "spendingIncomplete",
        "estimatedNetSavingsRm",
        "storeChoiceImpactRm",
        "itemChangeImpactRm",
        "savingsIncomplete",
        "categorySpending",
    }
    assert set(context["report"]["dateRange"]) == {"start", "end"}
    assert context["comparison"]["dateRange"] == {
        "start": "2026-09-06T16:00:00.000Z",
        "end": "2026-09-13T16:00:00.000Z",
    }
    assert context["report"]["estimatedNetSavingsRm"] == -0.5
    assert context["boughtItems"][1]["lineTotalRm"] is None
    assert context["boughtItems"][1]["missingPrice"] is True
    assert context["boughtItems"][0]["name"] == "item-name-secret-991"
    assert context["report"]["categorySpending"][0]["labelEn"] == "Fresh Produce"
    assert context["report"]["categorySpending"][0]["labelMs"] == "Hasil Segar"
    assert "sourceCategory" not in context["boughtItems"][0]
    for forbidden in (
        "private-user-sentinel",
        "private-report-sentinel",
        "private-store-sentinel",
        "private-store-id-sentinel",
        "private-address-sentinel",
        "private-origin-sentinel",
        "private-coordinates-sentinel",
        "private-route-sentinel",
        "private-checklist-sentinel",
        "private-local-storage-sentinel",
        "synthetic-cerebras-test-key",
        "private-raw-request-sentinel",
    ):
        assert forbidden not in prompt


def test_valid_output_only_gets_nfc_and_whitespace_normalization(monkeypatch) -> None:
    values = _narrative()
    values["overview"]["heading"] = "Cafe\u0301   spending overview"
    values["overview"]["observation"] = "The current   period includes confirmed spending."
    narrator, _factory = _narrator(monkeypatch, content=_content(values))

    result = _run(narrator, _facts())

    assert result.generation_source == "llm"
    assert result["overview"] == {
        "heading": "Café spending overview",
        "observation": "The current period includes confirmed spending.",
    }
    assert result["categories"] == values["categories"]


def test_requested_malay_locale_is_preserved(monkeypatch) -> None:
    narrator, _factory = _narrator(monkeypatch, locale="ms")

    result = _run(narrator, _facts("ms"))

    assert result.generation_source == "llm"
    assert result["overview"]["heading"] == "Ringkasan perbelanjaan"


def test_newsletter_has_a_rich_personal_body_and_practical_tip(monkeypatch) -> None:
    narrator, _factory = _narrator(monkeypatch)
    result = _run(narrator, _facts())

    newsletter = result["newsletter"]
    body = " ".join(
        [newsletter["opening"]]
        + [part for insight in newsletter["insights"] for part in (insight["heading"], insight["body"])]
        + [newsletter["tip"]]
    )
    assert result.generation_source == "llm"
    assert 150 <= len(body.split()) <= 250
    assert len(newsletter["insights"]) <= 3
    assert newsletter["tip"]
    assert "Apples" in body


def test_sparse_period_accepts_a_short_honest_newsletter(monkeypatch) -> None:
    facts = _facts()
    facts.update(
        tripCount=0,
        actualSpendingRm=None,
        boughtItems=[],
        comparison=None,
        categorySpending=[],
        specificCategorySpending=[],
        spendingClassBreakdown=[
            {"spendingClass": "essential", "amountRm": None},
            {"spendingClass": "discretionary", "amountRm": None},
            {"spendingClass": "mixed_or_unknown", "amountRm": None},
        ],
    )
    values = _narrative()
    values["overview"].update(observation="No trips were recorded in this period.")
    values["categories"].update(observation="No category totals are available in this period.")
    values["savings"].update(observation="Estimated savings are unavailable in this period.")
    values["essentials"].update(observation="No spending class totals are available in this period.")
    values["newsletter"] = {
        "subject": "Your weekly shopping note",
        "preview": "No trips were recorded this period.",
        "opening": "No shopping trips were recorded during this period, so this report is brief.",
        "insights": [],
        "tip": None,
    }
    narrator, _factory = _narrator(monkeypatch, content=_content(values))

    result = _run(narrator, facts)

    assert result.generation_source == "llm"
    assert result["newsletter"]["insights"] == []
    assert result["newsletter"]["tip"] is None


def test_missing_key_selects_fallback_without_constructing_a_client() -> None:
    def no_client(**_kwargs):
        raise AssertionError("missing key must not construct the SDK client")

    narrator = CerebrasReportNarrator(
        api_key=None, model=MODEL, client_factory=no_client
    )
    result = _run(narrator, _facts("ms"))

    assert result.generation_source == "fallback"
    assert result["overview"]["heading"] == "Ringkasan perbelanjaan"


def test_config_and_app_wiring_keep_key_server_side_and_preserve_injection(monkeypatch) -> None:
    monkeypatch.delenv("CEREBRAS_API_KEY", raising=False)
    monkeypatch.delenv("CEREBRAS_MODEL", raising=False)
    get_settings.cache_clear()
    settings = get_settings()
    get_settings.cache_clear()
    assert settings.cerebras_api_key is None
    assert settings.cerebras_model == "gpt-oss-120b"
    monkeypatch.setenv("CEREBRAS_API_KEY", "   ")
    get_settings.cache_clear()
    assert get_settings().cerebras_api_key is None
    get_settings.cache_clear()

    configured = replace(settings, cerebras_api_key=None, cerebras_model=MODEL)
    monkeypatch.setattr(main, "get_settings", lambda: configured)
    app = main.create_app()
    assert isinstance(app.state.report_narrator, CerebrasReportNarrator)
    assert app.state.report_narrator._api_key is None

    injected = FallbackReportNarrator()
    assert main.create_app(report_narrator=injected).state.report_narrator is injected


@pytest.mark.parametrize(
    ("content", "choice_count", "reason"),
    [
        ("not-json", 1, "invalid_json"),
        ("{}", 0, "empty_choice"),
        (_content(), 2, "multiple_choices"),
        ("", 1, "empty_content"),
        ("é" * 4097, 1, "oversize_output"),
        (json.dumps({"overview": {}}), 1, "schema_mismatch"),
        (json.dumps({**_narrative(), "private": "extra"}), 1, "schema_mismatch"),
    ],
)
def test_malformed_or_over_limit_provider_content_falls_back(
    monkeypatch, caplog, content, choice_count, reason
) -> None:
    completion = _Completions(response=_response(content, choice_count))
    factory = _Factory(completion)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", factory)
    narrator = CerebrasReportNarrator(api_key=API_KEY_SENTINEL, model=MODEL)
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)

    result = _run(narrator, _facts())

    assert result.generation_source == "fallback"
    assert result["overview"]["heading"] == "Spending overview"
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    assert diagnostic.reason_code == reason
    assert len(factory.completions.calls) == 1


@pytest.mark.parametrize(
    ("mutation", "locale"),
    [
        (lambda value: value["overview"].update(heading=""), "en"),
        (lambda value: value["overview"].update(heading="h" * 81), "en"),
        (lambda value: value["overview"].update(observation="o" * 321), "en"),
        (lambda value: value["overview"].update(observation="One. Two. Three."), "en"),
        (lambda value: value["overview"].update(observation="One.Two.Three."), "en"),
        (lambda value: value["overview"].update(observation="The total is ٣."), "en"),
        (lambda value: value["overview"].update(observation="Spending was higher."), "en"),
        (lambda value: value["overview"].update(observation="Perbelanjaan lebih tinggi."), "ms"),
        (lambda value: value["overview"].update(observation="The total is RM five."), "en"),
        (lambda value: value["overview"].update(observation="The total is MYR five."), "en"),
        (lambda value: value["overview"].update(observation="The total is five ringgit."), "en"),
        (lambda value: value["overview"].update(observation="The total is five sen."), "en"),
        (lambda value: value["overview"].update(observation="The total is one."), "en"),
        (lambda value: value["overview"].update(heading="Twenty spending"), "en"),
        (lambda value: value["overview"].update(observation="The current period includes twenty-one items."), "en"),
        (lambda value: value["overview"].update(observation="The current period includes the twenty-first item."), "en"),
        (lambda value: value["overview"].update(observation="The total is $ five."), "en"),
        (lambda value: value["overview"].update(observation="You should buy more."), "en"),
        (lambda value: value["overview"].update(observation="Track spending weekly."), "en"),
        (lambda value: value["overview"].update(observation="A bad shopper should feel shame."), "en"),
        (lambda value: value["overview"].update(observation="Anda patut membeli lebih."), "ms"),
        (lambda value: value["overview"].update(observation="Pantau perbelanjaan mingguan."), "ms"),
        (lambda value: value["overview"].update(observation="Pembeli yang buruk patut berasa malu."), "ms"),
        (lambda value: value["overview"].update(heading="Sebelas kategori"), "ms"),
        (lambda value: value["overview"].update(observation="Perbelanjaan merangkumi dua belas item."), "ms"),
        (lambda value: value["overview"].update(heading="Dua puluh kategori"), "ms"),
        (lambda value: value["overview"].update(observation="One line.\nSecond line."), "en"),
        (lambda value: value["overview"].update(observation="One line.\u202e text."), "en"),
    ],
)
def test_unsafe_prose_is_rejected_in_english_and_malay(monkeypatch, mutation, locale) -> None:
    values = _narrative(locale)
    mutation(values)
    narrator, _factory = _narrator(
        monkeypatch, content=_content(values, locale=locale)
    )

    result = _run(narrator, _facts(locale))

    assert result.generation_source == "fallback"
    assert result["overview"]["heading"] == (
        "Spending overview" if locale == "en" else "Ringkasan perbelanjaan"
    )


@pytest.mark.parametrize(
    "phrase",
    [
        "zero", "one", "two", "three", "four", "five", "six", "seven",
        "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
        "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
        "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
        "twenty-one", "ninety nine", "first", "nineteenth", "twenty-first",
        "hundredth", "hundreds", "thousand", "million", "billionth", "once", "twice",
        "half", "quarter", "double", "triple", "kosong", "sifar", "satu",
        "dua", "tiga", "empat", "lima", "enam", "tujuh", "lapan",
        "sembilan", "sepuluh", "sebelas", "dua belas", "sembilan belas",
        "dua puluh", "dua puluh satu", "pertama", "kedua", "ketiga", "keempat",
        "kesebelas", "ratus", "ratusan", "ribu", "juta", "bilion", "setengah", "separuh",
        "suku", "berganda",
    ],
)
def test_numeric_words_are_rejected_with_word_boundaries(phrase) -> None:
    assert cerebras_narrator._NUMERIC_PROSE.search(phrase)


@pytest.mark.parametrize("ordinary_word", ["someone", "stone", "keterangan", "keduanya"])
def test_numeric_word_rejection_does_not_match_inside_words(ordinary_word) -> None:
    assert cerebras_narrator._NUMERIC_PROSE.search(ordinary_word) is None


def test_requested_locale_must_decisively_dominate_opposite_markers() -> None:
    # This is the previous validator's gap: 2 English markers versus 3 Malay
    # markers passed its loose tolerance despite the output being mostly Malay.
    assert not cerebras_narrator._locale_matches(
        ["the with dan yang dalam merangkumi"], "en"
    )
    assert not cerebras_narrator._locale_matches(["the with dan yang"], "en")
    assert not cerebras_narrator._locale_matches(
        ["the and with spending dan yang"], "ms"
    )
    for locale in ("en", "ms"):
        fields = _output_fields(_narrative(locale))
        assert cerebras_narrator._locale_matches(fields, locale)


def test_mostly_malay_output_for_english_falls_back(monkeypatch) -> None:
    values = _narrative()
    for key in ("overview", "categories", "savings", "essentials"):
        pair = values[key]
        pair["heading"] = "The"
        pair["observation"] = "The with dan yang dalam merangkumi."
    values["newsletter"].update(
        subject="Nota membeli-belah mingguan",
        preview="Perbelanjaan semasa merangkumi kategori utama.",
        opening="Perjalanan anda menunjukkan rekod yang berguna.",
        insights=[],
        tip=None,
    )
    narrator, _factory = _narrator(monkeypatch, content=_content(values))

    result = _run(narrator, _facts("en"))

    assert result.generation_source == "fallback"


@pytest.mark.parametrize("requested_locale", ["en", "ms"])
def test_clear_wrong_locale_output_falls_back(monkeypatch, requested_locale) -> None:
    opposite = "ms" if requested_locale == "en" else "en"
    narrator, _factory = _narrator(monkeypatch, locale=opposite)

    result = _run(narrator, _facts(requested_locale))

    assert result.generation_source == "fallback"


def test_unclassified_output_locale_falls_back(monkeypatch) -> None:
    values = _narrative()
    for key in ("overview", "categories", "savings", "essentials"):
        pair = values[key]
        pair["heading"] = "lorem ipsum"
        pair["observation"] = "Lorem ipsum dolor sit amet."
    values["newsletter"].update(
        subject="Lorem ipsum",
        preview="Dolor sit amet.",
        opening="Lorem ipsum dolor sit amet.",
        insights=[],
        tip=None,
    )
    narrator, _factory = _narrator(monkeypatch, content=_content(values))

    result = _run(narrator, _facts())

    assert result.generation_source == "fallback"


def test_rate_limit_error_falls_back_once_with_bounded_reason(monkeypatch, caplog) -> None:
    class SyntheticRateLimitError(Exception):
        pass

    monkeypatch.setattr(cerebras_narrator, "RateLimitError", SyntheticRateLimitError)
    completion = _Completions(error=SyntheticRateLimitError(API_KEY_SENTINEL))
    factory = _Factory(completion)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", factory)
    narrator = CerebrasReportNarrator(api_key=API_KEY_SENTINEL, model=MODEL)
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)

    result = _run(narrator, _facts())

    assert result.generation_source == "fallback"
    assert len(factory.completions.calls) == 1
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    assert diagnostic.reason_code == "provider_rate_limit"
    assert API_KEY_SENTINEL not in repr(diagnostic.__dict__)


def test_malformed_choice_shape_falls_back(monkeypatch, caplog) -> None:
    completion = _Completions(response=SimpleNamespace(choices=None))
    factory = _Factory(completion)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", factory)
    narrator = CerebrasReportNarrator(api_key=API_KEY_SENTINEL, model=MODEL)
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)

    result = _run(narrator, _facts())

    assert result.generation_source == "fallback"
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    assert diagnostic.reason_code == "malformed_response"


@pytest.mark.parametrize(
    ("error_kind", "reason"),
    [
        ("sdk", "provider_error"),
        ("unexpected", "unexpected_provider_error"),
    ],
)
def test_provider_and_unexpected_failures_fall_back_without_exception_details(
    monkeypatch, caplog, error_kind, reason
) -> None:
    class SyntheticAPIError(Exception):
        pass

    if error_kind == "sdk":
        monkeypatch.setattr(cerebras_narrator, "APIError", SyntheticAPIError)
        error = SyntheticAPIError("provider-body-private-sentinel")
    else:
        error = RuntimeError("provider-exception-private-sentinel")
    completion = _Completions(error=error)
    factory = _Factory(completion)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", factory)
    narrator = CerebrasReportNarrator(api_key=API_KEY_SENTINEL, model=MODEL)
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)

    result = _run(narrator, _facts())

    assert result.generation_source == "fallback"
    assert len(factory.completions.calls) == 1
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    assert diagnostic.reason_code == reason
    serialized = repr(diagnostic.__dict__)
    assert "provider-body-private-sentinel" not in serialized
    assert "provider-exception-private-sentinel" not in serialized


def test_sdk_timeout_and_outer_twenty_second_bound_fall_back_without_retry(
    monkeypatch, caplog
) -> None:
    monkeypatch.setattr(cerebras_narrator, "PROVIDER_TIMEOUT_SECONDS", 0.01)
    narrator, factory = _narrator(monkeypatch, delay=0.2)
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)

    result = _run(narrator, _facts())

    assert result.generation_source == "fallback"
    assert factory.calls[0]["timeout"] == 20.0
    assert factory.calls[0]["max_retries"] == 0
    assert len(factory.completions.calls) == 1
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    assert diagnostic.reason_code == "timeout"
    assert PROVIDER_TIMEOUT_SECONDS == 20.0


def test_provider_diagnostics_are_correlated_and_contain_no_request_or_output_data(
    monkeypatch, caplog
) -> None:
    narrator, _factory = _narrator(monkeypatch)
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)
    token = cerebras_narrator.report_request_id.set("correlation-sentinel-102")
    try:
        result = _run(narrator, _facts())
    finally:
        cerebras_narrator.report_request_id.reset(token)

    assert result.generation_source == "llm"
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    assert diagnostic.request_id == "correlation-sentinel-102"
    assert diagnostic.outcome == "success"
    assert diagnostic.duration_ms >= 0
    assert diagnostic.model == MODEL
    assert diagnostic.generation_source == "llm"
    assert diagnostic.reason_code == "accepted"
    serialized = repr(diagnostic.__dict__)
    for private in (
        API_KEY_SENTINEL,
        "item-name-secret-991",
        "private-store-sentinel",
        _content(),
        "The current period includes confirmed spending.",
    ):
        assert private not in serialized


def test_default_app_wires_provider_and_returns_llm_only_for_validated_prose(
    monkeypatch, caplog
) -> None:
    original_settings = get_settings()
    settings = replace(
        original_settings,
        cerebras_api_key=API_KEY_SENTINEL,
        cerebras_model=MODEL,
    )
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    _narrator_instance, factory = _narrator(monkeypatch)
    monkeypatch.setattr(
        cerebras_narrator,
        "AsyncCerebras",
        factory,
    )
    caplog.set_level("INFO", logger=cerebras_narrator.__name__)
    caplog.set_level("INFO", logger="smartcart.api")
    report_fixture = _report_fixture()
    payload = deepcopy(report_fixture["request"])
    payload["trips"][1]["boughtLines"][0]["name"] = "api-item-private-sentinel-512"
    now = datetime.fromisoformat(report_fixture["now"].replace("Z", "+00:00"))

    with TestClient(main.create_app(report_clock=lambda: now)) as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["generationSource"] == "llm"
    assert body["actualSpendingRm"] == report_fixture["expected"]["actualSpendingRm"]
    assert body["categorySpending"] == report_fixture["expected"]["categorySpending"]
    assert body["comparison"] == report_fixture["expected"]["comparison"]
    assert [section["id"] for section in body["sections"]] == [
        "overview",
        "categories",
        "savings",
        "essentials",
    ]
    assert [section["visualization"] for section in body["sections"]] == [
        "overview-kpis",
        "category-pie",
        "savings-breakdown",
        "spending-class-bar",
    ]
    assert "api-item-private-sentinel-512" in factory.completions.calls[0]["messages"][1]["content"]
    diagnostic = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "cerebras_report_narrative"
    )
    endpoint_record = next(
        record
        for record in caplog.records
        if getattr(record, "event", None) == "report_generation"
    )
    assert diagnostic.request_id == endpoint_record.request_id
    serialized = repr([record.__dict__ for record in caplog.records])
    assert API_KEY_SENTINEL not in serialized
    assert "api-item-private-sentinel-512" not in serialized


def test_provider_failure_returns_localized_ready_fallback_without_error_details(
    monkeypatch,
) -> None:
    settings = replace(
        get_settings(),
        cerebras_api_key=API_KEY_SENTINEL,
        cerebras_model=MODEL,
    )
    monkeypatch.setattr(main, "get_settings", lambda: settings)
    completion = _Completions(error=RuntimeError("provider-body-private-sentinel"))
    factory = _Factory(completion)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", factory)
    report_fixture = _report_fixture()
    payload = deepcopy(report_fixture["request"])
    payload["locale"] = "ms"
    now = datetime.fromisoformat(report_fixture["now"].replace("Z", "+00:00"))

    with TestClient(main.create_app(report_clock=lambda: now)) as client:
        response = client.post("/api/reports/generate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["generationSource"] == "fallback"
    assert body["sections"][0]["heading"] == "Ringkasan perbelanjaan"
    assert "provider-body-private-sentinel" not in response.text
    assert len(factory.completions.calls) == 1
