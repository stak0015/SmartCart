"""Geocode the official Malaysian postcode dictionary into a raw cache.

This creates approximate postcode-area coordinates for search biasing. It does
not create premise coordinates and does not write to PostgreSQL. The output is
raw Google-derived data and must remain outside Git and be expired according to
the project's temporary-coordinate policy.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


POSTCODE_SOURCE_URL = "https://storage.data.gov.my/dictionaries/postcodes.csv"
GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"


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


def api_key() -> str:
    names = ("GOOGLE_GEOCODING_API_KEY", "GOOGLE_MAPS_API_KEY", "GOOGLE_PLACES_API_KEY")
    for name in names:
        if os.environ.get(name, "").strip():
            return os.environ[name].strip()
    root = Path(__file__).resolve().parent
    for env_path in (root / ".env", root.parent / "backend" / ".env"):
        values = read_env_file(env_path)
        for name in names:
            if values.get(name):
                return values[name]
    raise RuntimeError("No Google geocoding-compatible API key was found")


def download_postcodes() -> list[dict[str, str]]:
    request = Request(
        POSTCODE_SOURCE_URL,
        headers={"Accept": "text/csv", "User-Agent": "SmartCart-postcode-geocoder/1.0"},
    )
    with urlopen(request, timeout=60) as response:
        content = response.read().decode("utf-8-sig")
    unique: dict[str, dict[str, str]] = {}
    for row in csv.DictReader(content.splitlines()):
        postcode = str(row.get("postcode", "")).strip()
        if len(postcode) != 5 or not postcode.isdigit():
            continue
        unique.setdefault(
            postcode,
            {
                "postcode": postcode,
                "city": str(row.get("city", "")).strip(),
                "state": str(row.get("state", "")).strip(),
            },
        )
    return [unique[key] for key in sorted(unique)]


def geocode(api_key_value: str, row: dict[str, str]) -> dict:
    address = ", ".join(
        value for value in (row["postcode"], row["city"], row["state"], "Malaysia") if value
    )
    query = urlencode(
        {
            "address": address,
            "components": f"country:MY|postal_code:{row['postcode']}",
            "region": "my",
            "key": api_key_value,
        }
    )
    request = Request(
        f"{GEOCODING_URL}?{query}",
        headers={"Accept": "application/json", "User-Agent": "SmartCart-postcode-geocoder/1.0"},
    )
    with urlopen(request, timeout=45) as response:
        body = json.loads(response.read().decode("utf-8"))
    status = str(body.get("status", "UNKNOWN"))
    result = body.get("results")
    first = result[0] if isinstance(result, list) and result else {}
    geometry = first.get("geometry") if isinstance(first, dict) else {}
    location = geometry.get("location") if isinstance(geometry, dict) else {}
    return {
        **row,
        "query": address,
        "geocoding_status": status,
        "error_message": body.get("error_message"),
        "latitude": location.get("lat"),
        "longitude": location.get("lng"),
        "location_type": geometry.get("location_type") if isinstance(geometry, dict) else None,
        "formatted_address": first.get("formatted_address") if isinstance(first, dict) else None,
        "google_place_id": first.get("place_id") if isinstance(first, dict) else None,
        "partial_match": first.get("partial_match") if isinstance(first, dict) else None,
    }


def load_existing(output_path: Path) -> dict[str, dict]:
    if not output_path.is_file():
        return {}
    try:
        document = json.loads(output_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    results = document.get("results") if isinstance(document, dict) else None
    if not isinstance(results, list):
        return {}
    return {
        str(item.get("postcode")): item
        for item in results
        if isinstance(item, dict) and item.get("postcode")
    }


def write_output(output_path: Path, source_rows: list[dict[str, str]], results: dict[str, dict], started_at: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ordered = [results[row["postcode"]] for row in source_rows if row["postcode"] in results]
    document = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "started_at": started_at,
        "source": {
            "url": POSTCODE_SOURCE_URL,
            "unique_postcodes": len(source_rows),
        },
        "geocoding": {
            "endpoint": GEOCODING_URL,
            "query_form": "postcode, city, state, Malaysia with country and postcode components",
            "coordinates_are_postcode_area_representatives": True,
            "not_premise_coordinates": True,
            "temporary_cache_max_age_days": 29,
        },
        "run": {
            "completed_results": len(ordered),
            "successful_results": sum(item.get("geocoding_status") == "OK" for item in ordered),
            "zero_results": sum(item.get("geocoding_status") == "ZERO_RESULTS" for item in ordered),
            "other_statuses": sum(item.get("geocoding_status") not in {"OK", "ZERO_RESULTS"} for item in ordered),
        },
        "results": ordered,
    }
    output_path.write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8")


def run(
    output_path: Path,
    requests_per_minute: int,
    limit: int | None,
    requested_postcode: str | None = None,
) -> None:
    if requests_per_minute < 1:
        raise SystemExit("--requests-per-minute must be positive")
    rows = download_postcodes()
    if requested_postcode:
        rows = [row for row in rows if row["postcode"] == requested_postcode]
        if not rows:
            raise SystemExit(f"Postcode not found in the official dictionary: {requested_postcode}")
    if limit is not None:
        rows = rows[:limit]
    key = api_key()
    results = load_existing(output_path)
    interval = 60.0 / requests_per_minute
    next_request_at = 0.0
    started_at = datetime.now(timezone.utc).isoformat()

    for index, row in enumerate(rows, start=1):
        if row["postcode"] in results:
            continue
        delay = next_request_at - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        next_request_at = time.monotonic() + interval
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                result = geocode(key, row)
                break
            except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
                last_error = error
                if attempt < 2:
                    time.sleep(2 ** attempt)
        else:
            result = {
                **row,
                "query": ", ".join(value for value in (row["postcode"], row["city"], row["state"], "Malaysia") if value),
                "geocoding_status": "REQUEST_ERROR",
                "error_message": None,
                "error": str(last_error),
                "latitude": None,
                "longitude": None,
                "location_type": None,
                "formatted_address": None,
                "google_place_id": None,
                "partial_match": None,
            }
        results[row["postcode"]] = result
        write_output(output_path, rows, results, started_at)
        if index == 1 or index % 50 == 0 or index == len(rows):
            print(f"[{index}/{len(rows)}] {row['postcode']} {result['geocoding_status']}", flush=True)
    write_output(output_path, rows, results, started_at)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "raw" / "malaysia_postcode_coordinates.json",
    )
    parser.add_argument("--requests-per-minute", type=int, default=300)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--postcode", type=str, default=None)
    args = parser.parse_args()
    requested_postcode = args.postcode.strip() if args.postcode else None
    run(args.output, args.requests_per_minute, args.limit, requested_postcode)


if __name__ == "__main__":
    main()
