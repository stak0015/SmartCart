"""Deterministic insight detectors compare a period with the shopper's own baseline."""

from __future__ import annotations

from datetime import timedelta

import pytest

from smartcart.report_insights import build_findings, default_headline, placeholders, render
from report_builders import AFTER_WEEK, WEEK_START, line, request, trip, weekly_history


def _findings(trips, now=AFTER_WEEK, **kwargs):
    payload = request(trips, **kwargs)
    findings, _, _ = build_findings(payload, WEEK_START, now)
    return {finding.kind: finding for finding in findings}, findings


def _copy(finding, locale="en"):
    copy = finding.copy[locale]
    return render(copy.body, finding.values), None if copy.action is None else render(copy.action, finding.values)


def test_spending_well_above_the_usual_week_names_the_driving_category() -> None:
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 14.0, key="1001"),
        line("Grade A Eggs", 12.0, key="1002"),
        line("Fresh Milk", 7.0, key="1003", category="drinks-milk"),
        line("Potato Chips", 30.0, key="2001", category="snacks-convenience"),
    ])
    by_kind, _ = _findings([*weekly_history(), current])
    finding = by_kind["spending_vs_usual"]
    body, action = _copy(finding)
    assert finding.direction == "higher"
    assert finding.evidence_value == "+RM30.00"
    assert "RM63.00" in body and "RM33.00" in body
    assert "Snacks & Convenience Foods" in body
    assert action is not None and "Snacks & Convenience Foods" in action


def test_a_lower_period_still_in_progress_is_not_reported_as_a_drop() -> None:
    current = trip(WEEK_START + timedelta(days=1), [line("Fresh Milk", 7.0, key="1003", category="drinks-milk")])
    by_kind, _ = _findings([*weekly_history(), current], now=WEEK_START + timedelta(days=2))
    assert "spending_vs_usual" not in by_kind


def test_price_rises_compare_unit_prices_and_point_to_a_cheaper_past_store() -> None:
    history = weekly_history()
    history[0]["storeName"] = "Mydin Mutiara"
    history[0]["boughtLines"][0] = line("Chicken Breast Fillet", 12.5, key="1001")
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 34.0, key="1001", quantity=2),
        line("Grade A Eggs", 12.0, key="1002"),
    ], store="Jaya Grocer Sunway")
    by_kind, _ = _findings([*history, current])
    finding = by_kind["price_rises"]
    body, action = _copy(finding)
    assert "RM17.00" in body and "RM14.00" in body and "21%" in body
    assert finding.evidence_value == "+21%"
    # The store is never stated as the cause; the tip points to where it was cheaper.
    assert "Jaya Grocer Sunway" not in body
    assert action == "You have paid RM12.50 for Chicken Breast Fillet at Mydin Mutiara before, so checking there on your next trip could save you money."


def test_items_bought_most_weeks_but_missing_now_are_flagged_as_due() -> None:
    current = trip(WEEK_START + timedelta(days=2), [line("Chicken Breast Fillet", 14.0, key="1001")])
    by_kind, _ = _findings([*weekly_history(), current])
    body, action = _copy(by_kind["items_due"])
    assert "Grade A Eggs" in body and "Fresh Milk" in body
    assert action == "Adding them to your next basket saves a separate trip later."


def test_monthly_reports_do_not_run_the_weekly_items_due_detector() -> None:
    month_start = WEEK_START.replace(day=30, month=9)  # 1 Oct 2026 local
    current = trip(month_start + timedelta(days=5), [line("Chicken Breast Fillet", 14.0, key="1001")])
    payload = request([*weekly_history(), current], cadence="monthly", start=month_start,
                      end=month_start + timedelta(days=31))
    findings, _, _ = build_findings(payload, month_start, month_start + timedelta(days=32))
    assert all(finding.kind != "items_due" for finding in findings)


def test_store_choice_needs_a_material_estimated_gap_and_says_estimated() -> None:
    small_gap = trip(WEEK_START + timedelta(days=1), [line("Chicken Breast Fillet", 14.0, key="1001")],
                     planned=40.0, alternative=("Mydin Mutiara", 39.0))
    by_kind, _ = _findings([*weekly_history(), small_gap])
    assert "store_choice" not in by_kind

    big_gap = trip(WEEK_START + timedelta(days=1), [line("Chicken Breast Fillet", 14.0, key="1001")],
                   planned=40.0, alternative=("Mydin Mutiara", 34.5))
    by_kind, _ = _findings([*weekly_history(), big_gap])
    finding = by_kind["store_choice"]
    body, _ = _copy(finding)
    assert finding.estimate is True
    assert body == "For a basket like yours, Mydin Mutiara was estimated RM5.50 cheaper than Lotus's Cheras, including travel."
    assert finding.evidence_value == "RM5.50"


