"""Festival-specific key commodity analysis for AC 4i.7.7."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from statistics import median
from typing import Mapping, Sequence

SPECIALTY_ANALYSIS_METHOD_VERSION = "4i.7.7-v1"


def _numeric(value):
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def item_matches_specialty(metadata: Mapping[str, object], rule: Mapping[str, object]) -> bool:
    """Return whether one catalogue item matches a specialty rule."""

    category = str(metadata.get("item_category") or "").strip()
    group = str(metadata.get("item_group") or "").strip()
    name = str(metadata.get("item") or "").upper()
    return (
        category in set(rule.get("match_categories") or [])
        or group in set(rule.get("match_groups") or [])
        or any(
            str(keyword).upper() in name
            for keyword in (rule.get("match_name_keywords") or [])
        )
    )


def match_specialty_items(lookup_items: Mapping[str, Mapping[str, object]], rule):
    """Return matching item codes for one specialty rule."""

    explicit = {str(code) for code in (rule.get("item_codes") or [])}
    return {
        code
        for code, metadata in lookup_items.items()
        if code in explicit or item_matches_specialty(metadata, rule)
    }


def _positive_item_values(rows: Sequence[Mapping[str, object]]):
    """Return one positive rise value per unique item, equally weighted."""

    by_item: dict[str, list[Decimal]] = {}
    for row in rows:
        if row.get("status") != "ok" or row.get("rise_status") != "rise":
            continue
        value = _numeric(row.get("rise_pct"))
        if value is None:
            continue
        by_item.setdefault(str(row.get("item_code")), []).append(value)
    values = [
        sum(values) / Decimal(len(values))
        for values in by_item.values()
        if values
    ]
    return values, by_item


def compute_specialty_summary(
    rows: Sequence[Mapping[str, object]],
    *,
    matched_item_codes,
    festival_avg_rise_ratio,
    thresholds: Mapping[str, object],
    state: str | None = None,
):
    """Compute one specialty summary for a festival or festival-state."""

    matched = {str(code) for code in matched_item_codes}
    matched_rows = [row for row in rows if str(row.get("item_code")) in matched]
    values, by_item = _positive_item_values(matched_rows)
    minimum_items = int(thresholds.get("minimum_items", 3))
    difference_threshold = Decimal(str(thresholds.get("flag_difference_pct_points", 2.0)))
    relative_threshold = Decimal(str(thresholds.get("flag_relative_lift", 1.2)))

    average = None if not values else sum(values) / Decimal(len(values))
    festival_average = _numeric(festival_avg_rise_ratio)
    difference = (
        None
        if average is None or festival_average is None
        else average - festival_average
    )
    relative = (
        None
        if average is None or festival_average in (None, Decimal("0"))
        else average / festival_average
    )

    if not matched:
        status = "no_matches"
    elif not matched_rows:
        status = "no_festival_data"
    elif len(values) < minimum_items:
        status = "insufficient_items"
    elif festival_average is None:
        status = "no_festival_ratio"
    else:
        status = "ok"

    if status != "ok":
        flagged = False
    elif festival_average <= 0:
        flagged = difference is not None and difference >= difference_threshold
    else:
        flagged = (
            difference is not None
            and relative is not None
            and difference >= difference_threshold
            and relative >= relative_threshold
        )

    observation_count = sum(
        int(row.get("observation_count") or 0) for row in matched_rows
    )
    excluded_count = sum(
        int(row.get("excluded_observation_count") or 0) for row in matched_rows
    )
    return {
        "state": state,
        "status": status,
        "specialty_avg_rise_ratio": average,
        "festival_avg_rise_ratio": festival_average,
        "difference_pct_points": difference,
        "relative_lift": relative,
        "significant_above_average": flagged,
        "matched_item_count": len(matched),
        "observed_item_count": len(by_item),
        "rising_item_count": len(values),
        "median_rise_ratio": None if not values else median(values),
        "observation_count": observation_count,
        "excluded_observation_count": excluded_count,
        "item_codes": sorted(by_item),
    }


def compute_specialty_rows(
    item_rows: Sequence[Mapping[str, object]],
    ratios: Mapping[str, object],
    specialty_map: Mapping[str, object],
    lookup_items: Mapping[str, Mapping[str, object]],
):
    """Return festival-level and festival-state specialty summaries."""

    thresholds = specialty_map.get("thresholds") or {}
    rules_by_festival = specialty_map.get("festivals") or {}
    festival_ratios = {
        str(row.get("festival_id")): row
        for row in (ratios.get("festival_rise_ratios") or [])
    }
    state_ratios = {
        (str(row.get("festival_id")), str(row.get("state"))): row
        for row in (ratios.get("festival_state_rise_ratios") or [])
    }

    matched_cache = {}
    festival_output = []
    state_output = []

    for festival_id, rules in rules_by_festival.items():
        festival_rows = [
            row for row in item_rows if str(row.get("festival_id")) == festival_id
        ]
        festival_ratio = festival_ratios.get(str(festival_id), {})
        for rule in rules:
            specialty_id = str(rule.get("specialty_id"))
            matched = matched_cache.setdefault(
                (festival_id, specialty_id),
                match_specialty_items(lookup_items, rule),
            )
            summary = compute_specialty_summary(
                festival_rows,
                matched_item_codes=matched,
                festival_avg_rise_ratio=festival_ratio.get("avg_rise_ratio"),
                thresholds=thresholds,
            )
            summary.update(
                {
                    "festival_id": festival_id,
                    "specialty_id": specialty_id,
                    "name_en": rule.get("name_en"),
                    "name_zh": rule.get("name_zh"),
                    "ratio_status": festival_ratio.get("ratio_status"),
                }
            )
            festival_output.append(summary)

            states = sorted(
                {
                    str(row.get("state"))
                    for row in festival_rows
                }
                | {
                    str(state)
                    for (fid, state) in state_ratios
                    if fid == festival_id
                }
            )
            for state in states:
                rows = [
                    row
                    for row in festival_rows
                    if str(row.get("state")) == state
                ]
                state_ratio = state_ratios.get((festival_id, state), {})
                state_summary = compute_specialty_summary(
                    rows,
                    matched_item_codes=matched,
                    festival_avg_rise_ratio=state_ratio.get("avg_rise_ratio"),
                    thresholds=thresholds,
                    state=state,
                )
                state_summary.update(
                    {
                        "festival_id": festival_id,
                        "specialty_id": specialty_id,
                        "name_en": rule.get("name_en"),
                        "name_zh": rule.get("name_zh"),
                        "ratio_status": state_ratio.get("ratio_status"),
                    }
                )
                state_output.append(state_summary)

    return {
        "festival_specialties": festival_output,
        "festival_state_specialties": state_output,
    }
