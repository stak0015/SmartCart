"""Mark PriceCatcher premises as verified SARA stores from the MyKasih list.

The MyKasih merchant list and the PriceCatcher premise lookup use different
identifiers, so this migration joins them using the selected PriceCatcher
Place coordinates plus lightweight identity checks:

* the coordinates must be within 150 metres;
* meaningful premise-name tokens must overlap; and
* when both rows have a postcode, the postcodes must match exactly.

Rows without a reliable selected Price place or without usable coordinates are
left unchanged. If a postcode is unavailable on either side, a stricter name
match and a state check are used instead. The migration only changes
``premise.sara_partner`` from NULL/FALSE to TRUE for matches; it never clears
an existing verification.

This script does not contact Google or MyKasih. It consumes the local raw
snapshot at ``data/raw/google_place_candidates_sara_one_mykasih.json`` and the
local PriceCatcher/Place enrichment snapshots.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
import json
import math
import os
from pathlib import Path
import re
import sys
import unicodedata
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import psycopg

from ingest_pricecatcher import load_local_env
from sara_chain_catalog import canonical_chain_key, normalize_chain_text


ROOT = Path(__file__).resolve().parent
RAW_DATA_DIR = ROOT / "data" / "raw"
SARA_MERCHANT_PATH = RAW_DATA_DIR / "google_place_candidates_sara_one_mykasih.json"
PRICECATCHER_PREMISE_PATH = (
    RAW_DATA_DIR / "lookup_premise_enriched_postcode_place_id.csv"
)
PRICECATCHER_COORDINATE_PATH = (
    RAW_DATA_DIR / "lookup_premise_enriched_postcode_place_id.cache.json"
)
SARA_MATCH_AUDIT_PATH = RAW_DATA_DIR / "sara_verified_match_audit.json"
DEFAULT_DISTANCE_THRESHOLD_METERS = 150.0
MIN_NAME_SCORE = 0.75
MIN_SHARED_NAME_TOKENS = 2
MIN_NAME_SCORE_WITHOUT_POSTCODE = 0.9
FUZZY_TOKEN_SIMILARITY_THRESHOLD = 0.8

REQUIRED_PREMISE_COLUMNS = {
    "premise_code",
    "premise",
    "address",
    "state",
    "district",
}

# These words do not identify a particular shop. Removing them prevents a
# generic name such as "KEDAI RUNCIT" from being accepted on its own, while
# retaining useful tokens such as a branch number or town name.
GENERIC_NAME_TOKENS = frozenset(
    {
        "A",
        "AN",
        "AND",
        "AT",
        "BHD",
        "BERHAD",
        "BY",
        "COMPANY",
        "ENTERPRISE",
        "FOOD",
        "GROCERY",
        "HYPERMARKET",
        "IN",
        "JALAN",
        "JLN",
        "KEDAI",
        "LOT",
        "MALAYSIA",
        "MARKET",
        "MART",
        "MINI",
        "NO",
        "OF",
        "PASAR",
        "PASARAYA",
        "ROAD",
        "RUNCIT",
        "SDN",
        "SHOP",
        "STORE",
        "SUPERMARKET",
        "THE",
        "TRADING",
        "WILAYAH",
    }
)


@dataclass(frozen=True)
class SaraMerchant:
    source_id: str
    name: str
    address: str
    city: str
    postal_code: str
    state: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class PriceCatcherPremise:
    premise_code: str
    name: str
    address: str
    district: str
    state: str
    postal_code: str
    latitude: float | None
    longitude: float | None
    place_match_decision: str


@dataclass(frozen=True)
class SaraMatch:
    premise_code: str
    source_id: str
    distance_meters: float
    name_score: float
    shared_name_token_count: int
    matched_brand_token_count: int
    postcode_match: bool


@dataclass(frozen=True)
class SaraCandidateEvaluation:
    merchant: SaraMerchant
    distance_meters: float
    name_score: float
    shared_name_token_count: int
    matched_brand_token_count: int
    brand_token_count: int
    pricecatcher_chain_key: str
    sara_chain_key: str
    chain_key_match: bool
    postcode_match: bool
    passed_rules: bool
    rejection_reasons: tuple[str, ...]


def clean_text(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def normalise_code(value: object) -> str:
    raw = clean_text(value)
    if not raw:
        return ""
    try:
        number = Decimal(raw)
    except InvalidOperation:
        return raw
    if number == Decimal("-1"):
        return ""
    if number == number.to_integral_value():
        return str(number.quantize(Decimal("1")))
    raise ValueError(f"premise code is not an integer: {raw!r}")


def normalise_text(value: object) -> str:
    return normalize_chain_text(clean_text(value))


def meaningful_tokens(value: object) -> set[str]:
    return {
        token
        for token in normalise_text(value).split()
        if len(token) > 1 and token not in GENERIC_NAME_TOKENS
    }


def name_overlap_score(source: object, candidate: object) -> float:
    score, _, _, _ = name_overlap_details(source, candidate)
    return score


def fuzzy_token_similarity(source: str, candidate: str) -> float:
    """Return conservative similarity for two already-normalized name tokens."""

    if source == candidate:
        return 1.0
    if min(len(source), len(candidate)) < 3:
        return 0.0
    ratio = SequenceMatcher(None, source, candidate).ratio()
    shorter, longer = sorted((source, candidate), key=len)
    if len(shorter) >= 4 and shorter in longer:
        ratio = max(ratio, len(shorter) / len(longer))
    return ratio


def name_overlap_details(
    source: object, candidate: object, source_context: object = ""
) -> tuple[float, int, int, int]:
    source_tokens = sorted(meaningful_tokens(source))
    candidate_tokens = sorted(meaningful_tokens(candidate))
    if not source_tokens or not candidate_tokens:
        return 0.0, 0, 0, 0
    location_tokens = meaningful_tokens(source_context)
    brand_tokens = set(source_tokens) - location_tokens
    # PriceCatcher names are usually shorter than the MyKasih trading name.
    # Match each PriceCatcher token to at most one SARA token, then score
    # coverage of the PriceCatcher name. This permits small spelling/branch
    # variations while requiring at least two meaningful token matches below.
    possible_pairs = sorted(
        (
            fuzzy_token_similarity(source_token, candidate_token),
            source_token,
            candidate_token,
        )
        for source_token in source_tokens
        for candidate_token in candidate_tokens
    )
    used_source: set[str] = set()
    used_candidate: set[str] = set()
    matched_scores: list[float] = []
    matched_brand_token_count = 0
    for similarity, source_token, candidate_token in reversed(possible_pairs):
        if similarity < FUZZY_TOKEN_SIMILARITY_THRESHOLD:
            break
        if source_token in used_source or candidate_token in used_candidate:
            continue
        used_source.add(source_token)
        used_candidate.add(candidate_token)
        matched_scores.append(similarity)
        if source_token in brand_tokens:
            matched_brand_token_count += 1
    if not matched_scores:
        return 0.0, 0, 0, len(brand_tokens)
    return (
        sum(matched_scores) / len(source_tokens),
        len(matched_scores),
        matched_brand_token_count,
        len(brand_tokens),
    )


def extract_postcode(value: object) -> str:
    matches = re.findall(r"(?<!\d)(\d{5})(?!\d)", clean_text(value))
    return matches[-1] if matches else ""


def normalise_postcode(value: object) -> str:
    raw = clean_text(value)
    if raw.isdigit() and len(raw) == 5:
        return raw
    return extract_postcode(raw)


def parse_coordinate(value: object, label: str) -> float | None:
    if value is None or clean_text(value) == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} is not numeric: {value!r}") from error
    if not math.isfinite(result):
        raise ValueError(f"{label} is not finite: {value!r}")
    return result


def valid_coordinate_pair(latitude: float | None, longitude: float | None) -> bool:
    return (
        latitude is not None
        and longitude is not None
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
        and not (latitude == 0 and longitude == 0)
    )


def haversine_meters(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    radians = math.pi / 180
    latitude_delta = (latitude_b - latitude_a) * radians
    longitude_delta = (longitude_b - longitude_a) * radians
    latitude_mean = (latitude_a + latitude_b) * radians / 2
    x = longitude_delta * math.cos(latitude_mean)
    y = latitude_delta
    return 6_371_000 * math.sqrt(x * x + y * y)


def states_compatible(source: str, candidate: str) -> bool:
    source_tokens = set(normalise_text(source).split()) - {"WP", "WPKL"}
    candidate_tokens = set(normalise_text(candidate).split()) - {"WP", "WPKL"}
    return bool(source_tokens and candidate_tokens and source_tokens == candidate_tokens)


def load_sara_merchants(path: Path) -> list[SaraMerchant]:
    if not path.is_file():
        raise FileNotFoundError(f"SARA merchant snapshot not found: {path}")
    body = json.loads(path.read_text(encoding="utf-8"))
    records = body.get("records") if isinstance(body, dict) else None
    if not isinstance(records, list):
        raise ValueError("SARA merchant snapshot must contain a records list")

    merchants: list[SaraMerchant] = []
    seen_source_ids: set[str] = set()
    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            raise ValueError(f"SARA record {index} is not an object")
        source_id = clean_text(record.get("source_id"))
        name = clean_text(record.get("trading_name"))
        latitude = parse_coordinate(
            record.get("latitude"), f"SARA record {index} latitude"
        )
        longitude = parse_coordinate(
            record.get("longitude"), f"SARA record {index} longitude"
        )
        if not source_id or not name or not valid_coordinate_pair(latitude, longitude):
            continue
        if source_id in seen_source_ids:
            raise ValueError(f"SARA snapshot contains duplicate source_id: {source_id}")
        seen_source_ids.add(source_id)
        merchants.append(
            SaraMerchant(
                source_id=source_id,
                name=name,
                address=clean_text(record.get("address")),
                city=clean_text(record.get("city")),
                postal_code=normalise_postcode(record.get("postal_code")),
                state=clean_text(record.get("state")),
                latitude=latitude,
                longitude=longitude,
            )
        )
    return merchants


def load_pricecatcher_premises(
    premise_path: Path, coordinate_path: Path
) -> list[PriceCatcherPremise]:
    if not premise_path.is_file():
        raise FileNotFoundError(f"PriceCatcher premise snapshot not found: {premise_path}")
    if not coordinate_path.is_file():
        raise FileNotFoundError(f"PriceCatcher coordinate cache not found: {coordinate_path}")

    with premise_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_PREMISE_COLUMNS - columns
        if missing:
            raise ValueError(
                "PriceCatcher premise snapshot is missing columns: "
                f"{sorted(missing)}"
            )
        source_rows = list(reader)

    cache_body = json.loads(coordinate_path.read_text(encoding="utf-8"))
    raw_results = cache_body.get("results") if isinstance(cache_body, dict) else None
    if not isinstance(raw_results, dict):
        raise ValueError("PriceCatcher coordinate cache must contain a results object")

    coordinates: dict[str, dict[str, object]] = {}
    for result in raw_results.values():
        if not isinstance(result, dict):
            raise ValueError("PriceCatcher coordinate cache contains a non-object result")
        code = normalise_code(result.get("premise_code"))
        if not code:
            continue
        if code in coordinates:
            raise ValueError(f"PriceCatcher coordinate cache has duplicate premise_code: {code}")
        coordinates[code] = result

    premises: list[PriceCatcherPremise] = []
    seen_codes: set[str] = set()
    for row in source_rows:
        code = normalise_code(row.get("premise_code"))
        if not code:
            continue
        if code in seen_codes:
            raise ValueError(f"PriceCatcher premise snapshot has duplicate premise_code: {code}")
        seen_codes.add(code)
        result = coordinates.get(code, {})
        latitude = parse_coordinate(
            result.get("place_latitude"), f"PriceCatcher premise {code} latitude"
        )
        longitude = parse_coordinate(
            result.get("place_longitude"), f"PriceCatcher premise {code} longitude"
        )
        has_valid_coordinates = valid_coordinate_pair(latitude, longitude)
        premises.append(
            PriceCatcherPremise(
                premise_code=code,
                name=clean_text(row.get("premise")),
                address=clean_text(row.get("address")),
                district=clean_text(row.get("district")),
                state=clean_text(row.get("state")),
                postal_code=normalise_postcode(row.get("postcode"))
                or extract_postcode(row.get("address")),
                latitude=latitude if has_valid_coordinates else None,
                longitude=longitude if has_valid_coordinates else None,
                place_match_decision=clean_text(result.get("place_match_decision")).lower(),
            )
        )
    return premises


def build_merchant_grid(
    merchants: list[SaraMerchant], cell_size: float = 0.002
) -> dict[tuple[int, int], list[SaraMerchant]]:
    """Index merchants in cells large enough for the coordinate threshold."""

    grid: dict[tuple[int, int], list[SaraMerchant]] = {}
    for merchant in merchants:
        key = (
            math.floor(merchant.latitude / cell_size),
            math.floor(merchant.longitude / cell_size),
        )
        grid.setdefault(key, []).append(merchant)
    return grid


def nearby_merchants(
    premise: PriceCatcherPremise,
    grid: dict[tuple[int, int], list[SaraMerchant]],
    cell_size: float = 0.002,
) -> list[SaraMerchant]:
    if not valid_coordinate_pair(premise.latitude, premise.longitude):
        return []
    assert premise.latitude is not None and premise.longitude is not None
    base_key = (
        math.floor(premise.latitude / cell_size),
        math.floor(premise.longitude / cell_size),
    )
    return [
        merchant
        for latitude_offset in (-1, 0, 1)
        for longitude_offset in (-1, 0, 1)
        for merchant in grid.get(
            (base_key[0] + latitude_offset, base_key[1] + longitude_offset), []
        )
    ]


def evaluate_candidate(
    premise: PriceCatcherPremise,
    merchant: SaraMerchant,
    distance_threshold_meters: float,
) -> SaraCandidateEvaluation:
    assert premise.latitude is not None and premise.longitude is not None
    distance = haversine_meters(
        premise.latitude,
        premise.longitude,
        merchant.latitude,
        merchant.longitude,
    )
    (
        score,
        shared_name_token_count,
        matched_brand_token_count,
        brand_token_count,
    ) = name_overlap_details(
        premise.name,
        merchant.name,
        f"{premise.address} {premise.district} {premise.state}",
    )
    pricecatcher_chain_key = canonical_chain_key(premise.name)
    sara_chain_key = canonical_chain_key(merchant.name)
    chain_key_match = bool(
        pricecatcher_chain_key
        and sara_chain_key
        and pricecatcher_chain_key == sara_chain_key
    )
    postcode_match = bool(
        premise.postal_code
        and merchant.postal_code
        and premise.postal_code == merchant.postal_code
    )
    both_postcodes_present = bool(premise.postal_code and merchant.postal_code)
    rejection_reasons: list[str] = []
    if distance > distance_threshold_meters:
        rejection_reasons.append("coordinate_distance_exceeds_threshold")
    if score < MIN_NAME_SCORE:
        rejection_reasons.append("name_score_below_threshold")
    if shared_name_token_count < MIN_SHARED_NAME_TOKENS:
        rejection_reasons.append("fewer_than_two_name_tokens_matched")
    if matched_brand_token_count < 1:
        rejection_reasons.append("no_non_location_brand_token_matched")
    if brand_token_count >= 2 and matched_brand_token_count < 2:
        rejection_reasons.append("not_enough_brand_tokens_matched")
    if both_postcodes_present and not postcode_match:
        rejection_reasons.append("postcode_mismatch")
    if not both_postcodes_present:
        if score < MIN_NAME_SCORE_WITHOUT_POSTCODE:
            rejection_reasons.append("missing_postcode_name_score_below_threshold")
        if not states_compatible(premise.state, merchant.state):
            rejection_reasons.append("state_mismatch")
    return SaraCandidateEvaluation(
        merchant=merchant,
        distance_meters=distance,
        name_score=score,
        shared_name_token_count=shared_name_token_count,
        matched_brand_token_count=matched_brand_token_count,
        brand_token_count=brand_token_count,
        pricecatcher_chain_key=pricecatcher_chain_key,
        sara_chain_key=sara_chain_key,
        chain_key_match=chain_key_match,
        postcode_match=postcode_match,
        passed_rules=not rejection_reasons,
        rejection_reasons=tuple(rejection_reasons),
    )


def candidate_rank_key(
    evaluation: SaraCandidateEvaluation,
) -> tuple[bool, bool, bool, float, int, int, float, str]:
    """Prefer rule-passing, identity-consistent candidates over mere proximity."""

    return (
        evaluation.passed_rules,
        evaluation.chain_key_match,
        evaluation.postcode_match,
        evaluation.name_score,
        evaluation.matched_brand_token_count,
        evaluation.shared_name_token_count,
        -evaluation.distance_meters,
        evaluation.merchant.source_id,
    )


def evaluate_nearby_candidates(
    premise: PriceCatcherPremise,
    grid: dict[tuple[int, int], list[SaraMerchant]],
    distance_threshold_meters: float,
) -> list[SaraCandidateEvaluation]:
    if not valid_coordinate_pair(premise.latitude, premise.longitude):
        return []
    return [
        evaluation
        for merchant in nearby_merchants(premise, grid)
        for evaluation in [
            evaluate_candidate(premise, merchant, distance_threshold_meters)
        ]
        if evaluation.distance_meters <= distance_threshold_meters
    ]


def match_premises(
    premises: list[PriceCatcherPremise],
    merchants: list[SaraMerchant],
    distance_threshold_meters: float = DEFAULT_DISTANCE_THRESHOLD_METERS,
) -> list[SaraMatch]:
    if distance_threshold_meters <= 0:
        raise ValueError("distance threshold must be positive")

    # A 0.002-degree cell is roughly 220 metres in Malaysia. Looking in the
    # surrounding 3x3 cells avoids a quadratic comparison while preserving all
    # candidates inside the 150-metre default radius.
    grid = build_merchant_grid(merchants)

    matches: list[SaraMatch] = []
    for premise in premises:
        if (
            premise.place_match_decision != "accepted"
            or not valid_coordinate_pair(premise.latitude, premise.longitude)
        ):
            continue
        candidates = [
            evaluation
            for evaluation in evaluate_nearby_candidates(
                premise, grid, distance_threshold_meters
            )
            if evaluation.passed_rules
        ]
        if candidates:
            best = max(candidates, key=candidate_rank_key)
            matches.append(
                SaraMatch(
                    premise_code=premise.premise_code,
                    source_id=best.merchant.source_id,
                    distance_meters=best.distance_meters,
                    name_score=best.name_score,
                    shared_name_token_count=best.shared_name_token_count,
                    matched_brand_token_count=best.matched_brand_token_count,
                    postcode_match=best.postcode_match,
                )
            )
    return matches


def write_match_audit(
    path: Path,
    premises: list[PriceCatcherPremise],
    merchants: list[SaraMerchant],
    matches: list[SaraMatch],
    distance_threshold_meters: float,
) -> dict[str, int]:
    """Write one inspectable JSON record for every loaded PriceCatcher premise."""

    grid = build_merchant_grid(merchants)
    match_by_premise = {match.premise_code: match for match in matches}
    records: list[dict[str, object]] = []
    for premise in premises:
        match = match_by_premise.get(premise.premise_code)
        has_coordinates = valid_coordinate_pair(premise.latitude, premise.longitude)
        evaluations = evaluate_nearby_candidates(
            premise, grid, distance_threshold_meters
        )
        best_evaluation = (
            max(evaluations, key=candidate_rank_key) if evaluations else None
        )
        merchant = best_evaluation.merchant if best_evaluation else None
        if match and merchant and best_evaluation and best_evaluation.passed_rules:
            match_status = "matched"
        elif premise.place_match_decision != "accepted":
            match_status = "no_accepted_place_coordinate"
        elif not has_coordinates:
            match_status = "no_pricecatcher_coordinate"
        elif best_evaluation:
            match_status = "candidate_did_not_pass_rules"
        else:
            match_status = "no_candidate_within_coordinate_threshold"

        records.append(
            {
                "pricecatcher_premise": {
                    "premise_code": premise.premise_code,
                    "premise_name": premise.name,
                    "address": premise.address,
                    "district": premise.district,
                    "state": premise.state,
                    "postal_code": premise.postal_code,
                    "latitude": premise.latitude,
                    "longitude": premise.longitude,
                    "place_match_decision": premise.place_match_decision,
                },
                "match_status": match_status,
                "match_evidence": (
                    {
                        "distance_meters": round(
                            best_evaluation.distance_meters, 3
                        ),
                        "name_score": round(best_evaluation.name_score, 4),
                        "shared_name_token_count": (
                            best_evaluation.shared_name_token_count
                        ),
                        "matched_brand_token_count": (
                            best_evaluation.matched_brand_token_count
                        ),
                        "brand_token_count": best_evaluation.brand_token_count,
                        "pricecatcher_chain_key": (
                            best_evaluation.pricecatcher_chain_key
                        ),
                        "sara_chain_key": best_evaluation.sara_chain_key,
                        "chain_key_match": best_evaluation.chain_key_match,
                        "postcode_match": best_evaluation.postcode_match,
                        "passed_rules": best_evaluation.passed_rules,
                        "rejection_reasons": list(
                            best_evaluation.rejection_reasons
                        ),
                        "distance_threshold_meters": distance_threshold_meters,
                    }
                    if best_evaluation
                    else None
                ),
                "matched_sara_candidate": (
                    {
                        "source_id": merchant.source_id,
                        "trading_name": merchant.name,
                        "address": merchant.address,
                        "city": merchant.city,
                        "state": merchant.state,
                        "postal_code": merchant.postal_code,
                        "latitude": merchant.latitude,
                        "longitude": merchant.longitude,
                    }
                    if merchant
                    else None
                ),
            }
        )

    summary = {
        "pricecatcher_premises": len(premises),
        "premises_with_accepted_place_coordinates": sum(
            premise.place_match_decision == "accepted"
            and valid_coordinate_pair(premise.latitude, premise.longitude)
            for premise in premises
        ),
        "premises_with_candidate_within_coordinate_threshold": sum(
            record["matched_sara_candidate"] is not None for record in records
        ),
        "matched": len(matches),
        "unmatched": len(premises) - len(matches),
    }
    body = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "matching": {
            "distance_threshold_meters": distance_threshold_meters,
            "name_rule": (
                "fuzzy PriceCatcher meaningful-name token coverage >= 0.75, "
                "at least 2 matched tokens, token similarity >= 0.8, and at "
                "least 1 matched non-location brand token"
            ),
            "postcode_rule": "exact match required when both postcodes are present",
            "missing_postcode_rule": "name score >= 0.9 and state agreement",
            "place_rule": "only accepted PriceCatcher Place candidates are eligible",
        },
        "summary": summary,
        "records": records,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(body, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


def apply_sara_verified(
    connection: psycopg.Connection, matches: list[SaraMatch]
) -> dict[str, int]:
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TEMP TABLE stage_sara_verified (
                premise_code TEXT PRIMARY KEY,
                distance_meters DOUBLE PRECISION NOT NULL,
                name_score DOUBLE PRECISION NOT NULL,
                postcode_match BOOLEAN NOT NULL
            ) ON COMMIT DROP;
            """
        )
        cursor.executemany(
            """
            INSERT INTO stage_sara_verified
                (premise_code, distance_meters, name_score, postcode_match)
            VALUES (%s, %s, %s, %s)
            """,
            [
                (
                    match.premise_code,
                    match.distance_meters,
                    match.name_score,
                    match.postcode_match,
                )
                for match in matches
            ],
        )
        cursor.execute(
            """
            UPDATE premise AS p
            SET sara_partner = TRUE
            FROM stage_sara_verified AS s
            WHERE p.premise_code = s.premise_code
              AND p.sara_partner IS DISTINCT FROM TRUE
            """
        )
        rows_updated = cursor.rowcount
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM stage_sara_verified AS s
            LEFT JOIN premise AS p ON p.premise_code = s.premise_code
            WHERE p.premise_id IS NULL
            """
        )
        matches_without_database_premise = cursor.fetchone()[0]
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM stage_sara_verified AS s
            JOIN premise AS p ON p.premise_code = s.premise_code
            WHERE p.sara_partner IS TRUE
            """
        )
        verified_after_update = cursor.fetchone()[0]
    return {
        "premise_rows_updated": rows_updated,
        "matches_without_database_premise": matches_without_database_premise,
        "matched_premises_verified_after_update": verified_after_update,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="PostgreSQL URL; defaults to DATABASE_URL")
    parser.add_argument("--sara", type=Path, default=SARA_MERCHANT_PATH)
    parser.add_argument("--premises", type=Path, default=PRICECATCHER_PREMISE_PATH)
    parser.add_argument("--coordinates", type=Path, default=PRICECATCHER_COORDINATE_PATH)
    parser.add_argument(
        "--output",
        type=Path,
        default=SARA_MATCH_AUDIT_PATH,
        help="JSON audit output containing all PriceCatcher premises",
    )
    parser.add_argument(
        "--distance-threshold-meters",
        type=float,
        default=DEFAULT_DISTANCE_THRESHOLD_METERS,
        help="Maximum SARA/PriceCatcher coordinate distance (default: 150)",
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Validate and report matches without changing PostgreSQL",
    )
    return parser.parse_args()


