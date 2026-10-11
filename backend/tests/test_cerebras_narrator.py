"""Mocked-provider tests: the model rewrites findings, the application keeps the figures."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import json
import logging
from types import SimpleNamespace

import pytest

from smartcart import cerebras_narrator
from smartcart.cerebras_narrator import NARRATIVE_SCHEMA, SYSTEM_INSTRUCTION, CerebrasReportNarrator
from smartcart.reporting import generate_report
from report_builders import AFTER_WEEK, WEEK_START, line, request, trip, weekly_history


MODEL = "test-model"


class _Completions:
    def __init__(self, response=None, error=None) -> None:
        self.response = response
        self.error = error
        self.calls: list[dict[str, object]] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.response


class _Client:
    def __init__(self, completions: _Completions) -> None:
        self.chat = SimpleNamespace(completions=completions)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None


def _response(content: str, choices: int = 1):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content)) for _ in range(choices)])


def _payload(locale: str = "en"):
    """A week with higher spending (f1) and a chicken price rise (f2)."""
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 17.0, key="1001"),
        line("Grade A Eggs", 12.0, key="1002"),
        line("Fresh Milk", 7.0, key="1003", category="drinks-milk"),
        line("Potato Chips", 30.0, key="2001", category="snacks-convenience"),
    ], store="Jaya Grocer Sunway")
    return request([*weekly_history(), current], locale=locale)


def _generate(monkeypatch, content=None, *, error=None, choices=1, locale="en", api_key="test-key"):
    completions = _Completions(None if content is None else _response(content, choices), error)
    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", lambda **_kwargs: _Client(completions))
    narrator = CerebrasReportNarrator(api_key=api_key, model=MODEL)
    report = asyncio.run(generate_report(_payload(locale), AFTER_WEEK, narrator))
    return report, completions


GOOD = {
    "insights": [
        {
            "id": "f1",
            "title": "A bigger week than usual",
            "body": "You spent {{amount}} this week, against a usual week of about {{usual}}. Most of the extra went on {{driver_en}}.",
            "action": "If {{driver_en}} was not on your list, that is the easiest place to trim next week.",
        },
        {
            "id": "f2",
            "title": "Chicken cost more",
            "body": "You paid {{price}} for {{item}}, up {{change}} on the {{usual_price}} you usually pay.",
            "action": "Check {{cheaper_store}} next time; you paid {{cheaper_price}} there before.",
        },
    ]
}


def _fallback_body(report, index: int) -> str:
    return report.newsletter.insights[index].body


def test_schema_is_closed_and_has_no_headline() -> None:
    assert NARRATIVE_SCHEMA["required"] == ["insights"]
    assert NARRATIVE_SCHEMA["additionalProperties"] is False
    item = NARRATIVE_SCHEMA["properties"]["insights"]["items"]  # type: ignore[index]
    assert item["required"] == ["id", "title", "body", "action"]
    assert item["additionalProperties"] is False
    assert "{{placeholder}}" in SYSTEM_INSTRUCTION


def test_valid_prose_is_accepted_and_placeholders_become_exact_figures(monkeypatch) -> None:
    report, completions = _generate(monkeypatch, json.dumps(GOOD))
    first, second = report.newsletter.insights[:2]
    assert report.generation_source == "llm"
    assert first.kind == "spending_vs_usual"
    assert first.body == "You spent RM66.00 this week, against a usual week of about RM33.00. Most of the extra went on Snacks & Convenience Foods."
    assert first.evidence is not None and first.evidence.value == "+RM33.00"
    assert second.title == "Chicken cost more"
    assert "RM17.00" in second.body and "RM14.00" in second.body
    # The headline is always the application's own sentence.
    assert report.newsletter.headline == "This was a bigger week than usual, about RM33.00 above your usual week."

    context = json.loads(completions.calls[0]["messages"][1]["content"])  # type: ignore[index]
    assert set(context) == {"locale", "cadence", "periodInProgress", "findings"}
    assert [finding["id"] for finding in context["findings"]][:2] == ["f1", "f2"]
    assert "boughtItems" not in json.dumps(context)


@pytest.mark.parametrize("bad_body", [
    "You spent 66 ringgit this week.",                              # digits / currency
    "You spent twice your usual {{usual}}.",                        # number word
    "You spent {{amount}}, so you should cut back.",                # advice outside the action
    "You spent {{secret}} this week.",                              # unknown placeholder
    "You spent {{amount}}, lower than your usual {{usual}}.",       # wrong direction
    "Your unhealthy snacks cost {{amount}}.",                       # judgment / health
    "You overspent on {{driver_en}}, reaching {{amount}}.",         # negative framing
])
def test_one_unsafe_insight_falls_back_alone(monkeypatch, bad_body: str) -> None:
    content = json.loads(json.dumps(GOOD))
    content["insights"][0]["body"] = bad_body
    report, _ = _generate(monkeypatch, json.dumps(content))
    assert report.generation_source == "llm"  # f2 was still accepted
    assert report.newsletter.insights[0].title == "A bigger week than usual"
    assert report.newsletter.insights[0].body.startswith("You spent RM66.00, compared with a usual week of about RM33.00")
    assert report.newsletter.insights[1].title == "Chicken cost more"


def test_advice_is_allowed_in_the_action_only(monkeypatch) -> None:
    content = json.loads(json.dumps(GOOD))
    content["insights"][0]["action"] = "Try leaving {{driver_en}} off your list next week."
    report, _ = _generate(monkeypatch, json.dumps(content))
    assert report.newsletter.insights[0].action == "Try leaving Snacks & Convenience Foods off your list next week."


def test_an_action_must_be_kept_exactly_when_the_finding_has_one(monkeypatch) -> None:
    content = json.loads(json.dumps(GOOD))
    content["insights"][1]["action"] = None
    report, _ = _generate(monkeypatch, json.dumps(content))
    assert report.newsletter.insights[1].title == "Prices to watch on your regulars"  # template copy
    assert report.newsletter.insights[0].title == "A bigger week than usual"


def test_estimates_must_be_labelled_and_never_claimed_as_saved(monkeypatch) -> None:
    current = trip(WEEK_START + timedelta(days=2), [line("Chicken Breast Fillet", 14.0, key="1001")],
                   planned=40.0, alternative=("Mydin Mutiara", 30.0))
    payload = request([*weekly_history(), current])
    for body in (
        "Your trip at {{store}} cost {{gap}} more than {{alternative}}.",
        "Shopping at {{alternative}} would have saved {{gap}}, estimated.",
    ):
        content = {"insights": [{"id": "f1", "title": "A cheaper store", "body": body,
                                 "action": "Compare {{alternative}} before your next shop."}]}
        completions = _Completions(_response(json.dumps(content)))
        monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", lambda **_kwargs: _Client(completions))
        narrator = CerebrasReportNarrator(api_key="test-key", model=MODEL)
        report = asyncio.run(generate_report(payload, AFTER_WEEK, narrator))
        store = next(insight for insight in report.newsletter.insights if insight.kind == "store_choice")
        assert store.body == "For a basket like yours, Mydin Mutiara was estimated RM10.00 cheaper than Lotus's Cheras, including travel."


def test_malay_prose_must_be_malay(monkeypatch) -> None:
    content = {"insights": [{
        "id": "f1", "title": "Minggu lebih besar",
        "body": "Anda berbelanja {{amount}} minggu ini, berbanding minggu biasa kira-kira {{usual}}.",
        "action": "Jika {{driver_ms}} tidak dirancang, ia paling mudah dikurangkan minggu depan.",
    }, {
        "id": "f2", "title": "Chicken cost more",
        "body": "You paid {{price}} for {{item}}, up on the {{usual_price}} you usually pay.",
        "action": "Check {{cheaper_store}} next time.",
    }]}
    report, _ = _generate(monkeypatch, json.dumps(content), locale="ms")
    assert report.newsletter.insights[0].body.startswith("Anda berbelanja RM66.00 minggu ini")
    assert report.newsletter.insights[1].title == "Harga untuk diperhatikan pada item biasa"  # English rejected


@pytest.mark.parametrize("content,choices", [
    ("not-json", 1),
    ("{}", 1),
    (json.dumps(GOOD), 2),
    (json.dumps({**GOOD, "headline": "extra"}), 1),
    (json.dumps({"insights": []}), 1),
    ("é" * 9000, 1),
], ids=["invalid-json", "empty-object", "two-choices", "extra-key", "no-insights", "oversize"])
def test_malformed_provider_output_uses_template_copy(monkeypatch, content: str, choices: int) -> None:
    report, _ = _generate(monkeypatch, content, choices=choices)
    assert report.generation_source == "fallback"
    assert report.newsletter.insights[0].title == "A bigger week than usual"


def test_missing_key_never_builds_a_client(monkeypatch, caplog) -> None:
    def no_client(**_kwargs):
        raise AssertionError("client must not be constructed")

    monkeypatch.setattr(cerebras_narrator, "AsyncCerebras", no_client)
    narrator = CerebrasReportNarrator(api_key=None, model=MODEL)
    with caplog.at_level(logging.INFO, logger="smartcart.cerebras_narrator"):
        report = asyncio.run(generate_report(_payload(), AFTER_WEEK, narrator))
    assert report.generation_source == "fallback"
    assert any(getattr(record, "reason_code", None) == "missing_api_key" for record in caplog.records)


def test_provider_errors_fall_back(monkeypatch) -> None:
    report, _ = _generate(monkeypatch, error=RuntimeError("boom"))
    assert report.generation_source == "fallback"
    assert [insight.kind for insight in report.newsletter.insights][:2] == ["spending_vs_usual", "price_rises"]
