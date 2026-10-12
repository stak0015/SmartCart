"""Deterministic shopping-behaviour findings for weekly and monthly reports.

Each detector compares the report period with the shopper's own baseline (the
preceding periods sent with the request) and returns a typed finding: the
numbers it rests on, pre-formatted display values, and localized fallback copy.
The narrator may rephrase findings, but every figure a shopper reads comes from
here, through ``{{placeholder}}`` substitution.

Owner: Shun
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
import re
from statistics import median
from typing import Literal, Mapping, Sequence

from .categories import CATEGORIES_BY_ID
from .period_analytics import MALAYSIA_TZ, _previous_range, _range_for
from .report_models import GenerateReportRequest, ReportTripInput, parse_report_instant


Locale = Literal["en", "ms"]
Cadence = Literal["weekly", "monthly"]

BASELINE_PERIODS: Mapping[str, int] = {"weekly": 8, "monthly": 3}
MAX_INSIGHTS: Mapping[str, int] = {"weekly": 4, "monthly": 4}
# Findings that look ahead to the next trip; one is always kept when found.
FORWARD_KINDS = frozenset({"items_due"})
MONTHS = {
    "en": ("January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December"),
    "ms": ("Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos",
           "September", "Oktober", "November", "Disember"),
}

_PLACEHOLDER = re.compile(r"\{\{([a-z][a-z0-9_]*)\}\}")


@dataclass(frozen=True)
class Copy:
    title: str
    body: str
    action: str | None = None


@dataclass
class Finding:
    kind: str
    priority: float
    values: dict[str, str]
    copy: Mapping[str, Copy]
    headline: Mapping[str, str]
    evidence_label: Mapping[str, str] | None = None
    evidence_value: str | None = None
    # Comparison direction the prose may mention ("higher"/"lower"); None forbids
    # comparative wording entirely.
    direction: str | None = None
    # Store and travel comparisons are estimates; prose must say so.
    estimate: bool = False
    id: str = ""
    facts: dict[str, object] = field(default_factory=dict)


def render(template: str, values: Mapping[str, str]) -> str:
    """Substitute known placeholders; unknown ones raise so bad copy never ships."""

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            raise KeyError(key)
        return values[key]

    return _PLACEHOLDER.sub(replace, template)


def placeholders(template: str) -> set[str]:
    return set(_PLACEHOLDER.findall(template))


# ---------------------------------------------------------------- formatting


def rm(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    value = Decimal(abs(cents)) / 100
    return f"{sign}RM{value:,.2f}"


def signed_rm(cents: int) -> str:
    return f"+{rm(cents)}" if cents > 0 else rm(cents) if cents < 0 else "RM0.00"


def pct(ratio: float) -> str:
    return f"{round(abs(ratio) * 100)}%"


def _cents(value: float | None) -> int | None:
    if value is None:
        return None
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _category_label(category_id: str | None, locale: Locale) -> str:
    if category_id is None or category_id not in CATEGORIES_BY_ID:
        return "Item lain" if locale == "ms" else "Other items"
    category = CATEGORIES_BY_ID[category_id]
    return category.label_ms if locale == "ms" else category.label_en


def _join(names: Sequence[str], locale: Locale) -> str:
    connector = " dan " if locale == "ms" else " and "
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + connector + names[-1]


def _clip_name(name: str) -> str:
    name = " ".join(name.split())
    return name if len(name) <= 48 else name[:45].rsplit(" ", 1)[0] + "…"


# ---------------------------------------------------------------- period model


@dataclass
class Line:
    key: str
    name: str
    category_id: str | None
    quantity: float
    total_cents: int | None
    unit_cents: int | None


@dataclass
class Trip:
    recorded_at: datetime
    store: str | None
    lines: list[Line]
    skipped: list[tuple[str, str]]  # (key, name)
    travel_cents: int | None
    planned_combined_cents: int | None
    cheapest_alternative: tuple[str, int] | None
    # Frozen estimate components: (store choice, item changes, net), in cents.
    savings: tuple[int | None, int | None, int | None] | None = None

    @property
    def priced_cents(self) -> int | None:
        totals = [line.total_cents for line in self.lines if line.total_cents is not None]
        return sum(totals) if totals else None


@dataclass
class Period:
    start: datetime
    end: datetime
    trips: list[Trip]

    @property
    def active(self) -> bool:
        return bool(self.trips)

    def spending_cents(self) -> int | None:
        totals = [trip.priced_cents for trip in self.trips if trip.priced_cents is not None]
        return sum(totals) if totals else None

    def category_cents(self) -> dict[str | None, int]:
        totals: dict[str | None, int] = defaultdict(int)
        for trip in self.trips:
            for line in trip.lines:
                if line.total_cents is not None:
                    totals[line.category_id] += line.total_cents
        return dict(totals)

    def keys(self) -> set[str]:
        return {line.key for trip in self.trips for line in trip.lines}


def item_key(name: str, key: str | None) -> str:
    return key if key else "name:" + " ".join(name.casefold().split())


def _trip(raw: ReportTripInput) -> Trip:
    lines: list[Line] = []
    for line in raw.bought_lines:
        total = _cents(line.line_total_rm)
        unit = _cents(line.unit_price_rm)
        if unit is None and total is not None and line.quantity > 0:
            unit = round(total / line.quantity)
        lines.append(Line(
            key=item_key(line.name, line.item_key),
            name=line.name,
            category_id=line.category_id,
            quantity=line.quantity,
            total_cents=total,
            unit_cents=unit,
        ))
    alternative = raw.cheapest_alternative
    alternative_cents = _cents(alternative.estimated_total_cost_rm) if alternative else None
    snapshot = raw.estimated_savings
    return Trip(
        recorded_at=parse_report_instant(raw.recorded_at),
        store=raw.store_name,
        lines=lines,
        skipped=[(item_key(line.name, line.item_key), line.name) for line in raw.skipped_lines],
        travel_cents=_cents(raw.estimated_round_trip_cost_rm),
        planned_combined_cents=_cents(raw.planned_combined_total_rm),
        cheapest_alternative=(alternative.name, alternative_cents)
        if alternative is not None and alternative_cents is not None else None,
        savings=None if snapshot is None else (
            _cents(snapshot.store_choice_impact_rm),
            _cents(snapshot.item_change_impact_rm),
            _cents(snapshot.net_saving_rm),
        ),
    )


def baseline_start(cadence: Cadence, period_start: datetime) -> datetime:
    current = _range_for(period_start, cadence)
    for _ in range(BASELINE_PERIODS[cadence]):
        current = _previous_range(current, cadence)
    return current[0]


def build_periods(payload: GenerateReportRequest, start: datetime) -> tuple[Period, list[Period]]:
    """Return the report period and its baseline periods, oldest first."""
    cadence: Cadence = payload.cadence
    trips = [_trip(trip) for trip in payload.trips]
    ranges = [_range_for(start, cadence)]
    for _ in range(BASELINE_PERIODS[cadence]):
        ranges.append(_previous_range(ranges[-1], cadence))
    periods = [
        Period(start=range_start, end=range_end, trips=sorted(
            (trip for trip in trips if range_start <= trip.recorded_at < range_end),
            key=lambda trip: trip.recorded_at,
        ))
        for range_start, range_end in ranges
    ]
    current, *baseline = periods
    return current, list(reversed(baseline))


# ---------------------------------------------------------------- copy helpers


def _noun(cadence: Cadence, locale: Locale) -> str:
    if locale == "ms":
        return "minggu" if cadence == "weekly" else "bulan"
    return "week" if cadence == "weekly" else "month"


# ---------------------------------------------------------------- detectors


def detect_spending_vs_usual(
    current: Period, baseline: list[Period], cadence: Cadence, in_progress: bool,
) -> Finding | None:
    """Period spending versus the median of earlier periods (needs 3 weeks or 2 months).
    Reported when the gap is at least RM10 and 15 %; a period still in progress is never
    reported as lower. Names the category behind the change when it explains at least 30
    %.
    """
    totals = [cents for period in baseline if (cents := period.spending_cents()) is not None]
    current_cents = current.spending_cents()
    if current_cents is None or len(totals) < (3 if cadence == "weekly" else 2):
        return None
    usual = int(median(totals))
    if usual <= 0:
        return None
    delta = current_cents - usual
    if in_progress and delta < 0:
        return None  # a period still in progress is naturally lower; say nothing
    if abs(delta) < max(1000, usual * 0.15):
        return None

    active = [period for period in baseline if period.spending_cents() is not None]
    average_by_category: dict[str | None, float] = defaultdict(float)
    for period in active:
        for category_id, cents in period.category_cents().items():
            average_by_category[category_id] += cents / len(active)
    current_categories = current.category_cents()
    category_deltas = {
        category_id: current_categories.get(category_id, 0) - average_by_category.get(category_id, 0)
        for category_id in set(current_categories) | set(average_by_category)
    }
    driver = max(
        (item for item in category_deltas.items() if (item[1] > 0) == (delta > 0)),
        key=lambda item: abs(item[1]),
        default=None,
    )
    higher = delta > 0
    values = {
        "amount": rm(current_cents),
        "usual": rm(usual),
        "difference": rm(abs(delta)),
        "share": pct(delta / usual),
        "period_count": str(len(totals)),
    }
    has_driver = driver is not None and abs(driver[1]) >= abs(delta) * 0.3
    if has_driver:
        values["driver_en"] = _category_label(driver[0], "en")
        values["driver_ms"] = _category_label(driver[0], "ms")
        values["driver_difference"] = rm(round(abs(driver[1])))

    driver_en = " Most of the difference was in {{driver_en}} ({{driver_difference}} " + ("more" if higher else "less") + " than usual)." if has_driver else ""
    driver_ms = " Kebanyakan perbezaan ialah pada {{driver_ms}} ({{driver_difference}} " + ("lebih" if higher else "kurang") + " daripada biasa)." if has_driver else ""
    so_far_en = " so far" if in_progress else ""
    so_far_ms = " setakat ini" if in_progress else ""
    noun_en, noun_ms = _noun(cadence, "en"), _noun(cadence, "ms")
    return Finding(
        kind="spending_vs_usual",
        facts={"driver": driver[0] if has_driver else None},
        priority=4 + min(abs(delta) / usual, 1.5) * 15,
        values=values,
        direction="higher" if higher else "lower",
        evidence_label={"en": f"vs your usual {noun_en}", "ms": f"berbanding {noun_ms} biasa"},
        evidence_value=signed_rm(delta),
        headline={
            "en": (f"{'So far this ' + noun_en + ' has' if in_progress else 'This was'} a bigger {noun_en} than usual, about {{{{difference}}}} above your usual {noun_en}." if higher else f"{'So far this ' + noun_en + ' you have' if in_progress else 'You'} spent about {{{{difference}}}} less than in a usual {noun_en}."),
            "ms": (f"{'Setakat ini, ' + noun_ms + ' ini' if in_progress else noun_ms.capitalize() + ' ini'} lebih besar daripada biasa, kira-kira {{{{difference}}}} melebihi {noun_ms} biasa anda." if higher else f"{'Setakat ini anda' if in_progress else 'Anda'} berbelanja kira-kira {{{{difference}}}} kurang daripada {noun_ms} biasa."),
        },
        copy={
            "en": Copy(
                title=f"A {'bigger' if higher else 'lighter'} {noun_en} than usual",
                body=f"You spent {{{{amount}}}}{so_far_en}, compared with a usual {noun_en} of about {{{{usual}}}} across your last {{{{period_count}}}} {noun_en}s with trips.{driver_en}",
                action=(f"Setting a planned amount for {{{{driver_en}}}} next {noun_en} is an easy way to stay close to your usual total." if higher and has_driver
                        else None),
            ),
            "ms": Copy(
                title=f"{noun_ms.capitalize()} yang {'lebih besar' if higher else 'lebih ringan'} daripada biasa",
                body=f"Anda berbelanja {{{{amount}}}}{so_far_ms}, berbanding {noun_ms} biasa kira-kira {{{{usual}}}} dalam {{{{period_count}}}} {noun_ms} terakhir yang mempunyai perjalanan.{driver_ms}",
                action=(f"Menetapkan amaun yang dirancang untuk {{{{driver_ms}}}} {noun_ms} depan ialah cara mudah untuk kekal hampir dengan jumlah biasa anda." if higher and has_driver
                        else None),
            ),
        },
    )


def _history_unit_prices(baseline: list[Period]) -> dict[str, list[tuple[int, str | None]]]:
    prices: dict[str, list[tuple[int, str | None]]] = defaultdict(list)
    for period in baseline:
        for trip in period.trips:
            for line in trip.lines:
                if line.unit_cents is not None and line.unit_cents > 0:
                    prices[line.key].append((line.unit_cents, trip.store))
    return prices


def detect_price_changes(current: Period, baseline: list[Period]) -> list[Finding]:
    """Unit-price rises and drops of at least 30 sen and 8 % against the item's median in
    earlier periods (needs two earlier prices). Returns at most one rise finding (summing
    the top three items) and one drop finding (the largest drop).
    """
    history = _history_unit_prices(baseline)
    rises: list[tuple[int, Line, int, int, str | None]] = []
    drops: list[tuple[int, Line, int, int, str | None]] = []
    seen: set[str] = set()
    for trip in current.trips:
        for line in trip.lines:
            if line.key in seen or line.unit_cents is None or len(history.get(line.key, [])) < 2:
                continue
            seen.add(line.key)
            usual = int(median(price for price, _ in history[line.key]))
            change = line.unit_cents - usual
            if usual <= 0 or abs(change) < 30 or abs(change) / usual < 0.08:
                continue
            impact = round(change * line.quantity)
            (rises if change > 0 else drops).append((impact, line, usual, change, trip.store))

    findings: list[Finding] = []
    if rises:
        rises.sort(key=lambda item: -item[0])
        top = rises[:3]
        impact = sum(item[0] for item in top)
        first_impact, first, first_usual, first_change, first_store = top[0]
        values = {
            "item": _clip_name(first.name),
            "price": rm(first.unit_cents or 0),
            "usual_price": rm(first_usual),
            "change": pct(first_change / first_usual),
            "extra": rm(impact),
        }
        others = [_clip_name(item[1].name) for item in top[1:]]
        for index, name in enumerate(others, start=1):
            values[f"other{index}"] = name
        others_en = (" " + _join([f"{{{{other{i}}}}}" for i in range(1, len(others) + 1)], "en") + " are also priced higher than usual right now.") if others else ""
        others_ms = (" " + _join([f"{{{{other{i}}}}}" for i in range(1, len(others) + 1)], "ms") + " juga berharga lebih tinggi daripada biasa sekarang.") if others else ""
        usual_stores = {store for _, store in history[first.key] if store}
        unusual_store = bool(first_store) and first_store not in usual_stores
        if unusual_store:
            values["store"] = first_store  # type: ignore[assignment]
        # Point at a store where the shopper has paid less for the lead item before.
        cheaper = [
            (price, store) for price, store in history[first.key]
            if store and store != first_store and price <= first_usual
        ]
        action_en = action_ms = None
        if cheaper:
            best_price, best_store = min(cheaper)
            values["cheaper_store"] = best_store
            values["cheaper_price"] = rm(best_price)
            action_en = "You have paid {{cheaper_price}} for {{item}} at {{cheaper_store}} before, so checking there on your next trip could save you money."
            action_ms = "Anda pernah membayar {{cheaper_price}} untuk {{item}} di {{cheaper_store}}, jadi menyemak di sana pada perjalanan seterusnya boleh membantu anda berjimat."
        elif unusual_store:
            action_en = "These were bought at {{store}} this time; comparing with the store you usually use may find you a better price."
            action_ms = "Item ini dibeli di {{store}} kali ini; membandingkan dengan kedai biasa anda mungkin memberi harga yang lebih baik."
        findings.append(Finding(
            kind="price_rises",
            priority=3 + impact / 100 * 0.8,
            values=values,
            direction="higher",
            evidence_label={"en": "price change on your regulars", "ms": "perubahan harga item biasa"},
            evidence_value="+" + values["change"],
            headline={
                "en": "A few of your regular items are priced higher right now, so it is worth comparing before your next trip.",
                "ms": "Beberapa item biasa anda berharga lebih tinggi sekarang, jadi elok dibandingkan sebelum perjalanan seterusnya.",
            },
            copy={
                "en": Copy(
                    title="Prices to watch on your regulars",
                    body="{{item}} was {{price}} this time, compared with the {{usual_price}} you usually pay ({{change}} higher)." + others_en,
                    action=action_en,
                ),
                "ms": Copy(
                    title="Harga untuk diperhatikan pada item biasa",
                    body="{{item}} berharga {{price}} kali ini, berbanding {{usual_price}} yang biasa anda bayar ({{change}} lebih tinggi)." + others_ms,
                    action=action_ms,
                ),
            },
            facts={"items": [item[1].name for item in top]},
        ))
    if drops:
        drops.sort(key=lambda item: item[0])
        impact, line, usual, change, store = drops[0]
        values = {
            "item": _clip_name(line.name),
            "price": rm(line.unit_cents or 0),
            "usual_price": rm(usual),
            "change": pct(change / usual),
            "store": store or "",
        }
        where_en = " at {{store}}" if store else ""
        where_ms = " di {{store}}" if store else ""
        findings.append(Finding(
            kind="price_drops",
            priority=1.5 + abs(impact) / 100,
            values=values,
            direction="lower",
            evidence_label={"en": "below your usual price", "ms": "di bawah harga biasa"},
            evidence_value="−" + values["change"],
            headline={
                "en": "{{item}} was cheaper than usual.",
                "ms": "{{item}} lebih murah daripada biasa.",
            },
            copy={
                "en": Copy(
                    title="A good price on a regular item",
                    body="{{item}} cost {{price}}" + where_en + ", {{change}} below the {{usual_price}} you usually pay.",
                    action="If it keeps well, this is a good time to buy an extra one." if impact <= -100 else None,
                ),
                "ms": Copy(
                    title="Harga baik untuk item biasa",
                    body="{{item}} berharga {{price}}" + where_ms + ", {{change}} di bawah harga biasa {{usual_price}}.",
                    action="Jika ia tahan lama, ini masa yang baik untuk membeli lebih." if impact <= -100 else None,
                ),
            },
        ))
    return findings


def detect_items_due(current: Period, baseline: list[Period]) -> Finding | None:
    """Items bought in at least half (minimum 3) of the active earlier weeks whose usual
    gap has passed and that were not bought this week.
    """
    active = [period for period in baseline if period.active]
    if len(active) < 3:
        return None
    names: dict[str, str] = {}
    bought_in: dict[str, list[int]] = defaultdict(list)
    for index, period in enumerate(baseline):
        for trip in period.trips:
            for line in trip.lines:
                names.setdefault(line.key, line.name)
                if not bought_in[line.key] or bought_in[line.key][-1] != index:
                    bought_in[line.key].append(index)
    current_keys = current.keys()
    due: list[tuple[float, str]] = []
    for key, indexes in bought_in.items():
        if key in current_keys or len(indexes) < max(3, len(active) // 2):
            continue
        gaps = [later - earlier for earlier, later in zip(indexes, indexes[1:])]
        typical_gap = median(gaps) if gaps else len(baseline)
        periods_since = len(baseline) - indexes[-1]  # the current period counts as one
        if periods_since >= typical_gap:
            due.append((len(indexes) / len(active), names[key]))
    if not due:
        return None
    due.sort(key=lambda item: (-item[0], item[1]))
    picked = [_clip_name(name) for _, name in due[:4]]
    values = {f"item{index}": name for index, name in enumerate(picked, start=1)}
    joined_en = _join([f"{{{{item{i}}}}}" for i in range(1, len(picked) + 1)], "en")
    joined_ms = _join([f"{{{{item{i}}}}}" for i in range(1, len(picked) + 1)], "ms")
    return Finding(
        kind="items_due",
        priority=4 + len(picked),
        values=values,
        evidence_label=None,
        headline={
            "en": f"{joined_en} {'is' if len(picked) == 1 else 'are'} probably due on your next trip.",
            "ms": f"{joined_ms} mungkin perlu dibeli pada perjalanan seterusnya.",
        },
        copy={
            "en": Copy(
                title="Worth adding to your next trip",
                body=f"You usually buy {joined_en} most weeks, and {'it has' if len(picked) == 1 else 'they have'} not been in your trips this week.",
                action=f"Adding {'it' if len(picked) == 1 else 'them'} to your next basket saves a separate trip later.",
            ),
            "ms": Copy(
                title="Elok ditambah ke perjalanan seterusnya",
                body=f"Anda biasanya membeli {joined_ms} secara tetap, tetapi item ini tiada dalam perjalanan minggu ini.",
                action="Menambahnya ke bakul seterusnya menjimatkan perjalanan berasingan kemudian.",
            ),
        },
        facts={"items": picked},
    )


def detect_store_choice(current: Period) -> Finding | None:
    """Trips where the cheapest saved alternative store was estimated at least RM2 and 3 %
    cheaper than the chosen plan.
    """
    gaps: list[tuple[int, Trip]] = []
    for trip in current.trips:
        if trip.cheapest_alternative is None or trip.planned_combined_cents is None:
            continue
        gap = trip.planned_combined_cents - trip.cheapest_alternative[1]
        if gap >= 200 and gap >= trip.planned_combined_cents * 0.03:
            gaps.append((gap, trip))
    if not gaps:
        return None
    total = sum(gap for gap, _ in gaps)
    lead_gap, lead = max(gaps, key=lambda item: item[0])
    values = {
        "store": lead.store or "",
        "alternative": lead.cheapest_alternative[0],  # type: ignore[index]
        "gap": rm(lead_gap),
        "total": rm(total),
        "trip_count": str(len(gaps)),
    }
    multiple = len(gaps) > 1
    return Finding(
        kind="store_choice",
        estimate=True,
        priority=2 + total / 100 * 0.7,
        values=values,
        direction="higher",
        evidence_label={"en": "possible saving (estimated)", "ms": "penjimatan yang mungkin (anggaran)"},
        evidence_value=rm(total),
        headline={
            "en": "You could save an estimated {{gap}} by shopping at {{alternative}}.",
            "ms": "Anda boleh berjimat dianggarkan {{gap}} dengan membeli-belah di {{alternative}}.",
        },
        copy={
            "en": Copy(
                title="A cheaper option nearby",
                body=("Across {{trip_count}} trips, the lowest-priced recommended stores were estimated {{total}} cheaper in total, including travel. "
                      if multiple else "") + "For a basket like yours, {{alternative}} was estimated {{gap}} cheaper" + (" than {{store}}" if lead.store else "") + ", including travel.",
                action="If {{alternative}} is convenient for you, it is worth comparing again before your next shop.",
            ),
            "ms": Copy(
                title="Pilihan lebih murah berdekatan",
                body=("Dalam {{trip_count}} perjalanan, kedai disyorkan berharga terendah dianggarkan {{total}} lebih murah secara keseluruhan, termasuk perjalanan. "
                      if multiple else "") + "Untuk bakul seperti anda, {{alternative}} dianggarkan {{gap}} lebih murah" + (" daripada {{store}}" if lead.store else "") + ", termasuk perjalanan.",
                action="Jika {{alternative}} mudah untuk anda, elok dibandingkan semula sebelum membeli-belah seterusnya.",
            ),
        },
    )


def detect_top_up_trips(current: Period, cadence: Cadence) -> Finding | None:
    """Small trips (under 40 % of the period's largest) whose combined estimated travel is
    at least RM2.
    """
    priced = [(trip.priced_cents, trip) for trip in current.trips if trip.priced_cents is not None]
    if len(priced) < 2:
        return None
    largest = max(cents for cents, _ in priced)
    small = [trip for cents, trip in priced if cents < largest * 0.4]
    travel = sum(trip.travel_cents or 0 for trip in small)
    if not small or travel < 200:
        return None
    names: list[str] = []
    for trip in small:
        for line in trip.lines:
            clipped = _clip_name(line.name)
            if clipped not in names:
                names.append(clipped)
    names = names[:3]
    values = {"count": str(len(small)), "travel": rm(travel), "total_trips": str(len(current.trips))}
    values.update({f"item{index}": name for index, name in enumerate(names, start=1)})
    items_en = _join([f"{{{{item{i}}}}}" for i in range(1, len(names) + 1)], "en")
    items_ms = _join([f"{{{{item{i}}}}}" for i in range(1, len(names) + 1)], "ms")
    noun_en, noun_ms = _noun(cadence, "en"), _noun(cadence, "ms")
    return Finding(
        kind="top_up_trips",
        estimate=True,
        priority=2.5 + travel / 100 * 0.5,
        values=values,
        evidence_label={"en": "possible travel saving", "ms": "penjimatan pengangkutan yang mungkin"},
        evidence_value=rm(travel),
        headline={
            "en": "Combining small top-up trips could save about {{travel}} in travel.",
            "ms": "Menggabungkan perjalanan tambahan kecil boleh menjimatkan kira-kira {{travel}} kos pengangkutan.",
        },
        copy={
            "en": Copy(
                title="Combine trips to save on travel",
                body=(f"One of your {{{{total_trips}}}} trips this {noun_en} was a small top-up for {items_en}. Its travel is estimated at {{{{travel}}}}."
                      if len(small) == 1 else
                      f"{{{{count}}}} of your {{{{total_trips}}}} trips this {noun_en} were small top-ups for items like {items_en}. Their travel is estimated at {{{{travel}}}}."),
                action="Adding these items to your main basket could save that travel next time.",
            ),
            "ms": Copy(
                title="Gabungkan perjalanan untuk menjimatkan kos pengangkutan",
                body=(f"Satu daripada {{{{total_trips}}}} perjalanan {noun_ms} ini ialah perjalanan kecil untuk {items_ms}. Kos perjalanannya dianggarkan {{{{travel}}}}."
                      if len(small) == 1 else
                      f"{{{{count}}}} daripada {{{{total_trips}}}} perjalanan {noun_ms} ini ialah perjalanan kecil untuk item seperti {items_ms}. Kos perjalanannya dianggarkan {{{{travel}}}}."),
                action="Menambah item ini ke bakul utama boleh menjimatkan kos itu lain kali.",
            ),
        },
    )


def detect_repeat_skips(current: Period, baseline: list[Period]) -> Finding | None:
    """Items left unbought this period that were skipped on at least three trips overall.
    """
    current_skips = {key: name for trip in current.trips for key, name in trip.skipped}
    if not current_skips:
        return None
    counts: dict[str, int] = defaultdict(int)
    for period in [*baseline, current]:
        for trip in period.trips:
            for key in {key for key, _ in trip.skipped}:
                counts[key] += 1
    repeated = sorted(
        ((counts[key], name) for key, name in current_skips.items() if counts[key] >= 3),
        key=lambda item: (-item[0], item[1]),
    )
    if not repeated:
        return None
    count, name = repeated[0]
    values = {"item": _clip_name(name), "count": str(count)}
    return Finding(
        kind="repeat_skips",
        priority=2 + count * 0.5,
        values=values,
        headline={
            "en": "{{item}} has stayed on your list for a few trips.",
            "ms": "{{item}} kekal dalam senarai anda untuk beberapa perjalanan.",
        },
        copy={
            "en": Copy(
                title="Still on your list",
                body="{{item}} has been on your checklist for {{count}} recent trips without being picked up.",
                action="If it is often out of stock, an alternative item or another store may make it easier; if you no longer need it, you can take it off your usual basket.",
            ),
            "ms": Copy(
                title="Masih dalam senarai anda",
                body="{{item}} berada dalam senarai semak untuk {{count}} perjalanan terkini tanpa dibeli.",
                action="Jika ia sering kehabisan stok, item alternatif atau kedai lain mungkin lebih mudah; jika tidak lagi diperlukan, anda boleh membuangnya daripada bakul biasa.",
            ),
        },
    )


def _month_name(period: Period, locale: Locale) -> str:
    local = period.start.astimezone(MALAYSIA_TZ)
    return MONTHS[locale][local.month - 1]


def detect_store_record(current: Period) -> Finding | None:
    """Monthly: how often the shopper picked a store at or below the typical cost."""
    impacts = [trip.savings[0] for trip in current.trips if trip.savings and trip.savings[0] is not None]
    if len(impacts) < 2:
        return None
    good = sum(1 for impact in impacts if impact >= 0)
    total = sum(impacts)
    below = total >= 0
    values = {"good_count": str(good), "trip_count": str(len(impacts)), "total": rm(abs(total))}
    return Finding(
        kind="store_record",
        priority=2.5 + abs(total) / 100 * 0.5,
        values=values,
        estimate=True,
        direction="lower" if below else "higher",
        evidence_label={"en": "estimated saving vs typical store", "ms": "anggaran penjimatan berbanding kedai biasa"} if below else {"en": "possible saving (estimated)", "ms": "penjimatan yang mungkin (anggaran)"},
        evidence_value=rm(abs(total)),
        headline={
            "en": "Your store choices were estimated {{total}} " + ("below" if below else "above") + " the typical recommended store.",
            "ms": "Pilihan kedai anda dianggarkan {{total}} " + ("di bawah" if below else "di atas") + " kedai biasa yang disyorkan.",
        },
        copy={
            "en": Copy(
                title="Good store choices" if below else "Room to save on store choice",
                body=("On all {{trip_count}} of your trips" if good == len(impacts) else "On {{good_count}} of your {{trip_count}} trips") + " you chose a store at or below the typical recommended cost. Overall your store choices were estimated {{total}} " + ("below" if below else "above") + " the typical store.",
                action=None if below else "Choosing from the lower-priced recommended stores more often is the quickest way to save.",
            ),
            "ms": Copy(
                title="Pilihan kedai yang baik" if below else "Ruang untuk berjimat melalui pilihan kedai",
                body=("Dalam kesemua {{trip_count}} perjalanan" if good == len(impacts) else "Dalam {{good_count}} daripada {{trip_count}} perjalanan") + ", anda memilih kedai pada atau di bawah kos biasa yang disyorkan. Secara keseluruhan pilihan kedai anda dianggarkan {{total}} " + ("di bawah" if below else "di atas") + " kedai biasa.",
                action=None if below else "Memilih kedai disyorkan berharga lebih rendah dengan lebih kerap ialah cara terpantas untuk berjimat.",
            ),
        },
    )


def detect_category_shift(current: Period, baseline: list[Period], exclude: object) -> Finding | None:
    """Monthly: the category that moved most against its own recent average."""
    active = [period for period in baseline if period.spending_cents() is not None]
    if len(active) < 2 or current.spending_cents() is None:
        return None
    averages: dict[str | None, float] = defaultdict(float)
    for period in active:
        for category_id, cents in period.category_cents().items():
            averages[category_id] += cents / len(active)
    now = current.category_cents()
    best: tuple[float, str | None] | None = None
    for category_id in set(now) | set(averages):
        if category_id is None or category_id == exclude:
            continue
        delta = now.get(category_id, 0) - averages.get(category_id, 0)
        usual = averages.get(category_id, 0)
        # Rises are worth flagging early; drops are often just a bulk buy that
        # skipped this month, so they must be large to count.
        if delta > 0 and delta < max(1500, usual * 0.25):
            continue
        if delta <= 0 and (-delta < 3000 or -delta < usual * 0.5):
            continue
        if best is None or abs(delta) > abs(best[0]):
            best = (delta, category_id)
    if best is None:
        return None
    delta, category_id = best
    higher = delta > 0
    values = {
        "category_en": _category_label(category_id, "en"),
        "category_ms": _category_label(category_id, "ms"),
        "amount": rm(now.get(category_id, 0)),
        "usual": rm(round(averages.get(category_id, 0))),
        "difference": rm(round(abs(delta))),
    }
    return Finding(
        kind="category_shift",
        priority=3 + abs(delta) / 100 * 0.4,
        values=values,
        direction="higher" if higher else "lower",
        evidence_label={"en": "vs your monthly average", "ms": "berbanding purata bulanan"},
        evidence_value=("+" if higher else "−") + values["difference"],
        headline={
            "en": "{{category_en}} spending was " + ("higher" if higher else "lower") + " than usual.",
            "ms": "Perbelanjaan {{category_ms}} lebih " + ("tinggi" if higher else "rendah") + " daripada biasa.",
        },
        copy={
            "en": Copy(
                title=("More" if higher else "Less") + " on {{category_en}}",
                body="You spent {{amount}} on {{category_en}} this month, compared with about {{usual}} in a usual month.",
                action="Setting a planned amount for {{category_en}} next month can help keep it on track." if higher else None,
            ),
            "ms": Copy(
                title=("Lebih banyak" if higher else "Kurang") + " untuk {{category_ms}}",
                body="Anda berbelanja {{amount}} untuk {{category_ms}} bulan ini, berbanding kira-kira {{usual}} dalam bulan biasa.",
                action="Menetapkan amaun yang dirancang untuk {{category_ms}} bulan depan boleh membantu." if higher else None,
            ),
        },
    )


def detect_where_money_went(current: Period, cadence: Cadence) -> Finding | None:
    """Current period only: the biggest category and the biggest single item."""
    spent = current.spending_cents()
    if not spent:
        return None
    categories = current.category_cents()
    if len(categories) < 2:
        return None  # "100% of your spending" says nothing
    category_id, category_cents = max(categories.items(), key=lambda item: item[1])
    items: dict[str, tuple[str, int]] = {}
    for trip in current.trips:
        for line in trip.lines:
            if line.total_cents is not None:
                name, cents = items.get(line.key, (line.name, 0))
                items[line.key] = (name, cents + line.total_cents)
    item_name, item_cents = max(items.values(), key=lambda item: item[1])
    values = {
        "category_en": _category_label(category_id, "en"),
        "category_ms": _category_label(category_id, "ms"),
        "category_amount": rm(category_cents),
        "share": pct(category_cents / spent),
        "item": _clip_name(item_name),
        "item_amount": rm(item_cents),
    }
    noun_en, noun_ms = _noun(cadence, "en"), _noun(cadence, "ms")
    return Finding(
        kind="where_money_went",
        priority=1.5,
        values=values,
        evidence_label={"en": "of your spending", "ms": "daripada perbelanjaan"},
        evidence_value=values["share"],
        headline={
            "en": "{{category_en}} took the biggest share of your spending.",
            "ms": "{{category_ms}} mengambil bahagian terbesar perbelanjaan anda.",
        },
        copy={
            "en": Copy(
                title="Where your money went",
                body=f"{{{{category_en}}}} made up {{{{share}}}} of your spending this {noun_en} ({{{{category_amount}}}}). The item you spent most on was {{{{item}}}}, {{{{item_amount}}}} in total.",
            ),
            "ms": Copy(
                title="Ke mana wang anda pergi",
                body=f"{{{{category_ms}}}} merangkumi {{{{share}}}} perbelanjaan anda {noun_ms} ini ({{{{category_amount}}}}). Item yang paling banyak dibelanjakan ialah {{{{item}}}}, {{{{item_amount}}}} kesemuanya.",
            ),
        },
    )


def detect_savings_result(current: Period) -> Finding | None:
    """Current period only: what the saved store comparisons estimate."""
    snapshots = [trip.savings for trip in current.trips if trip.savings and trip.savings[2] is not None]
    if not snapshots:
        return None
    net = sum(snapshot[2] for snapshot in snapshots)  # type: ignore[misc]
    store = sum(snapshot[0] or 0 for snapshot in snapshots)
    swaps = sum(snapshot[1] or 0 for snapshot in snapshots)
    if net == 0:
        return None
    below = net > 0
    values = {"net": rm(abs(net)), "store": signed_rm(store), "swaps": signed_rm(swaps)}
    return Finding(
        kind="savings_result",
        priority=1.4,
        values=values,
        estimate=True,
        evidence_label={"en": "estimated saving vs typical store", "ms": "anggaran penjimatan berbanding kedai biasa"} if below else {"en": "possible saving (estimated)", "ms": "penjimatan yang mungkin (anggaran)"},
        evidence_value=values["net"],
        headline={
            "en": "Your trips were estimated {{net}} " + ("below" if below else "above") + " the typical recommended store.",
            "ms": "Perjalanan anda dianggarkan {{net}} " + ("di bawah" if below else "di atas") + " kedai biasa yang disyorkan.",
        },
        copy={
            "en": Copy(
                title="Your estimated savings" if below else "Room to save with your store picks",
                body="Your saved comparisons estimate these trips came to {{net}} " + ("below" if below else "above") + " the typical recommended store: {{store}} from your store choice and {{swaps}} from item swaps.",
                action=None if below else "Item swaps and the lower-priced recommended stores are the easiest ways to save next time.",
            ),
            "ms": Copy(
                title="Anggaran penjimatan anda" if below else "Ruang untuk berjimat melalui pilihan kedai",
                body="Perbandingan tersimpan menganggarkan perjalanan ini {{net}} " + ("di bawah" if below else "di atas") + " kedai biasa yang disyorkan: {{store}} daripada pilihan kedai dan {{swaps}} daripada pertukaran item.",
                action=None if below else "Pertukaran item dan kedai disyorkan berharga lebih rendah ialah cara paling mudah untuk berjimat lain kali.",
            ),
        },
    )


def detect_unbought(current: Period, cadence: Cadence) -> Finding | None:
    """Current period only: planned items left unbought."""
    names: list[str] = []
    for trip in current.trips:
        for _, name in trip.skipped:
            clipped = _clip_name(name)
            if clipped not in names:
                names.append(clipped)
    if not names:
        return None
    shown = names[:3]
    values = {f"item{index}": name for index, name in enumerate(shown, start=1)}
    joined_en = _join([f"{{{{item{i}}}}}" for i in range(1, len(shown) + 1)], "en")
    joined_ms = _join([f"{{{{item{i}}}}}" for i in range(1, len(shown) + 1)], "ms")
    noun_en, noun_ms = _noun(cadence, "en"), _noun(cadence, "ms")
    return Finding(
        kind="unbought",
        priority=1.2,
        values=values,
        headline={
            "en": f"A few planned items can carry over to your next trip.",
            "ms": f"Beberapa item yang dirancang boleh dibawa ke perjalanan seterusnya.",
        },
        copy={
            "en": Copy(
                title="Carry over to your next trip",
                body=f"{joined_en} {'was' if len(shown) == 1 else 'were'} on your checklist this {noun_en} and can carry over to your next trip.",
                action="If something was out of stock, an alternative item or another store may help.",
            ),
            "ms": Copy(
                title="Bawa ke perjalanan seterusnya",
                body=f"{joined_ms} ada dalam senarai semak tetapi tidak dibeli {noun_ms} ini.",
                action="Jika kehabisan stok, cuba kedai lain atau item alternatif lain kali.",
            ),
        },
    )


def detect_travel_share(current: Period, cadence: Cadence) -> Finding | None:
    """Current period only: estimated travel as a share of the trips' total cost."""
    spent = current.spending_cents()
    travel = sum(trip.travel_cents or 0 for trip in current.trips)
    if not spent or travel < 300 or travel / (spent + travel) < 0.08:
        return None
    values = {"share": pct(travel / (spent + travel)), "travel": rm(travel), "spent": rm(spent)}
    noun_en, noun_ms = _noun(cadence, "en"), _noun(cadence, "ms")
    return Finding(
        kind="travel_share",
        priority=1.3,
        values=values,
        estimate=True,
        evidence_label={"en": "of trip cost was travel", "ms": "kos perjalanan ialah pengangkutan"},
        evidence_value=values["share"],
        headline={
            "en": "Travel was about {{share}} of your trip costs, an easy place to save.",
            "ms": "Pengangkutan kira-kira {{share}} daripada kos perjalanan anda, tempat mudah untuk berjimat.",
        },
        copy={
            "en": Copy(
                title="Make travel go further",
                body=f"Getting to the shops was estimated at {{{{travel}}}} this {noun_en}, on top of {{{{spent}}}} of shopping, about {{{{share}}}} of the total.",
                action="Fewer, larger trips or a closer recommended store would lower it.",
            ),
            "ms": Copy(
                title="Jimatkan kos pengangkutan",
                body=f"Perjalanan ke kedai dianggarkan {{{{travel}}}} {noun_ms} ini, selain {{{{spent}}}} untuk membeli-belah, kira-kira {{{{share}}}} daripada jumlah.",
                action="Perjalanan yang lebih sedikit tetapi lebih besar, atau kedai disyorkan yang lebih dekat, boleh mengurangkannya.",
            ),
        },
    )


def detect_getting_started(baseline: list[Period], cadence: Cadence) -> Finding | None:
    """Sparse history: say which comparisons unlock with more recorded trips."""
    if sum(1 for period in baseline if period.active) >= 2:
        return None
    noun_en, noun_ms = _noun(cadence, "en"), _noun(cadence, "ms")
    return Finding(
        kind="getting_started",
        priority=0,
        values={},
        headline={
            "en": "Your report gets more personal as you record more trips.",
            "ms": "Laporan anda menjadi lebih peribadi apabila lebih banyak perjalanan direkodkan.",
        },
        copy={
            "en": Copy(
                title="More to come",
                body=f"After a couple more {noun_en}s of recorded trips, this report will compare your spending with your usual {noun_en}, flag price changes on items you buy regularly and remind you about items that are probably due.",
                action="Record each trip from your checklist to unlock these.",
            ),
            "ms": Copy(
                title="Lebih banyak akan datang",
                body=f"Selepas beberapa {noun_ms} lagi perjalanan direkodkan, laporan ini akan membandingkan perbelanjaan anda dengan {noun_ms} biasa, menandakan perubahan harga item yang kerap dibeli dan mengingatkan item yang mungkin perlu dibeli.",
                action="Rekodkan setiap perjalanan daripada senarai semak untuk membukanya.",
            ),
        },
    )


def build_findings(
    payload: GenerateReportRequest, start: datetime, now: datetime,
) -> tuple[list[Finding], Period, list[Period]]:
    """Run every detector, keep the highest-priority findings (four per report), keep one
    forward-looking finding when found, and add the getting-started note when history is
    thin. Returns (findings, current period, baseline periods).
    """
    cadence: Cadence = payload.cadence
    current, baseline = build_periods(payload, start)
    in_progress = now < current.end
    spending = detect_spending_vs_usual(current, baseline, cadence, in_progress)
    top_up = detect_top_up_trips(current, cadence)
    repeat_skips = detect_repeat_skips(current, baseline)
    store_record = detect_store_record(current) if cadence == "monthly" else None
    candidates: list[Finding | None] = [
        spending,
        *detect_price_changes(current, baseline),
        detect_store_choice(current),
        top_up,
        repeat_skips,
        store_record,
        # Current-period insights: they need no history and fill spare slots.
        detect_where_money_went(current, cadence),
        None if store_record else detect_savings_result(current),
        None if repeat_skips else detect_unbought(current, cadence),
        None if top_up else detect_travel_share(current, cadence),
    ]
    if cadence == "weekly":
        candidates.append(detect_items_due(current, baseline))
    else:
        candidates.append(detect_category_shift(current, baseline, spending.facts.get("driver") if spending else None))
    ranked = sorted((item for item in candidates if item is not None), key=lambda item: -item.priority)
    limit = MAX_INSIGHTS[cadence]
    findings = ranked[:limit]
    # Keep one look-ahead card, and the getting-started note when history is thin.
    forward = next((item for item in ranked[limit:] if item.kind in FORWARD_KINDS), None)
    if forward and not any(item.kind in FORWARD_KINDS for item in findings):
        findings[-1] = forward
    starter = detect_getting_started(baseline, cadence)
    if starter is not None:
        findings = [*findings[: limit - 1], starter] if len(findings) >= limit else [*findings, starter]
    for index, finding in enumerate(findings, start=1):
        finding.id = f"f{index}"
    return findings, current, baseline


def default_headline(
    findings: Sequence[Finding], current: Period, baseline: Sequence[Period], cadence: Cadence, locale: Locale,
) -> str:
    """Deterministic headline: a monthly summary and/or the lead finding, else a plain
    count of trips and spending.
    """
    lead = next((finding for finding in findings if finding.kind != "getting_started"), None)
    if cadence == "monthly" and current.active:
        summary = _month_summary(current, baseline, locale)
        return summary if lead is None else f"{summary} {render(lead.headline[locale], lead.values)}"
    if lead is not None:
        return render(lead.headline[locale], lead.values)
    trips = len(current.trips)
    spent = current.spending_cents()
    history = sum(1 for period in baseline if period.active)
    noun = _noun(cadence, locale)
    if locale == "ms":
        base = f"Anda merekodkan {trips} perjalanan" + (f" dan berbelanja {rm(spent)}." if spent is not None else ".")
        return base + (" Belum cukup sejarah untuk melihat corak; teruskan merekod perjalanan." if history < 2
                       else f" Tiada perubahan besar berbanding {noun} biasa anda.")
    base = f"You recorded {trips} {'trip' if trips == 1 else 'trips'}" + (f" and spent {rm(spent)}." if spent is not None else ".")
    return base + (" There isn't enough history yet to spot patterns, so keep recording trips." if history < 2
                   else f" Nothing changed much from your usual {noun}.")


def _month_summary(current: Period, baseline: Sequence[Period], locale: Locale) -> str:
    """One sentence on the month as a whole, against the month before."""
    month = _month_name(current, locale)
    trips = len(current.trips)
    spent = current.spending_cents()
    previous = baseline[-1] if baseline else None
    previous_spent = previous.spending_cents() if previous and previous.active else None
    if locale == "ms":
        text = f"Pada bulan {month} anda membuat {trips} perjalanan"
        if spent is None:
            return text + "."
        text += f" dan berbelanja {rm(spent)}"
        if previous_spent is None or previous is None:
            return text + "."
        delta = spent - previous_spent
        if delta == 0:
            return text + f", sama seperti bulan {_month_name(previous, locale)}."
        return text + f", {rm(abs(delta))} {'lebih' if delta > 0 else 'kurang'} daripada bulan {_month_name(previous, locale)}."
    text = f"In {month} you made {trips} {'trip' if trips == 1 else 'trips'}"
    if spent is None:
        return text + "."
    text += f" and spent {rm(spent)}"
    if previous_spent is None or previous is None:
        return text + "."
    delta = spent - previous_spent
    if delta == 0:
        return text + f", the same as in {_month_name(previous, locale)}."
    return text + f", {rm(abs(delta))} {'more' if delta > 0 else 'less'} than in {_month_name(previous, locale)}."
