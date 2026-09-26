"""Stateless deterministic report assembly and the async narrator seam."""

from __future__ import annotations

from copy import deepcopy
from contextvars import ContextVar
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Mapping, Protocol

from fastapi import Request

from .categories import CATEGORIES_BY_ID
from .period_analytics import period_analytics
from .report_models import (
    GenerateReportRequest,
    GeneratedReport,
    ReportCategorySpending,
    ReportComparisonSnapshot,
    ReportNewsletter,
    ReportSpecificCategorySpending,
    ReportSection,
    ReportSpendingClassAmount,
    format_report_instant,
    parse_report_instant,
)


SPENDING_CLASS_ORDER = ("essential", "discretionary", "mixed_or_unknown")
SECTION_BINDINGS = (
    ("overview", "overview-kpis"),
    ("categories", "category-pie"),
    ("savings", "savings-breakdown"),
    ("essentials", "spending-class-bar"),
)

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
    """Localized, fact-grounded copy for periods without accepted LLM prose."""

    _COPY = {
        "en": {
            "overview": (
                "Spending overview",
                "Confirmed spending includes bought items with known line totals.",
            ),
            "categories": (
                "Category spending",
                "Priced bought items are grouped by their broad shopping category.",
            ),
            "savings": (
                "Estimated savings",
                "Savings figures are estimates based on saved comparison snapshots.",
            ),
            "essentials": (
                "Spending classes",
                "Items are grouped using SmartCart’s broad category classifications.",
            ),
        },
        "ms": {
            "overview": (
                "Ringkasan perbelanjaan",
                "Perbelanjaan disahkan merangkumi item dibeli yang mempunyai jumlah baris.",
            ),
            "categories": (
                "Perbelanjaan mengikut kategori",
                "Item dibeli yang berharga dikumpulkan mengikut kategori umum membeli-belah.",
            ),
            "savings": (
                "Anggaran penjimatan",
                "Angka penjimatan ialah anggaran berdasarkan rekod perbandingan tersimpan.",
            ),
            "essentials": (
                "Kelas perbelanjaan",
                "Item dikumpulkan menggunakan pengelasan kategori umum SmartCart.",
            ),
        },
    }

    async def narrate(
        self, facts: Mapping[str, object]
    ) -> Mapping[str, object]:
        locale = facts.get("locale")
        language = locale if locale in self._COPY else "en"
        result: dict[str, object] = {
            key: {"heading": pair[0], "observation": pair[1]}
            for key, pair in self._COPY[language].items()
        }
        result["newsletter"] = _fallback_newsletter(facts, language)
        return result


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
    comparison_period = period_analytics(
        [], payload.cadence, expected_report["periodStart"]
    )["previous"]
    comparison_start = parse_report_instant(comparison_period["periodStart"])
    for trip in payload.trips:
        recorded_at = parse_report_instant(trip.recorded_at)
        if not comparison_start <= recorded_at < expected_end or recorded_at > now:
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


def _broad_category_label(row: Mapping[str, object] | None, locale: str) -> str | None:
    if row is None:
        return None
    category_id = row.get("categoryId")
    if category_id == "uncategorised":
        return "Tidak berkategori" if locale == "ms" else "Uncategorised"
    category = CATEGORIES_BY_ID.get(category_id) if isinstance(category_id, str) else None
    if category is None:
        return None
    return category.label_ms if locale == "ms" else category.label_en


