"""Stateless deterministic report assembly and the async narrator seam."""

from __future__ import annotations

from copy import deepcopy
from contextvars import ContextVar
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Mapping, Protocol

from fastapi import Request

from .period_analytics import period_analytics
from .report_insights import (
    Finding,
    baseline_start,
    build_findings,
    default_headline,
    render,
)
from .report_models import (
    GenerateReportRequest,
    GeneratedReport,
    ReportCategorySpending,
    ReportComparisonSnapshot,
    ReportInsight,
    ReportInsightEvidence,
    ReportNewsletter,
    ReportSpecificCategorySpending,
    ReportSpendingClassAmount,
    format_report_instant,
    parse_report_instant,
)


SPENDING_CLASS_ORDER = ("essential", "discretionary", "mixed_or_unknown")

report_request_id: ContextVar[str | None] = ContextVar(
    "report_request_id", default=None
)


class ReportNarrator(Protocol):
    async def narrate(
        self, facts: Mapping[str, object]
    ) -> Mapping[str, object]: ...


class ReportRateLimitHook(Protocol):
    async def __call__(self, request: Request) -> bool | None: ...


class ReportRateLimitRejected(Exception):
    """Raised by the injected deployment-level report limiter."""


class ReportRequestRejected(Exception):
    """A safe, fixed-message report contract rejection."""


async def allow_report_generation(_request: Request) -> None:
    """Default deployment hook. Deployments can inject their own enforcement."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FallbackReportNarrator:
    """Deterministic copy: each finding's own localized template, unchanged."""

    async def narrate(
        self, facts: Mapping[str, object]
    ) -> Mapping[str, object]:
        findings = facts.get("findings")
        rows = findings if isinstance(findings, list) else []
        return {
            "insights": [
                {
                    "id": row["id"],
                    "title": row["fallback"]["title"],
                    "body": row["fallback"]["body"],
                    "action": row["fallback"]["action"],
                }
                for row in rows
                if isinstance(row, Mapping)
            ],
        }


def _validate_range_and_trips(
    payload: GenerateReportRequest, now: datetime
) -> tuple[datetime, datetime]:
    current_period = period_analytics([], payload.cadence, now)
    submitted_start = parse_report_instant(payload.period_start)
    submitted_end = parse_report_instant(payload.period_end)
    expected_report = next(
        (
            period
            for period in (current_period["current"], current_period["previous"])
            if (submitted_start, submitted_end)
            == (
                parse_report_instant(period["periodStart"]),
                parse_report_instant(period["periodEnd"]),
            )
        ),
        None,
    )
    if expected_report is None:
        raise ReportRequestRejected()

    expected_start = parse_report_instant(expected_report["periodStart"])
    expected_end = parse_report_instant(expected_report["periodEnd"])
    history_start = baseline_start(payload.cadence, expected_start)
    for trip in payload.trips:
        recorded_at = parse_report_instant(trip.recorded_at)
        if not history_start <= recorded_at < expected_end or recorded_at > now:
            raise ReportRequestRejected()
    return expected_start, expected_end


def _adapt_trips(payload: GenerateReportRequest) -> list[dict[str, object]]:
    """Adapt only the allowlisted bought snapshots to the accepted G3 shape."""
    records: list[dict[str, object]] = []
    for trip in payload.trips:
        savings = trip.estimated_savings
        records.append(
            {
                "recordedAt": trip.recorded_at,
                "lines": [
                    {
                        "status": "bought",
                        "name": line.name,
                        "category": {"id": line.category_id}
                        if line.category_id is not None
                        else None,
                        # G3's line calculator consumes unit price × actual
                        # quantity. The request's total is already authoritative,
                        # so adapt it as a single known total while retaining the
                        # submitted quantity snapshot in `quantity`.
                        "quantity": line.quantity,
                        "actualQuantity": 1,
                        "actualPriceRm": line.line_total_rm,
                        "unitPriceRm": None,
                    }
                    for line in trip.bought_lines
                ],
                "estimatedSavings": None
                if savings is None
                else {
                    "storeChoiceImpactRm": savings.store_choice_impact_rm,
                    "itemChangeImpactRm": savings.item_change_impact_rm,
                    "netSavingRm": savings.net_saving_rm,
                },
            }
        )
    return records