def main() -> int:
    load_local_env(ROOT / ".env")
    args = parse_args()
    merchants = load_sara_merchants(args.sara)
    premises = load_pricecatcher_premises(args.premises, args.coordinates)
    matches = match_premises(
        premises,
        merchants,
        distance_threshold_meters=args.distance_threshold_meters,
    )
    audit_summary = write_match_audit(
        args.output,
        premises,
        merchants,
        matches,
        args.distance_threshold_meters,
    )
    usable_premises = [
        premise
        for premise in premises
        if premise.place_match_decision == "accepted"
        and valid_coordinate_pair(premise.latitude, premise.longitude)
    ]
    print(f"SARA merchants with usable coordinates: {len(merchants):,}")
    print(f"PriceCatcher premises: {len(premises):,}")
    print(f"PriceCatcher premises with accepted Place coordinates: {len(usable_premises):,}")
    print(f"Coordinate/name/postcode matches: {len(matches):,}")
    print(f"Audit JSON: {args.output}")
    if matches:
        print(
            "Match distance range: "
            f"{min(item.distance_meters for item in matches):.1f}m - "
            f"{max(item.distance_meters for item in matches):.1f}m"
        )
        print(
            "Exact postcode matches: "
            f"{sum(item.postcode_match for item in matches):,}/{len(matches):,}"
        )
    if args.prepare_only:
        print(
            "Prepare-only run complete; PostgreSQL was not changed. "
            f"Audit records written: {audit_summary['pricecatcher_premises']:,}."
        )
        return 0

    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy database/.env or pass --database-url."
        )
    target = urlparse(database_url)
    print(
        "Database target: "
        f"{target.hostname or '<unknown>'}/{target.path.lstrip('/') or '<unknown>'}"
    )
    print("Applying verified SARA status to PostgreSQL")
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        result = apply_sara_verified(connection, matches)
    for key, value in result.items():
        print(f"  {key}: {value:,}")
    print("Verified SARA migration complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