def _fallback_newsletter(
    facts: Mapping[str, object], locale: str
) -> dict[str, object]:
    """Describe recorded behaviour when the provider cannot supply prose."""
    categories = facts.get("categorySpending")
    rows = categories if isinstance(categories, list) else []
    leading = rows[0] if rows and isinstance(rows[0], Mapping) else None
    runner_up = rows[1] if len(rows) > 1 and isinstance(rows[1], Mapping) else None
    leading_label = _broad_category_label(leading, locale)
    runner_up_label = _broad_category_label(runner_up, locale)
    has_activity = bool(facts.get("tripCount"))
    has_missing_prices = bool(facts.get("spendingIncomplete"))
    comparison = facts.get("comparison")
    previous = comparison if isinstance(comparison, Mapping) else None
    current_amount = facts.get("actualSpendingRm")
    previous_amount = previous.get("actualSpendingRm") if previous else None
    savings = facts.get("estimatedNetSavingsRm")
    savings_incomplete = bool(facts.get("savingsIncomplete"))

    if locale == "ms":
        if not has_activity:
            return {
                "subject": "Nota membeli-belah anda",
                "preview": "Tiada perjalanan direkodkan dalam tempoh ini.",
                "opening": "Tiada perjalanan membeli-belah direkodkan dalam tempoh ini. Oleh itu, tiada corak perbelanjaan atau anggaran penjimatan yang boleh dihuraikan dengan yakin.",
                "insights": [],
                "tip": None,
            }
        opening = (
            f"Perbelanjaan disahkan anda paling tertumpu pada {leading_label}. "
            "Huraian ini berdasarkan item dibeli yang mempunyai harga tersimpan."
            if isinstance(leading_label, str)
            else "Perjalanan anda direkodkan, tetapi belum ada jumlah kategori berharga untuk menunjukkan tumpuan perbelanjaan."
        )
        insights: list[dict[str, str]] = []
        if isinstance(leading_label, str):
            next_category = (
                f" {runner_up_label} ialah kategori seterusnya mengikut jumlah yang disahkan."
                if isinstance(runner_up_label, str) else ""
            )
            price_limit = (
                " Item tanpa harga tidak termasuk dalam jumlah ini, jadi bahagian sebenar mungkin berbeza."
                if has_missing_prices else ""
            )
            insights.append({
                "heading": "Tumpuan perbelanjaan",
                "body": f"{leading_label} mencatat jumlah tertinggi antara kategori dalam rekod anda.{next_category}{price_limit} Pecahan kategori dalam laporan ini menunjukkan jumlah yang disahkan bagi setiap kumpulan.",
            })
        if isinstance(current_amount, (int, float)) and isinstance(previous_amount, (int, float)):
            direction = (
                "lebih tinggi" if current_amount > previous_amount
                else "lebih rendah" if current_amount < previous_amount
                else "sama"
            )
            insights.append({
                "heading": "Perubahan dari tempoh sebelumnya",
                "body": f"Perbelanjaan disahkan adalah {direction} berbanding tempoh setara sebelumnya. Perubahan ini menggambarkan jumlah yang direkodkan sahaja; rekod tidak menunjukkan sebab anda membeli lebih atau kurang.",
            })
        if isinstance(savings, (int, float)):
            result = (
                "penjimatan bersih yang positif" if savings > 0
                else "anggaran penjimatan bersih yang negatif" if savings < 0
                else "anggaran penjimatan bersih yang seimbang"
            )
            limit = " Sebahagian nilai perjalanan tidak lengkap." if savings_incomplete else ""
            insights.append({
                "heading": "Hasil perbandingan tersimpan",
                "body": f"Perbandingan yang anda simpan menunjukkan {result}. Ini ialah anggaran berdasarkan pilihan kedai dan perubahan item, berasingan daripada perbelanjaan disahkan.{limit}",
            })
        tip = (
            f"Oleh sebab {leading_label} mempunyai jumlah disahkan tertinggi, membandingkan harga item dalam kategori ini mungkin paling berguna untuk perjalanan seterusnya."
            if isinstance(leading_label, str) and leading and leading.get("categoryId") != "uncategorised"
            else None
        )
        return {
            "subject": "Nota membeli-belah mingguan anda" if facts.get("cadence") == "weekly" else "Nota membeli-belah bulanan anda",
            "preview": "Corak pembelian dan perbelanjaan yang direkodkan.",
            "opening": opening,
            "insights": insights[:3],
            "tip": tip,
        }

    if not has_activity:
        return {
            "subject": "Your shopping note",
            "preview": "No trips were recorded for this period.",
            "opening": "No shopping trips were recorded this period, so there is no spending pattern or savings estimate to describe with confidence.",
            "insights": [],
            "tip": None,
        }
    opening = (
        f"Your confirmed spending was concentrated most in {leading_label}. "
        "That view comes from bought items with saved prices."
        if isinstance(leading_label, str)
        else "Your trips were recorded, but there are no priced category totals to show where spending was concentrated."
    )
    insights = []
    if isinstance(leading_label, str):
        next_category = (
            f" {runner_up_label} followed by confirmed amount."
            if isinstance(runner_up_label, str) else ""
        )
        price_limit = (
            " Unpriced bought items are outside these totals, so the full mix may differ."
            if has_missing_prices else ""
        )
        insights.append({
            "heading": "Where spending concentrated",
            "body": f"{leading_label} had the largest confirmed total among your recorded categories.{next_category}{price_limit} The category breakdown in this report shows the confirmed amount for each group.",
        })
    if isinstance(current_amount, (int, float)) and isinstance(previous_amount, (int, float)):
        direction = (
            "higher" if current_amount > previous_amount
            else "lower" if current_amount < previous_amount
            else "the same"
        )
        insights.append({
            "heading": "Change from the previous period",
            "body": f"Confirmed spending was {direction} than in the previous equivalent period. This describes the recorded amounts; the trips do not establish why your shopping changed.",
        })
    if isinstance(savings, (int, float)):
        result = (
            "positive estimated net savings" if savings > 0
            else "negative estimated net savings" if savings < 0
            else "an estimated net result of zero"
        )
        limit = " Some trip estimates are incomplete." if savings_incomplete else ""
        insights.append({
            "heading": "What the saved comparisons suggest",
            "body": f"Your saved comparisons point to {result}. These are estimates connected to store choice and item changes, separate from confirmed spending.{limit}",
        })
    tip = (
        f"Because {leading_label} had your largest confirmed category total, comparing prices for those items may have the most impact on your next trip."
        if isinstance(leading_label, str) and leading and leading.get("categoryId") != "uncategorised"
        else None
    )
    return {
        "subject": "Your weekly shopping note" if facts.get("cadence") == "weekly" else "Your monthly shopping note",
        "preview": "The shopping and spending patterns in your records.",
        "opening": opening,
        "insights": insights[:3],
        "tip": tip,
    }


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


