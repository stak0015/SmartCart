"""Enrich the PriceCatcher premise lookup with postcodes and Google Place IDs.

The source lookup rows are preserved and two columns are appended:
``postcode`` and ``place_id``. Existing five-digit postcodes are reused. Google
Geocoding is called only for rows whose address has no five-digit postcode; a
single name-focused Google Places Text Search is then made for each row with a
postcode.

This script writes raw CSV/Parquet/JSON artifacts only. It does not update
PostgreSQL. The cache makes the batch resumable after an interruption.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd


GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_FIELD_MASK = ",".join(
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


def google_key(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    root = Path(__file__).resolve().parent
    for env_path in (root / ".env", root.parent / "backend" / ".env"):
        values = read_env_file(env_path)
        if values.get(name):
            return values[name]
    raise RuntimeError(f"No {name} was found in the environment or local .env files")


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


def overlap_score(source: object, candidate: object) -> float:
    source_tokens = tokens(source)
    candidate_tokens = tokens(candidate)
    if not source_tokens or not candidate_tokens:
        return 0.0
    return round(
        len(source_tokens & candidate_tokens)
        / min(len(source_tokens), len(candidate_tokens)),
        4,
    )


def extract_postcode(value: object) -> str:
    matches = re.findall(r"(?<!\d)(\d{5})(?!\d)", clean_text(value))
    return matches[-1] if matches else ""


def status_label(status: str) -> str:
    value = status.upper()
    if value == "OPERATIONAL":
        return "open"
    if value == "CLOSED_PERMANENTLY":
        return "closed_permanently"
    if value == "CLOSED_TEMPORARILY":
        return "closed_temporarily"
    return "unknown"


def load_source(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = [
            {field: row.get(field, "") or "" for field in fieldnames}
            for row in reader
        ]
    return fieldnames, rows


def request_json(
    request_factory,
    attempts: int = 3,
) -> dict:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = request_factory()
            with urlopen(request, timeout=45) as response:
                value = json.loads(response.read().decode("utf-8"))
            if not isinstance(value, dict):
                raise RuntimeError("Google returned a non-object response")
            return value
        except HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == attempts - 1:
                detail = error.read().decode("utf-8", "replace")[:500]
                raise RuntimeError(
                    f"Google returned HTTP {error.code}: {detail}"
                ) from error
            time.sleep(2**attempt)
        except (URLError, TimeoutError, json.JSONDecodeError, OSError, RuntimeError) as error:
            last_error = error
            if attempt == attempts - 1:
                raise RuntimeError(f"Google request failed: {error}") from error
            time.sleep(2**attempt)
    raise RuntimeError(f"Google request failed: {last_error}")


def geocode_address(api_key: str, row: dict[str, str]) -> dict:
    query = ", ".join(
        value
        for value in (
            clean_text(row.get("premise")),
            clean_text(row.get("address")),
            clean_text(row.get("district")),
            clean_text(row.get("state")),
            "Malaysia",
        )
        if value
    )
    params = urlencode({"address": query, "region": "my", "key": api_key})

    def factory() -> Request:
        return Request(
            f"{GEOCODING_URL}?{params}",
            headers={
                "Accept": "application/json",
                "User-Agent": "SmartCart-premise-enrichment/1.0",
            },
        )

    body = request_json(factory)
    results = body.get("results") if isinstance(body.get("results"), list) else []
    chosen = results[0] if results and isinstance(results[0], dict) else {}
    chosen_postcode = ""
    for result in results:
        if not isinstance(result, dict):
            continue
        components = result.get("address_components")
        if not isinstance(components, list):
            continue
        for component in components:
            if not isinstance(component, dict):
                continue
            types = component.get("types")
            if isinstance(types, list) and "postal_code" in types:
                candidate = extract_postcode(component.get("long_name"))
                if candidate:
                    chosen = result
                    chosen_postcode = candidate
                    break
        if chosen_postcode:
            break
    if not chosen_postcode:
        components = chosen.get("address_components")
        if isinstance(components, list):
            for component in components:
                if not isinstance(component, dict):
                    continue
                types = component.get("types")
                if isinstance(types, list) and "postal_code" in types:
                    chosen_postcode = extract_postcode(component.get("long_name"))
                    if chosen_postcode:
                        break
    geometry = chosen.get("geometry") if isinstance(chosen, dict) else {}
    location = geometry.get("location") if isinstance(geometry, dict) else {}
    return {
        "query": query,
        "status": clean_text(body.get("status")),
        "error_message": clean_text(body.get("error_message")),
        "postcode": chosen_postcode,
        "formatted_address": clean_text(chosen.get("formatted_address")),
        "google_place_id": clean_text(chosen.get("place_id")),
        "partial_match": bool(chosen.get("partial_match")),
        "latitude": location.get("lat") if isinstance(location, dict) else None,
        "longitude": location.get("lng") if isinstance(location, dict) else None,
        "location_type": clean_text(geometry.get("location_type"))
        if isinstance(geometry, dict)
        else "",
    }


def place_query(row: dict[str, str], postcode: str) -> str:
    return ", ".join(
        value
        for value in (
            clean_text(row.get("premise")),
            postcode,
            clean_text(row.get("district")),
            clean_text(row.get("state")),
            "Malaysia",
        )
        if value
    )


def search_places(api_key: str, query: str) -> dict:
    payload = json.dumps(
        {
            "textQuery": query,
            "openNow": False,
            "languageCode": "en",
            "regionCode": "my",
            "pageSize": 20,
        }
    ).encode("utf-8")

    def factory() -> Request:
        return Request(
            PLACES_URL,
            data=payload,
            method="POST",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": PLACES_FIELD_MASK,
            },
        )

    return request_json(factory)


def evaluate_candidate(
    row: dict[str, str],
    target_postcode: str,
    place: dict,
    rank: int,
    query: str,
) -> dict:
    display_name = clean_text((place.get("displayName") or {}).get("text"))
    formatted_address = clean_text(place.get("formattedAddress"))
    google_postcode = extract_postcode(formatted_address)
    name_score = overlap_score(row.get("premise"), display_name)
    address_score = overlap_score(row.get("address"), formatted_address)
    postal_match = bool(target_postcode and google_postcode == target_postcode)
    place_types = place.get("types") if isinstance(place.get("types"), list) else []
    type_match = bool(set(place_types) & STORE_TYPES)
    score = round(
        0.45 * name_score
        + 0.30 * float(postal_match)
        + 0.20 * address_score
        + 0.05 * float(type_match),
        4,
    )
    decision = "accepted" if score >= 0.65 and (postal_match or address_score >= 0.7) else (
        "needs_review" if score >= 0.4 else "rejected"
    )
    location = place.get("location") if isinstance(place.get("location"), dict) else {}
    business_status = clean_text(place.get("businessStatus"))
    return {
        "query": query,
        "candidate_rank": rank,
        "google_place_id": clean_text(place.get("id")),
        "google_display_name": display_name,
        "google_formatted_address": formatted_address,
        "google_postcode": google_postcode,
        "google_latitude": location.get("latitude"),
        "google_longitude": location.get("longitude"),
        "google_business_status": business_status,
        "open_closed_status": status_label(business_status),
        "google_types": place_types,
        "google_maps_uri": clean_text(place.get("googleMapsUri")),
        "google_moved_place_id": clean_text(place.get("movedPlaceId")),
        "name_score": name_score,
        "address_score": address_score,
        "postcode_match": postal_match,
        "match_score": score,
        "match_decision": decision,
    }


def load_cache(path: Path) -> dict[str, dict]:
    if not path.is_file():
        return {}
    try:
        body = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    results = body.get("results") if isinstance(body, dict) else None
    return results if isinstance(results, dict) else {}


def save_cache(path: Path, results: dict[str, dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "results": results,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def write_outputs(
    csv_path: Path,
    parquet_path: Path,
    fieldnames: list[str],
    rows: list[dict[str, str]],
    results: dict[str, dict],
) -> None:
    output_fields = list(fieldnames)
    for extra in ("postcode", "place_id", "open_closed_status"):
        if extra not in output_fields:
            output_fields.append(extra)
    output_rows: list[dict[str, object]] = []
    for index, row in enumerate(rows):
        enrichment = results.get(str(index), {})
        output = {field: row.get(field, "") for field in fieldnames}
        output["postcode"] = enrichment.get("postcode", "")
        output["place_id"] = enrichment.get("place_id", "")
        output["open_closed_status"] = enrichment.get("place_open_closed_status", "")
        output_rows.append(output)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=output_fields)
        writer.writeheader()
        writer.writerows(output_rows)
    pd.DataFrame(output_rows, columns=output_fields).to_parquet(
        parquet_path,
        engine="fastparquet",
        index=False,
    )


def counts(results: dict[str, dict]) -> dict[str, int]:
    values = list(results.values())
    return {
        "rows_processed": len(values),
        "postcode_from_source": sum(item.get("postcode_source") == "source" for item in values),
        "geocoding_attempted": sum(bool(item.get("geocoding_attempted")) for item in values),
        "geocoding_successful": sum(
            bool(item.get("geocoding_attempted")) and bool(item.get("postcode"))
            for item in values
        ),
        "geocoding_without_postcode": sum(
            bool(item.get("geocoding_attempted")) and not bool(item.get("postcode"))
            for item in values
        ),
        "places_attempted": sum(bool(item.get("place_query")) for item in values),
        "place_ids_selected": sum(bool(item.get("place_id")) for item in values),
        "place_matches_accepted": sum(item.get("place_match_decision") == "accepted" for item in values),
        "place_matches_needs_review": sum(item.get("place_match_decision") == "needs_review" for item in values),
        "place_no_result_or_error": sum(
            item.get("place_match_decision") in {"no_result", "error", "not_attempted_no_postcode"}
            for item in values
        ),
    }


def run(
    input_path: Path,
    csv_path: Path,
    parquet_path: Path,
    cache_path: Path,
    provenance_path: Path,
    delay_seconds: float,
    limit: int | None,
    retry_errors: bool,
) -> None:
    fieldnames, all_rows = load_source(input_path)
    rows = all_rows[:limit] if limit is not None else all_rows
    cache = load_cache(cache_path)
    geocoding_key = google_key("GOOGLE_GEOCODING_API_KEY")
    places_key = google_key("GOOGLE_PLACES_API_KEY")
    requests_attempted = 0

    for index, row in enumerate(rows):
        cache_key = str(index)
        cached = cache.get(cache_key)
        if cached is not None:
            cached_failed = (
                cached.get("geocode_status") == "ERROR"
                or cached.get("place_match_decision") == "error"
            )
            if not (retry_errors and cached_failed):
                continue
        code = normalise_code(row.get("premise_code"))
        name = clean_text(row.get("premise"))
        address = clean_text(row.get("address"))
        source_postcode = extract_postcode(address)
        result: dict = {
            "premise_code": code,
            "postcode": source_postcode,
            "postcode_source": "source" if source_postcode else "geocoding",
            "geocoding_attempted": False,
            "geocode_status": "not_needed" if source_postcode else "",
            "geocode_error": "",
            "geocode_partial_match": False,
            "geocode_formatted_address": "",
            "geocode_place_id": "",
            "geocode_latitude": None,
            "geocode_longitude": None,
            "geocode_location_type": "",
            "place_query": "",
            "place_id": "",
            "place_match_decision": "not_attempted_no_name_or_postcode",
            "place_match_score": None,
            "place_name": "",
            "place_formatted_address": "",
            "place_business_status": "",
            "place_open_closed_status": "",
            "place_latitude": None,
            "place_longitude": None,
            "place_candidate_rank": None,
            "place_name_score": None,
            "place_address_score": None,
            "place_postcode_match": False,
            "place_error": "",
        }

        if not source_postcode:
            if name and address:
                try:
                    result["geocoding_attempted"] = True
                    geocode = geocode_address(geocoding_key, row)
                    requests_attempted += 1
                    result["geocode_status"] = geocode["status"] or "ERROR"
                    result["geocode_error"] = geocode["error_message"]
                    result["postcode"] = geocode["postcode"]
                    result["geocode_partial_match"] = geocode["partial_match"]
                    result["geocode_formatted_address"] = geocode["formatted_address"]
                    result["geocode_place_id"] = geocode["google_place_id"]
                    result["geocode_latitude"] = geocode["latitude"]
                    result["geocode_longitude"] = geocode["longitude"]
                    result["geocode_location_type"] = geocode["location_type"]
                except RuntimeError as error:
                    result["geocoding_attempted"] = True
                    requests_attempted += 1
                    result["geocode_status"] = "ERROR"
                    result["geocode_error"] = str(error)
            else:
                result["geocode_status"] = "SKIPPED_INVALID_SOURCE"

        postcode_value = clean_text(result["postcode"])
        if name and postcode_value:
            query = place_query(row, postcode_value)
            result["place_query"] = query
            try:
                response = search_places(places_key, query)
                requests_attempted += 1
                places = response.get("places") if isinstance(response.get("places"), list) else []
                candidates = [
                    evaluate_candidate(row, postcode_value, place, rank, query)
                    for rank, place in enumerate(places, start=1)
                    if isinstance(place, dict) and clean_text(place.get("id"))
                ]
                candidates.sort(key=lambda item: (-item["match_score"], item["candidate_rank"]))
                if candidates:
                    selected = candidates[0]
                    result["place_id"] = selected["google_place_id"]
                    result["place_match_decision"] = selected["match_decision"]
                    result["place_match_score"] = selected["match_score"]
                    result["place_name"] = selected["google_display_name"]
                    result["place_formatted_address"] = selected["google_formatted_address"]
                    result["place_business_status"] = selected["google_business_status"]
                    result["place_open_closed_status"] = selected["open_closed_status"]
                    result["place_latitude"] = selected["google_latitude"]
                    result["place_longitude"] = selected["google_longitude"]
                    result["place_candidate_rank"] = selected["candidate_rank"]
                    result["place_name_score"] = selected["name_score"]
                    result["place_address_score"] = selected["address_score"]
                    result["place_postcode_match"] = selected["postcode_match"]
                else:
                    result["place_match_decision"] = "no_result"
            except RuntimeError as error:
                requests_attempted += 1
                result["place_match_decision"] = "error"
                result["place_error"] = str(error)
        elif not name or not postcode_value:
            result["place_match_decision"] = "not_attempted_no_name_or_postcode"

        cache[cache_key] = result
        save_cache(cache_path, cache)
        if len(cache) % 25 == 0 or len(cache) == len(rows):
            write_outputs(csv_path, parquet_path, fieldnames, rows, cache)
        safe_name = (name or "NO_NAME").encode("ascii", "backslashreplace").decode("ascii")
        print(
            f"[{index + 1}/{len(rows)}] {code or 'NO_CODE'} {safe_name} "
            f"postcode={result['postcode'] or '-'} place_id={result['place_id'] or '-'}",
            flush=True,
        )
        if delay_seconds:
            time.sleep(delay_seconds)

    write_outputs(csv_path, parquet_path, fieldnames, rows, cache)
    document = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "input_path": str(input_path.resolve()),
            "source_columns_preserved": fieldnames,
            "source_rows": len(rows),
            "limit": limit,
        },
        "outputs": {
            "csv": str(csv_path.resolve()),
            "parquet": str(parquet_path.resolve()),
            "cache": str(cache_path.resolve()),
        },
        "geocoding": {
            "endpoint": GEOCODING_URL,
            "used_only_when_source_address_lacked_a_five_digit_postcode": True,
            "query_form": "premise name, address, district, state, Malaysia",
        },
        "places": {
            "endpoint": PLACES_URL,
            "query_form": "premise name, postcode, district, state, Malaysia",
            "location_bias_used": False,
            "field_mask": PLACES_FIELD_MASK,
            "one_request_per_premise_with_a_postcode": True,
            "selected_place_id_is_an_automated_top_candidate": True,
            "manual_verification_not_performed": True,
        },
        "run": {
            **counts(cache),
            "google_requests_attempted": counts(cache)["geocoding_attempted"]
            + counts(cache)["places_attempted"],
            "cache_records": len(cache),
        },
    }
    provenance_path.parent.mkdir(parents=True, exist_ok=True)
    provenance_path.write_text(
        json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(document["run"], indent=2))


def main() -> None:
    root = Path(__file__).resolve().parent
    raw = root / "data" / "raw"
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=raw / "lookup_premise.csv")
    parser.add_argument(
        "--csv-output",
        type=Path,
        default=raw / "lookup_premise_enriched_postcode_place_id.csv",
    )
    parser.add_argument(
        "--parquet-output",
        type=Path,
        default=raw / "lookup_premise_enriched_postcode_place_id.parquet",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=raw / "lookup_premise_enriched_postcode_place_id.cache.json",
    )
    parser.add_argument(
        "--provenance",
        type=Path,
        default=raw / "lookup_premise_enriched_postcode_place_id.provenance.json",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--delay-seconds", type=float, default=0.1)
    parser.add_argument(
        "--retry-errors",
        action="store_true",
        help="retry cached Geocoding or Places records that previously failed",
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be positive")
    if args.delay_seconds < 0:
        raise SystemExit("--delay-seconds must not be negative")
    run(
        args.input,
        args.csv_output,
        args.parquet_output,
        args.cache,
        args.provenance,
        args.delay_seconds,
        args.limit,
        args.retry_errors,
    )


if __name__ == "__main__":
    main()