def test_one_small_top_up_trip_uses_singular_copy_in_both_languages() -> None:
    main = trip(WEEK_START + timedelta(days=1), [line("Chicken Breast Fillet", 40.0, key="1001")])
    top_up = trip(WEEK_START + timedelta(days=3), [line("Fresh Milk", 7.0, key="1003", category="drinks-milk")], travel=4.2)
    for locale, expected in (("en", "One of your 2 trips this week was a small top-up"), ("ms", "Satu daripada 2 perjalanan")):
        by_kind, _ = _findings([main, top_up], locale=locale)
        body, _ = _copy(by_kind["top_up_trips"], locale)
        assert body.startswith(expected)
        assert "RM4.20" in body


def test_items_skipped_on_three_trips_are_reported_once_current() -> None:
    history = weekly_history()
    for index in (0, 2):
        history[index]["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    current = trip(WEEK_START + timedelta(days=2), [line("Chicken Breast Fillet", 14.0, key="1001")])
    current["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    by_kind, _ = _findings([*history, current])
    body, _ = _copy(by_kind["repeat_skips"])
    assert body == "Bayam has been on your checklist for 3 recent trips without being picked up."


def test_sparse_history_uses_current_period_insights_and_says_what_unlocks_later() -> None:
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 14.0, key="1001"),
        line("Fresh Milk", 7.0, key="1003", category="drinks-milk"),
    ], travel=4.0)
    current["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    current["estimatedSavings"] = {"storeChoiceImpactRm": 2.0, "itemChangeImpactRm": 0.5, "netSavingRm": 2.5}
    payload = request([current])
    findings, period, baseline = build_findings(payload, WEEK_START, AFTER_WEEK)
    assert [finding.kind for finding in findings] == ["where_money_went", "savings_result", "travel_share", "getting_started"]
    body, _ = _copy(findings[0])
    assert body == "Meat, Seafood & Protein made up 67% of your spending this week (RM14.00). The item you spent most on was Chicken Breast Fillet, RM14.00 in total."
    savings, _ = _copy(findings[1])
    assert "estimate" in savings and "RM2.50 below" in savings and "+RM2.00" in savings
    assert default_headline(findings, period, baseline, "weekly", "en") == "Meat, Seafood & Protein took the biggest share of your spending."


def test_a_single_category_period_skips_the_breakdown_card() -> None:
    payload = request([trip(WEEK_START + timedelta(days=2), [line("Chicken Breast Fillet", 14.0, key="1001")], travel=None)])
    findings, period, baseline = build_findings(payload, WEEK_START, AFTER_WEEK)
    assert [finding.kind for finding in findings] == ["getting_started"]
    assert default_headline(findings, period, baseline, "weekly", "en") == (
        "You recorded 1 trip and spent RM14.00. There isn't enough history yet to spot patterns, so keep recording trips."
    )


def test_monthly_headline_leads_with_the_month_against_the_one_before() -> None:
    month_start = WEEK_START.replace(day=30, month=9)  # 1 Oct 2026 local
    september = trip(month_start - timedelta(days=10), [line("Chicken Breast Fillet", 50.0, key="1001")])
    october = [
        trip(month_start + timedelta(days=3), [line("Chicken Breast Fillet", 20.0, key="1001")], planned=24.0),
        trip(month_start + timedelta(days=12), [line("Fresh Milk", 9.0, key="1003", category="drinks-milk")], planned=12.0),
    ]
    for item, impact in zip(october, (1.5, -0.5)):
        item["estimatedSavings"] = {"storeChoiceImpactRm": impact, "itemChangeImpactRm": 0.0, "netSavingRm": impact}
    payload = request([september, *october], cadence="monthly", start=month_start, end=month_start + timedelta(days=31))
    findings, period, baseline = build_findings(payload, month_start, month_start + timedelta(days=32))
    store = next(finding for finding in findings if finding.kind == "store_record")
    body, _ = _copy(store)
    assert body.startswith("On 1 of your 2 trips you chose a store at or below the typical recommended cost.")
    headline = default_headline(findings, period, baseline, "monthly", "en")
    assert headline.startswith("In October you made 2 trips and spent RM29.00, RM21.00 less than in September. ")


def test_category_drops_need_to_be_large_but_rises_are_flagged_early() -> None:
    month_start = WEEK_START.replace(day=30, month=9)
    history = [
        trip(month_start - timedelta(days=offset), [
            line("Cooking Oil", 25.0, key="3001", category="cooking-ingredients"),
            line("Chicken Breast Fillet", 40.0, key="1001"),
        ]) for offset in (10, 40, 70)
    ]
    quiet = trip(month_start + timedelta(days=3), [line("Chicken Breast Fillet", 40.0, key="1001")])
    payload = request([*history, quiet], cadence="monthly", start=month_start, end=month_start + timedelta(days=31))
    findings, _, _ = build_findings(payload, month_start, month_start + timedelta(days=32))
    assert all(finding.kind != "category_shift" for finding in findings)  # RM25 skipped bulk buy

    snacks = trip(month_start + timedelta(days=3), [  # total stays near usual; snacks are new
        line("Chicken Breast Fillet", 40.0, key="1001"),
        line("Potato Chips", 20.0, key="2001", category="snacks-convenience"),
    ])
    payload = request([*history, snacks], cadence="monthly", start=month_start, end=month_start + timedelta(days=31))
    findings, _, _ = build_findings(payload, month_start, month_start + timedelta(days=32))
    shift = next(finding for finding in findings if finding.kind == "category_shift")
    assert shift.values["category_en"] == "Snacks & Convenience Foods" and shift.direction == "higher"


def test_a_look_ahead_card_survives_the_cap() -> None:
    history = weekly_history()
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 20.0, key="1001"),
        line("Potato Chips", 30.0, key="2001", category="snacks-convenience"),
    ], planned=60.0, alternative=("Mydin Mutiara", 50.0))
    top_up = trip(WEEK_START + timedelta(days=4), [line("Bread", 4.0, key="1004", category="staples")])
    payload = request([*history, current, top_up])
    findings, _, _ = build_findings(payload, WEEK_START, AFTER_WEEK)
    assert len(findings) == 4
    assert findings[-1].kind == "items_due"