def _narrative_facts(
    payload: GenerateReportRequest,
    current: Mapping[str, object],
    comparison: ReportComparisonSnapshot | None,
    disclosures: list[str],
    specific_category_spending: list[ReportSpecificCategorySpending],
) -> dict[str, object]:
    """Return copied deterministic facts and current-period bought snapshots."""
    current_start = parse_report_instant(current["periodStart"])
    current_end = parse_report_instant(current["periodEnd"])
    bought_items: list[dict[str, object]] = []
    for trip in payload.trips:
        recorded_at = parse_report_instant(trip.recorded_at)
        if not current_start <= recorded_at < current_end:
            continue
        for line in trip.bought_lines:
            bought_items.append(
                {
                    "name": line.name,
                    "categoryId": line.category_id,
                    "sourceCategory": line.source_category.model_dump(by_alias=True)
                    if line.source_category is not None
                    else None,
                    "quantity": line.quantity,
                    "lineTotalRm": line.line_total_rm,
                    "missingPrice": line.line_total_rm is None,
                }
            )
    return deepcopy(
        {
            "locale": payload.locale,
            "cadence": payload.cadence,
            "periodStart": current["periodStart"],
            "periodEnd": current["periodEnd"],
            "tripCount": current["tripCount"],
            "boughtItems": bought_items,
            "actualSpendingRm": current["actualSpendingRm"],
            "spendingIncomplete": current["spendingIncomplete"],
            "estimatedNetSavingsRm": _savings_amount(current, "netSaving"),
            "storeChoiceImpactRm": _savings_amount(current, "storeChoiceImpact"),
            "itemChangeImpactRm": _savings_amount(current, "itemChangeImpact"),
            "savingsIncomplete": _savings_incomplete(current),
            "categorySpending": [
                item.model_dump(by_alias=True)
                for item in _category_spending(current)
            ],
            "specificCategorySpending": [
                item.model_dump(by_alias=True)
                for item in specific_category_spending
            ],
            "spendingClassBreakdown": [
                item.model_dump(by_alias=True)
                for item in _class_breakdown(current)
            ],
            "comparison": comparison.model_dump(by_alias=True)
            if comparison is not None
            else None,
            "disclosures": list(disclosures),
        }
    )


def _narrative_sections(
    pairs: Mapping[str, object],
) -> tuple[ReportSection, ReportSection, ReportSection, ReportSection]:
    expected_keys = {key for key, _ in SECTION_BINDINGS}
    if set(pairs) != expected_keys | {"newsletter"}:
        raise ValueError("invalid narrative keys")
    sections: list[ReportSection] = []
    for section_id, visualization in SECTION_BINDINGS:
        pair = pairs[section_id]
        if not isinstance(pair, Mapping) or set(pair) != {"heading", "observation"}:
            raise ValueError("invalid narrative pair")
        if not all(isinstance(pair[key], str) for key in ("heading", "observation")):
            raise ValueError("invalid narrative prose")
        sections.append(
            ReportSection(
                id=section_id,
                heading=pair["heading"],
                observation=pair["observation"],
                visualization=visualization,
            )
        )
    return tuple(sections)  # type: ignore[return-value]