def _category_spending(
    metrics: Mapping[str, object],
) -> list[ReportCategorySpending]:
    return [
        ReportCategorySpending.model_validate(item)
        for item in metrics["categoryTotals"]  # type: ignore[index]
    ]


def _specific_category_spending(
    payload: GenerateReportRequest,
    start_value: object,
    end_value: object,
) -> list[ReportSpecificCategorySpending]:
    """Aggregate precise catalogue categories from the submitted trip snapshots."""
    start = parse_report_instant(start_value)
    end = parse_report_instant(end_value)
    totals: dict[str, tuple[str, str, int]] = {}
    missing_price = False
    for trip in payload.trips:
        recorded_at = parse_report_instant(trip.recorded_at)
        if not start <= recorded_at < end:
            continue
        for line in trip.bought_lines:
            if line.line_total_rm is None:
                missing_price = True
                continue
            category = line.source_category
            category_id = category.id if category else "uncategorised"
            label_en = category.label_en if category else "Uncategorised"
            label_ms = category.label_ms if category else "Tidak dikategorikan"
            try:
                cents = int(
                    (Decimal(str(line.line_total_rm)) * 100).quantize(
                        Decimal("1"), rounding=ROUND_HALF_UP
                    )
                )
            except (ArithmeticError, ValueError):
                missing_price = True
                continue
            prior_en, prior_ms, prior_cents = totals.get(
                category_id, (label_en, label_ms, 0)
            )
            totals[category_id] = (prior_en, prior_ms, prior_cents + cents)

    values = [
        ReportSpecificCategorySpending(
            category_id=category_id,
            label_en=label_en,
            label_ms=label_ms,
            amount_rm=0.0 if cents == 0 else cents / 100,
            partial=missing_price,
        )
        for category_id, (label_en, label_ms, cents) in totals.items()
    ]
    values.sort(key=lambda item: (-item.amount_rm, item.category_id))
    return values


def _class_breakdown(
    metrics: Mapping[str, object],
) -> list[ReportSpendingClassAmount]:
    totals = metrics["spendingClassTotals"]  # type: ignore[index]
    return [
        ReportSpendingClassAmount(
            spending_class=spending_class,
            amount_rm=totals[spending_class],  # type: ignore[index]
        )
        for spending_class in SPENDING_CLASS_ORDER
    ]


def _savings_amount(metrics: Mapping[str, object], key: str) -> float | None:
    savings = metrics["savings"]  # type: ignore[index]
    item = savings[key]  # type: ignore[index]
    return item["amountRm"]  # type: ignore[index,return-value]


def _savings_incomplete(metrics: Mapping[str, object]) -> bool:
    savings = metrics["savings"]  # type: ignore[index]
    return bool(savings["incomplete"])  # type: ignore[index]


def _disclosures(
    locale: str,
    metrics: Mapping[str, object],
) -> list[str]:
    disclosures: list[str] = []
    missing_prices = int(metrics["missingPriceCount"])
    savings = metrics["savings"]  # type: ignore[index]
    savings_available = bool(savings["available"])  # type: ignore[index]
    incomplete_savings = bool(savings["incomplete"])  # type: ignore[index]

    if missing_prices:
        if locale == "en":
            noun = "item" if missing_prices == 1 else "items"
            verb = "is" if missing_prices == 1 else "are"
            disclosures.append(
                f"{missing_prices} bought {noun} {verb} missing a confirmed line total; "
                "confirmed spending excludes them."
            )
        else:
            disclosures.append(
                f"{missing_prices} item yang dibeli tiada jumlah baris yang disahkan; "
                "perbelanjaan disahkan tidak termasuk item tersebut."
            )

    if incomplete_savings:
        disclosures.append(
            "Estimated savings are incomplete because one or more trips lack a usable "
            "saved savings value."
            if locale == "en"
            else "Anggaran penjimatan tidak lengkap kerana satu atau lebih perjalanan "
            "tiada nilai penjimatan tersimpan yang boleh digunakan."
        )
    elif not savings_available:
        disclosures.append(
            "Estimated savings are unavailable because no usable saved savings values "
            "were provided."
            if locale == "en"
            else "Anggaran penjimatan tidak tersedia kerana tiada nilai penjimatan "
            "tersimpan yang boleh digunakan."
        )
    return disclosures


