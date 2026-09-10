"""Run a small, reviewable PriceCatcher-to-Google Places test.

The script deliberately writes only a raw, ignored JSON artifact. It does not
write PostgreSQL and it does not treat an automated match as independent
verification.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import math
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


GOOGLE_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.businessStatus",
        "places.types",
        "places.googleMapsUri",
        "places.movedPlaceId",
    ]
)
STORE_TYPES = {
    "food_store",
    "grocery_store",
    "hypermarket",
    "market",
    "shopping_mall",
    "store",
    "supermarket",
}
STOPWORDS = {
    "A",
    "AN",
    "AND",
    "AT",
    "BHD",
    "BY",
    "IN",
    "JALAN",
    "JLN",
    "LOT",
    "MALAYSIA",
    "NO",
    "OF",
    "ROAD",
    "SDN",
    "THE",
}


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def google_api_key() -> str:
    for name in ("GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    root = Path(__file__).resolve().parent
    for env_path in (root / ".env", root.parent / "backend" / ".env"):
        values = read_env_file(env_path)
        for name in ("GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY"):
            if values.get(name):
                return values[name]
    raise RuntimeError("No Google Places API key found in the environment or local .env files")


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
    return raw


def normalise_text(value: object) -> str:
    text = unicodedata.normalize("NFKD", clean_text(value)).encode(
        "ascii", "ignore"
    ).decode("ascii")
    return re.sub(r"[^A-Z0-9]+", " ", text.upper()).strip()


def tokens(value: object) -> set[str]:
    return {
        token
        for token in normalise_text(value).split()
        if token not in STOPWORDS and len(token) > 1
    }


def postcode(value: object) -> str:
    matches = re.findall(r"(?<!\d)(\d{5})(?!\d)", clean_text(value))
    return matches[-1] if matches else ""


def overlap_score(source: object, candidate: object) -> float:
    source_tokens = tokens(source)
    candidate_tokens = tokens(candidate)
    if not source_tokens or not candidate_tokens:
        return 0.0
    return round(len(source_tokens & candidate_tokens) / min(
        len(source_tokens), len(candidate_tokens)
    ), 4)


def business_status_label(status: str) -> str:
    value = status.upper()
    if value == "OPERATIONAL":
        return "open"
    if value == "CLOSED_PERMANENTLY":
        return "closed_permanently"
    if value == "CLOSED_TEMPORARILY":
        return "closed_temporarily"
    return "unknown"


def source_rows(
    path: Path,
    limit: int,
    requested_premise_code: str | None = None,
) -> tuple[list[dict[str, str]], int]:
    rows: list[dict[str, str]] = []
    skipped = 0
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            code = normalise_code(row.get("premise_code"))
            name = clean_text(row.get("premise"))
            address = clean_text(row.get("address"))
            if requested_premise_code and code != requested_premise_code:
                continue
            if not code or not name or not address:
                skipped += 1
                continue
            rows.append(
                {
                    "premise_code": code,
                    "premise_name": name,
                    "address": address,
                    "premise_type": clean_text(row.get("premise_type")),
                    "state": clean_text(row.get("state")),
                    "district": clean_text(row.get("district")),
                }
            )
            if len(rows) >= limit:
                break
    return rows, skipped


def query_variants(row: dict[str, str]) -> list[str]:
    full = ", ".join(
        value
        for value in (
            row["premise_name"],
            row["address"],
            row["district"],
            row["state"],
            "Malaysia",
        )
        if value
    )
    return [full]


def request_json(
    api_key: str,
    query: str,
    attempts: int = 3,
    bias_latitude: float | None = None,
    bias_longitude: float | None = None,
    bias_radius_meters: float = 5000.0,
) -> dict:
    payload_value: dict = {
        "textQuery": query,
        "openNow": False,
        "languageCode": "en",
        "regionCode": "my",
        "pageSize": 20,
    }
    if bias_latitude is not None and bias_longitude is not None:
        payload_value["locationBias"] = {
            "circle": {
                "center": {
                    "latitude": bias_latitude,
                    "longitude": bias_longitude,
                },
                "radius": bias_radius_meters,
            }
        }
    payload = json.dumps(payload_value).encode("utf-8")
    request = Request(
        GOOGLE_URL,
        data=payload,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=45) as response:
                value = json.loads(response.read().decode("utf-8"))
            if not isinstance(value, dict):
                raise RuntimeError("Google returned a non-object response")
            return value
        except HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == attempts - 1:
                detail = error.read().decode("utf-8", "replace")[:500]
                raise RuntimeError(f"Google Places returned HTTP {error.code}: {detail}") from error
            time.sleep(2 ** attempt)
        except (URLError, TimeoutError, json.JSONDecodeError, OSError, RuntimeError) as error:
            last_error = error
            if attempt == attempts - 1:
                raise RuntimeError(f"Google Places request failed: {error}") from error
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Google Places request failed: {last_error}")


def evaluate_candidate(row: dict[str, str], place: dict, query: str, rank: int) -> dict:
    display_name = clean_text((place.get("displayName") or {}).get("text"))
    address = clean_text(place.get("formattedAddress"))
    google_postcode = postcode(address)
    source_postcode = postcode(row["address"])
    name_score = overlap_score(row["premise_name"], display_name)
    address_score = overlap_score(row["address"], address)
    postal_match = bool(source_postcode and source_postcode == google_postcode)
    place_types = place.get("types") if isinstance(place.get("types"), list) else []
    type_match = bool(set(place_types) & STORE_TYPES)
    strong_identity = (
        name_score >= 0.5
        and address_score >= 0.45
        and postal_match
    )
    score = round(
        0.45 * name_score
        + 0.35 * address_score
        + 0.15 * float(postal_match)
        + 0.05 * float(type_match),
        4,
    )
    decision = "accepted" if strong_identity else (
        "needs_review" if score >= 0.4 else "rejected"
    )
    location = place.get("location") if isinstance(place.get("location"), dict) else {}
    status = clean_text(place.get("businessStatus"))
    return {
        "query": query,
        "candidate_rank": rank,
        "google_place_id": clean_text(place.get("id")),
        "google_display_name": display_name,
        "google_formatted_address": address,
        "google_latitude": location.get("latitude"),
        "google_longitude": location.get("longitude"),
        "google_business_status": status,
        "open_closed_status": business_status_label(status),
        "google_types": place_types,
        "google_maps_uri": clean_text(place.get("googleMapsUri")),
        "google_moved_place_id": clean_text(place.get("movedPlaceId")),
        "name_score": name_score,
        "address_score": address_score,
        "postcode_match": postal_match,
        "match_score": score,
        "match_decision": decision,
        "automated_identity_check": (
            "strong name/address/postcode agreement"
            if strong_identity
            else "does not meet all automatic identity thresholds"
        ),
    }


def run(
    input_path: Path,
    output_path: Path,
    limit: int,
    delay: float,
    requested_premise_code: str | None = None,
    bias_latitude: float | None = None,
    bias_longitude: float | None = None,
    bias_radius_meters: float = 5000.0,
    query_override: str | None = None,
) -> None:
    api_key = google_api_key()
    rows, skipped = source_rows(input_path, limit, requested_premise_code)
    results: list[dict] = []
    request_count = 0
    errors = 0
    generated_at = datetime.now(timezone.utc).isoformat()

    for index, row in enumerate(rows, start=1):
        print(f"[{index}/{len(rows)}] {row['premise_code']} {row['premise_name']}", flush=True)
        evaluations: dict[str, dict] = {}
        attempted_queries: list[str] = []
        query_errors: list[str] = []
        query_place_ids: dict[str, list[str]] = {}
        queries = [query_override] if query_override else query_variants(row)
        for query in queries:
            attempted_queries.append(query)
            try:
                response = request_json(
                    api_key,
                    query,
                    bias_latitude=bias_latitude,
                    bias_longitude=bias_longitude,
                    bias_radius_meters=bias_radius_meters,
                )
                request_count += 1
            except RuntimeError as error:
                request_count += 1
                query_errors.append(str(error))
                continue
            places = response.get("places") if isinstance(response.get("places"), list) else []
            query_place_ids[query] = [
                clean_text(place.get("id"))
                for place in places
                if isinstance(place, dict) and clean_text(place.get("id"))
            ]
            for rank, place in enumerate(places, start=1):
                if not isinstance(place, dict):
                    continue
                evaluation = evaluate_candidate(row, place, query, rank)
                place_id = evaluation["google_place_id"]
                if not place_id:
                    continue
                previous = evaluations.get(place_id)
                if previous is None or evaluation["match_score"] > previous["match_score"]:
                    evaluations[place_id] = evaluation
            time.sleep(delay)

        candidates = sorted(
            evaluations.values(),
            key=lambda item: (-item["match_score"], item["candidate_rank"]),
        )
        selected = next(
            (item for item in candidates if item["match_decision"] == "accepted"),
            None,
        )
        if selected is None and candidates:
            selected = candidates[0]
        selected_id = selected["google_place_id"] if selected else ""
        query_agreement = None
        if len(query_place_ids) >= 2:
            query_agreement = bool(
                selected_id
                and len(query_place_ids) == len(attempted_queries)
                and all(selected_id in ids for ids in query_place_ids.values())
            )
        candidate_decision = selected["match_decision"] if selected else "no_result"
        verification_decision = candidate_decision
        if candidate_decision == "accepted" and query_agreement is False:
            verification_decision = "needs_review"
        result = {
            "premise_code": row["premise_code"],
            "premise_name": row["premise_name"],
            "premise_address": row["address"],
            "premise_type": row["premise_type"],
            "district": row["district"],
            "state": row["state"],
            "queries_attempted": attempted_queries,
            "query_place_ids": query_place_ids,
            "candidate_match_decision": candidate_decision,
            "cross_query_place_id_agreement": query_agreement,
            "automated_verification": verification_decision,
            "selected_candidate": selected,
            "all_candidates": candidates,
            "query_errors": query_errors,
        }
        results.append(result)
        time.sleep(delay)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "generated_at": generated_at,
        "source": {
            "type": "PriceCatcher premise lookup",
            "input_path": str(input_path.resolve()),
            "records_requested": limit,
            "requested_premise_code": requested_premise_code,
            "records_processed": len(rows),
            "invalid_rows_skipped_before_limit": skipped,
        },
        "google": {
            "endpoint": GOOGLE_URL,
            "field_mask": FIELD_MASK,
            "open_now": False,
            "location_bias_used": bias_latitude is not None and bias_longitude is not None,
            "location_bias": (
                {
                    "latitude": bias_latitude,
                    "longitude": bias_longitude,
                    "radius_meters": bias_radius_meters,
                }
                if bias_latitude is not None and bias_longitude is not None
                else None
            ),
            "max_query_variants_per_premise": 1,
            "query_strategy": "custom query" if query_override else "full address only",
            "cross_query_verification": False,
            "automatic_check_is_not_manual_verification": True,
        },
        "run": {
            "google_requests_attempted": request_count,
            "records_with_query_errors": sum(bool(item["query_errors"]) for item in results),
            "accepted": sum(item["automated_verification"] == "accepted" for item in results),
            "needs_review": sum(item["automated_verification"] == "needs_review" for item in results),
            "rejected": sum(item["automated_verification"] == "rejected" for item in results),
            "no_result": sum(item["automated_verification"] == "no_result" for item in results),
        },
        "results": results,
    }
    output_path.write_text(json.dumps(artifact, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(artifact["run"], indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "raw" / "lookup_premise.csv",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent
        / "data"
        / "raw"
        / "google_place_test_first_50.json",
    )
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--premise-code", type=str, default=None)
    parser.add_argument("--bias-latitude", type=float, default=None)
    parser.add_argument("--bias-longitude", type=float, default=None)
    parser.add_argument("--bias-radius-meters", type=float, default=5000.0)
    parser.add_argument("--query", type=str, default=None)
    parser.add_argument("--delay-seconds", type=float, default=0.1)
    args = parser.parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be positive")
    if args.delay_seconds < 0:
        raise SystemExit("--delay-seconds must not be negative")
    if (args.bias_latitude is None) != (args.bias_longitude is None):
        raise SystemExit("--bias-latitude and --bias-longitude must be supplied together")
    if args.bias_radius_meters <= 0 or args.bias_radius_meters > 50000:
        raise SystemExit("--bias-radius-meters must be between 0 and 50000")
    requested_code = normalise_code(args.premise_code) if args.premise_code else None
    run(
        args.input,
        args.output,
        args.limit,
        args.delay_seconds,
        requested_code,
        args.bias_latitude,
        args.bias_longitude,
        args.bias_radius_meters,
        args.query.strip() if args.query else None,
    )


if __name__ == "__main__":
    main()