def _activity_summary(facts: Mapping[str, object], locale: str) -> str | None:
    """Select recorded purchases for app-owned prose, including numbered product names."""
    source_items = facts.get("boughtItems")
    items = source_items if isinstance(source_items, list) else []
    ranked = sorted(
        (item for item in items if isinstance(item, Mapping)),
        key=lambda item: (
            item.get("lineTotalRm") is not None,
            item.get("lineTotalRm") or 0,
        ),
        reverse=True,
    )
    names: list[str] = []
    seen: set[str] = set()
    for item in ranked:
        raw_name = item.get("name")
        if not isinstance(raw_name, str):
            continue
        name = " ".join(raw_name.split()).strip()
        if len(name) > 60:
            name = name[:57].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
        if not name or name.casefold() in seen:
            continue
        names.append(name)
        seen.add(name.casefold())
        if len(names) == 4:
            break
    if names:
        connector = " dan " if locale == "ms" else " and "
        joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + connector + names[-1]
        return (
            f"Antara item yang anda beli ialah {joined}."
            if locale == "ms"
            else f"Your recorded purchases included {joined}."
        )
    if facts.get("tripCount"):
        return (
            "Perjalanan direkodkan, tetapi tiada item dibeli yang disimpan."
            if locale == "ms"
            else "You recorded a shopping trip, but no bought items were saved."
        )
    return None


def _tip_anchors(facts: Mapping[str, object], locale: str) -> tuple[str, ...]:
    """A future suggestion must mention a real bought item or broad category."""
    anchors: list[str] = []
    categories = facts.get("categorySpending")
    for row in categories if isinstance(categories, list) else []:
        if not isinstance(row, Mapping) or row.get("categoryId") in {"uncategorised", "other"}:
            continue
        label = _broad_category_label(row, locale)
        if isinstance(label, str) and len(label.strip()) >= 4:
            anchors.append(label.strip().casefold())
    source_items = facts.get("boughtItems")
    for item in source_items if isinstance(source_items, list) else []:
        if not isinstance(item, Mapping):
            continue
        name = item.get("name")
        if isinstance(name, str) and len(name.strip()) >= 4:
            anchors.append(name.strip().casefold())
    return tuple(anchors)


_GENERIC_TIP = re.compile(
    r"\b(?:review (?:your|the) (?:usual )?(?:item )?list|"
    r"keep (?:a |your )?(?:short )?note|make (?:a |your )?list|"
    r"use (?:the )?app|semak senarai|catat(?:kan)?|nota ringkas|"
    r"senarai semak|gunakan aplikasi)\b",
    re.IGNORECASE,
)


def _narrative_newsletter(
    pairs: Mapping[str, object], cadence: str, locale: str,
    activity_summary: str | None, tip_anchors: tuple[str, ...],
) -> ReportNewsletter:
    value = pairs.get("newsletter")
    if not isinstance(value, Mapping):
        raise ValueError("invalid narrative newsletter")
    newsletter = ReportNewsletter.model_validate(value)
    subject = (
        f"Your {cadence} shopping report"
        if locale == "en"
        else f"Laporan membeli-belah {'mingguan' if cadence == 'weekly' else 'bulanan'} anda"
    )
    opening = newsletter.opening
    if activity_summary:
        allowed = 1200 - len(activity_summary) - 1
        if len(opening) > allowed:
            opening = opening[:allowed].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
        opening = f"{activity_summary} {opening}"
    source = activity_summary or (newsletter.insights[0].body if newsletter.insights else opening)
    preview = re.split(r"(?<=[.!?])\s+", source, maxsplit=1)[0].strip()
    if len(preview) > 220:
        clipped = preview[:217].rsplit(" ", 1)[0].rstrip(" ,;:")
        preview = f"{clipped}…"
    tip = newsletter.tip
    if tip is not None and (
        not any(anchor in tip.casefold() for anchor in tip_anchors)
        or _GENERIC_TIP.search(tip)
    ):
        tip = None
    return ReportNewsletter(
        subject=subject,
        preview=preview,
        opening=opening,
        insights=newsletter.insights,
        tip=tip,
    )


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
    facts = _narrative_facts(
        payload, current, comparison, disclosures, specific_category_spending
    )
    activity_summary = _activity_summary(facts, payload.locale)
    tip_anchors = _tip_anchors(facts, payload.locale)
    try:
        pairs = await narrator.narrate(facts)
        sections = _narrative_sections(pairs)
        newsletter = _narrative_newsletter(
            pairs, payload.cadence, payload.locale, activity_summary, tip_anchors
        )
        candidate_source = getattr(pairs, "generation_source", "fallback")
        generation_source = (
            candidate_source
            if candidate_source in {"llm", "fallback"}
            else "fallback"
        )
    except Exception:
        pairs = await FallbackReportNarrator().narrate(facts)
        sections = _narrative_sections(pairs)
        newsletter = _narrative_newsletter(
            pairs, payload.cadence, payload.locale, activity_summary, tip_anchors
        )
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
        sections=sections,
        disclosures=disclosures,
        generation_source=generation_source,
    )