def _comparison_snapshot(
    metrics: Mapping[str, object],
    specific_category_spending: list[ReportSpecificCategorySpending],
) -> ReportComparisonSnapshot:
    return ReportComparisonSnapshot(
        period_start=metrics["periodStart"],  # type: ignore[arg-type]
        period_end=metrics["periodEnd"],  # type: ignore[arg-type]
        trip_count=metrics["tripCount"],  # type: ignore[arg-type]
        actual_spending_rm=metrics["actualSpendingRm"],  # type: ignore[arg-type]
        spending_incomplete=metrics["spendingIncomplete"],  # type: ignore[arg-type]
        estimated_net_savings_rm=_savings_amount(metrics, "netSaving"),
        store_choice_impact_rm=_savings_amount(metrics, "storeChoiceImpact"),
        item_change_impact_rm=_savings_amount(metrics, "itemChangeImpact"),
        savings_incomplete=_savings_incomplete(metrics),
        category_spending=_category_spending(metrics),
        specific_category_spending=specific_category_spending,
        spending_class_breakdown=_class_breakdown(metrics),
    )


def _finding_facts(finding: Finding, locale: str) -> dict[str, object]:
    copy = finding.copy[locale]
    return {
        "id": finding.id,
        "kind": finding.kind,
        "direction": finding.direction,
        "estimate": finding.estimate,
        "values": dict(finding.values),
        "fallback": {"title": copy.title, "body": copy.body, "action": copy.action},
    }


def _narrative_facts(
    payload: GenerateReportRequest,
    current: Mapping[str, object],
    findings: list[Finding],
    default_headline_text: str,
    in_progress: bool,
) -> dict[str, object]:
    """Findings and headline totals: the complete source of facts for prose."""
    return deepcopy(
        {
            "locale": payload.locale,
            "cadence": payload.cadence,
            "periodStart": current["periodStart"],
            "periodEnd": current["periodEnd"],
            "periodInProgress": in_progress,
            "tripCount": current["tripCount"],
            "findings": [_finding_facts(finding, payload.locale) for finding in findings],
            "defaultHeadline": default_headline_text,
        }
    )


_LEFTOVER_BRACES = re.compile(r"\{\{|\}\}")


def _render_text(value: object, values: Mapping[str, str], limit: int) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        text = " ".join(render(value, values).split())
    except KeyError:
        return None
    if _LEFTOVER_BRACES.search(text) or len(text) > limit:
        return None
    return text


def _insight(
    finding: Finding, candidate: Mapping[str, object] | None, locale: str
) -> tuple[ReportInsight, bool]:
    """Render the narrator's copy for one finding, or that finding's own copy."""
    fallback = finding.copy[locale]
    title = body = None
    action: str | None = None
    used_candidate = False
    if candidate is not None:
        title = _render_text(candidate.get("title"), finding.values, 90)
        body = _render_text(candidate.get("body"), finding.values, 700)
        raw_action = candidate.get("action")
        action = None if raw_action is None else _render_text(raw_action, finding.values, 300)
        used_candidate = (
            title is not None
            and body is not None
            and (raw_action is None or action is not None)
        )
    if not used_candidate:
        title = render(fallback.title, finding.values)
        body = render(fallback.body, finding.values)
        action = None if fallback.action is None else render(fallback.action, finding.values)
    evidence = (
        ReportInsightEvidence(
            label=finding.evidence_label[locale], value=finding.evidence_value
        )
        if finding.evidence_label is not None and finding.evidence_value is not None
        else None
    )
    return ReportInsight(
        kind=finding.kind,  # type: ignore[arg-type]
        title=title,  # type: ignore[arg-type]
        body=body,  # type: ignore[arg-type]
        action=action,
        evidence=evidence,
    ), used_candidate