@pytest.mark.parametrize("locale", ["en", "ms"])
def test_every_template_uses_only_its_own_values(locale: str) -> None:
    history = weekly_history()
    history[0]["skippedLines"] = history[2]["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 20.0, key="1001"),
        line("Potato Chips", 30.0, key="2001", category="snacks-convenience"),
    ], planned=60.0, alternative=("Mydin Mutiara", 50.0), skipped=["Bayam"])
    current["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    top_up = trip(WEEK_START + timedelta(days=4), [line("Fresh Milk", 7.0, key="1003", category="drinks-milk")])
    payload = request([*history, current, top_up], locale=locale)
    findings, _, _ = build_findings(payload, WEEK_START, AFTER_WEEK)
    assert len(findings) == 4  # the weekly cap
    for finding in findings:
        copy = finding.copy[locale]
        for template in (copy.title, copy.body, copy.action or "", finding.headline[locale]):
            assert placeholders(template) <= set(finding.values)


def test_template_copy_never_uses_negative_framing() -> None:
    """The report is a recommendations feature: the narrator's tone guard applies to our own copy too."""
    from smartcart.cerebras_narrator import _NEGATIVE_TONE

    month_start = WEEK_START.replace(day=30, month=9)
    scenarios = []
    history = weekly_history()
    history[0]["skippedLines"] = history[2]["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 20.0, key="1001"),
        line("Potato Chips", 30.0, key="2001", category="snacks-convenience"),
    ], planned=60.0, alternative=("Mydin Mutiara", 50.0), store="Jaya Grocer")
    current["skippedLines"] = [{"name": "Bayam", "itemKey": "1007"}]
    current["estimatedSavings"] = {"storeChoiceImpactRm": -2.0, "itemChangeImpactRm": 0.5, "netSavingRm": -1.5}
    top_up = trip(WEEK_START + timedelta(days=4), [line("Bread", 4.0, key="1004", category="staples")], travel=5.0)
    scenarios.append((request([*history, current, top_up]), WEEK_START, AFTER_WEEK))
    scenarios.append((request([current]), WEEK_START, AFTER_WEEK))
    monthly = [trip(month_start - timedelta(days=offset), [line("Chicken Breast Fillet", 40.0, key="1001")]) for offset in (10, 40, 70)]
    month_now = [trip(month_start + timedelta(days=d), [
        line("Chicken Breast Fillet", 40.0, key="1001"),
        line("Potato Chips", 25.0, key="2001", category="snacks-convenience"),
    ]) for d in (3, 12)]
    for item in month_now:
        item["estimatedSavings"] = {"storeChoiceImpactRm": -1.0, "itemChangeImpactRm": 0.0, "netSavingRm": -1.0}
    scenarios.append((request([*monthly, *month_now], cadence="monthly", start=month_start, end=month_start + timedelta(days=31)),
                      month_start, month_start + timedelta(days=32)))
    seen = set()
    for payload, start, now in scenarios:
        for locale in ("en", "ms"):
            findings, period, baseline = build_findings(payload.model_copy(update={"locale": locale}), start, now)
            for finding in findings:
                seen.add(finding.kind)
                copy = finding.copy[locale]
                for text in (copy.title, copy.body, copy.action or "", finding.headline[locale]):
                    assert not _NEGATIVE_TONE.search(render(text, finding.values)), (finding.kind, text)
            assert not _NEGATIVE_TONE.search(default_headline(findings, period, baseline, payload.cadence, locale))
    assert len(seen) >= 8
