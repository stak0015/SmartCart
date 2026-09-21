"""Normalize and summarize recurring chain names in the SARA merchant list."""

from __future__ import annotations

from collections import Counter, defaultdict
import re
import unicodedata


CHAIN_LEGAL_TOKENS = frozenset(
    {
        "BHD",
        "BERHAD",
        "COMPANY",
        "ENTERPRISE",
        "HOLDING",
        "HOLDINGS",
        "INC",
        "RETAIL",
        "SDN",
        "TRADING",
    }
)
CHAIN_LEADING_DESCRIPTORS = frozenset(
    {
        "KEDAI",
        "PASAR",
        "PASARAYA",
        "PUSAT",
        "RAYA",
        "SYARIKAT",
    }
)
CHAIN_NAME_ALIASES = {
    "TESCO": "LOTUSS",
}


def normalize_chain_text(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii").upper()
    text = re.sub(r"\bLOTUS\s*['`]\s*S\b", "LOTUSS", text)
    text = re.sub(r"\bLOTUS\s+S\b", "LOTUSS", text)
    tokens = re.sub(r"[^A-Z0-9]+", " ", text).split()
    return " ".join(CHAIN_NAME_ALIASES.get(token, token) for token in tokens)


def canonical_chain_key(value: object) -> str:
    """Return a branch-insensitive chain key when the name exposes one.

    Parenthesized branch locations and spaced dash suffixes are removed. Legal
    company suffixes and leading retail descriptors are ignored, while brand
    words such as ``MART`` and ``SUPERMARKET`` remain meaningful.
    """

    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii").upper()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.split(r"\s+[-–]\s+", text, maxsplit=1)[0]
    tokens = normalize_chain_text(text).split()
    while tokens and tokens[0] in CHAIN_LEADING_DESCRIPTORS:
        tokens.pop(0)
    tokens = [token for token in tokens if token not in CHAIN_LEGAL_TOKENS]
    if not tokens:
        return ""
    if not any(len(token) > 1 for token in tokens):
        return ""
    return " ".join(tokens)


def build_chain_catalog(
    records: list[dict[str, object]],
    official_partner_names: list[str] | None = None,
) -> dict[str, object]:
    """Build recurring chain candidates and cross-reference official partners.

    The official MyKasih page is a merchant directory, not a chain-only list:
    it contains both national chains and one-off local businesses.  Therefore
    the local SARA snapshot remains the source for recurring chain groups, and
    the official names are retained as provenance plus an exact canonical-key
    cross-reference on each group.
    """

    official_names = sorted(
        {
            str(name).strip()
            for name in (official_partner_names or [])
            if str(name).strip()
        },
        key=str.casefold,
    )
    official_by_key: dict[str, list[str]] = defaultdict(list)
    for name in official_names:
        key = canonical_chain_key(name)
        if key:
            official_by_key[key].append(name)

    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for record in records:
        key = canonical_chain_key(record.get("trading_name"))
        if key:
            grouped[key].append(record)

    groups: list[dict[str, object]] = []
    grouped_record_count = 0
    for key, members in grouped.items():
        if len(members) < 2:
            continue
        grouped_record_count += len(members)
        names = Counter(str(member.get("trading_name") or "").strip() for member in members)
        states = sorted(
            {
                str(member.get("state") or "").strip()
                for member in members
                if str(member.get("state") or "").strip()
            }
        )
        groups.append(
            {
                "chain_key": key,
                "representative_name": names.most_common(1)[0][0],
                "merchant_count": len(members),
                "states": states,
                "sample_names": [name for name, _ in names.most_common(10)],
                "source_ids": [str(member.get("source_id") or "") for member in members],
                "official_partner_names": official_by_key.get(key, []),
            }
        )
    groups.sort(key=lambda group: (-int(group["merchant_count"]), str(group["chain_key"])))
    return {
        "chain_groups": groups,
        "official_partner_names": official_names,
        "official_partner_chain_keys": sorted(official_by_key),
        "summary": {
            "records": len(records),
            "recurring_chain_groups": len(groups),
            "records_in_recurring_groups": grouped_record_count,
            "records_with_singleton_or_empty_keys": len(records) - grouped_record_count,
            "official_partner_names": len(official_names),
            "official_partner_chain_keys": len(official_by_key),
            "recurring_groups_with_official_partner": sum(
                bool(group["official_partner_names"]) for group in groups
            ),
        },
    }