def _newsletter(
    narrated: Mapping[str, object],
    findings: list[Finding],
    payload: GenerateReportRequest,
    default_headline_text: str,
) -> tuple[ReportNewsletter, bool]:
    """Merge narrator output finding by finding; one bad insight never sinks the rest."""
    locale = payload.locale
    raw_insights = narrated.get("insights")
    candidates = {
        item.get("id"): item
        for item in (raw_insights if isinstance(raw_insights, list) else [])
        if isinstance(item, Mapping)
    }
    insights: list[ReportInsight] = []
    any_candidate = False
    for finding in findings:
        candidate = candidates.get(finding.id)
        insight, used = _insight(
            finding, candidate if isinstance(candidate, Mapping) else None, locale
        )
        insights.append(insight)
        any_candidate = any_candidate or used
    # The headline is always the application's own sentence: a single line that
    # mixes several findings' figures is where narrated numbers got misattributed.
    headline = default_headline_text
    subject = (
        f"Your {payload.cadence} shopping report"
        if locale == "en"
        else f"Laporan membeli-belah {'mingguan' if payload.cadence == 'weekly' else 'bulanan'} anda"
    )
    preview = re.split(r"(?<=[.!?])\s+", headline, maxsplit=1)[0].strip()
    if len(preview) > 220:
        preview = preview[:217].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
    return ReportNewsletter(
        subject=subject, preview=preview, headline=headline, insights=insights
    ), any_candidate


async def generate_report(
    payload: GenerateReportRequest,
    now: datetime,
    narrator: ReportNarrator,
) -> GeneratedReport:
    """Recompute both periods and return one complete, non-persisted report."""
    now_utc = now.astimezone(timezone.utc)
    start, end = _validate_range_and_trips(payload, now_utc)
    metrics = period_analytics(
        _adapt_trips(payload), payload.cadence, format_report_instant(start)
    )
    current = metrics["current"]
    previous = metrics["previous"]
    disclosures = _disclosures(payload.locale, current)
    specific_category_spending = _specific_category_spending(
        payload, current["periodStart"], current["periodEnd"]
    )
    previous_specific_category_spending = _specific_category_spending(
        payload, previous["periodStart"], previous["periodEnd"]
    )
    comparison = (
        _comparison_snapshot(previous, previous_specific_category_spending)
        if previous["tripCount"] > 0
        else None
    )
    findings, current_period, baseline = build_findings(payload, start, now_utc)
    default_headline_text = default_headline(
        findings, current_period, baseline, payload.cadence, payload.locale
    )
    facts = _narrative_facts(
        payload, current, findings, default_headline_text, now_utc < end
    )
    try:
        narrated = await narrator.narrate(facts)
        newsletter, used_llm = _newsletter(
            narrated, findings, payload, default_headline_text
        )
        claimed_source = getattr(narrated, "generation_source", "fallback")
        generation_source = (
            "llm" if claimed_source == "llm" and used_llm else "fallback"
        )
    except Exception:
        narrated = await FallbackReportNarrator().narrate(facts)
        newsletter, _ = _newsletter(narrated, findings, payload, default_headline_text)
        generation_source = "fallback"

    return GeneratedReport(
        id=f"{payload.cadence}:{format_report_instant(start)}",
        cadence=payload.cadence,
        period_start=format_report_instant(start),
        period_end=format_report_instant(end),
        generated_at=format_report_instant(now_utc),
        trip_count=current["tripCount"],
        actual_spending_rm=current["actualSpendingRm"],
        spending_incomplete=current["spendingIncomplete"],
        estimated_net_savings_rm=_savings_amount(current, "netSaving"),
        store_choice_impact_rm=_savings_amount(current, "storeChoiceImpact"),
        item_change_impact_rm=_savings_amount(current, "itemChangeImpact"),
        savings_incomplete=_savings_incomplete(current),
        category_spending=_category_spending(current),
        specific_category_spending=specific_category_spending,
        spending_class_breakdown=_class_breakdown(current),
        comparison=comparison,
        newsletter=newsletter,
        disclosures=disclosures,
        generation_source=generation_source,
    )
