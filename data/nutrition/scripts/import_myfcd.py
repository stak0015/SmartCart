"""Fetch and normalize the Malaysian Food Composition Database (MyFCD).

MyFCD publishes separate current and 1997 modules but they are one Malaysian
government source.  The importer keeps the edition and original record ID so
the two namespaces are never joined accidentally.

Usage from the repository root::

    python research/nutrition_coverage/import_myfcd.py --fetch
    python research/nutrition_coverage/import_myfcd.py

The fetch option downloads the two public listing pages and each linked detail
page into compact JSONL evidence files under ``raw``.  The normalizer can then
be run offline, which makes the generated file reproducible and auditable.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


def _research_root() -> Path:
    """Return the repository research directory for tracked-script runs."""
    script_dir = Path(__file__).resolve().parent
    for candidate in (script_dir, *script_dir.parents):
        research = candidate / "research" / "nutrition_coverage"
        if research.is_dir():
            return research
    # Keep the script usable when copied outside the repository.
    return script_dir


ROOT = _research_root()
RAW_DIR = ROOT / "raw"
OUTPUT_PATH = ROOT / "myfcd_foods.json"
SOURCE_URL = "https://myfcd.moh.gov.my/"
LISTINGS = {
    "current": "https://myfcd.moh.gov.my/myfcdcurrent/",
    "1997": "https://myfcd.moh.gov.my/myfcd97/",
}
DETAIL_TEMPLATES = {
    "current": "https://myfcd.moh.gov.my/myfcdcurrent/index.php/site/detail_product/{id}/0/10/-1/0/0/",
    "1997": "https://myfcd.moh.gov.my/myfcd97/index.php/site/detail_product/{id}/0/10/-1/0/0/",
}
API_TEMPLATES = {
    "current": "https://myfcd.moh.gov.my/myfcdcurrent/index.php/ajax/datatable_data",
    "1997": "https://myfcd.moh.gov.my/myfcd97/index.php/ajax/datatable_data",
}
MINIMUM_FIELDS = ("energy_kcal", "protein_g", "fat_g", "carbohydrate_g")


class TableParser(HTMLParser):
    """Collect table rows and select options from a MyFCD HTML page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._option_value: str | None = None
        self.options: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []
        elif tag == "option":
            self._option_value = attrs_dict.get("value") or ""
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(clean_text("".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None
        elif tag == "option" and self._option_value is not None:
            self.options.append({"id": self._option_value, "name": clean_text("".join(self._cell or []))})
            self._option_value = None
            self._cell = None


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def fetch(url: str, retries: int = 3) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "SmartCart nutrition research importer/1.0"},
    )
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception as exc:  # network errors are retried with backoff
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Unable to fetch {url}: {last_error}") from last_error


def fetch_listing_data(url: str, retries: int = 3) -> str:
    """Fetch the same complete JSON catalog used by the site's DataTables UI."""
    form_data = urllib.parse.urlencode(
        {
            "postData[start]": "0",
            "postData[length]": "-1",
            "postData[my_food_group]": "0",
            "postData[my_manufacturer]": "0",
        }
    ).encode("ascii")
    request = urllib.request.Request(
        url,
        data=form_data,
        headers={
            "User-Agent": "SmartCart nutrition research importer/1.0",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception as exc:
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Unable to fetch {url}: {last_error}") from last_error


def parse_api_listing(edition: str, text: str) -> list[dict[str, str]]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid MyFCD {edition} listing JSON") from exc
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ValueError(f"No data array found in MyFCD {edition} listing JSON")
    catalog_pattern = r"^R\d{6}$" if edition == "current" else r"^\d{6}$"
    records = [
        {"id": str(row[0]), "name": clean_text(str(row[1]))}
        for row in rows
        if isinstance(row, list)
        and len(row) >= 2
        and re.fullmatch(catalog_pattern, str(row[0]))
    ]
    if not records:
        raise ValueError(f"No records found in MyFCD {edition} listing JSON")
    return records


def parse_listing(edition: str, text: str) -> list[dict[str, str]]:
    parser = TableParser()
    parser.feed(text)
    # The hidden comparison select contains every record, even though the
    # visible DataTables grid starts with ten rows.
    # The page also contains nutrient and food-group selects.  The catalog
    # IDs are stable and namespaced by edition, so filter those options out
    # instead of accidentally requesting a detail page for a filter value.
    catalog_pattern = r"^R\d{6}$" if edition == "current" else r"^\d{6}$"
    records = [
        row
        for row in parser.options
        if row["id"] and re.fullmatch(catalog_pattern, row["id"])
    ]
    if not records:
        raise ValueError(f"No records found in MyFCD {edition} listing")
    return records


def parse_detail(edition: str, record: dict[str, str], text: str) -> dict[str, Any]:
    parser = TableParser()
    parser.feed(text)
    rows = parser.rows
    source = None
    published_date = None
    food_group = None
    basis = "per_100g"
    nutrient_rows: list[dict[str, Any]] = []
    for row in rows:
        if len(row) >= 3 and row[0] == "Source":
            source = row[-1]
            continue
        if len(row) >= 3 and row[0] == "Published Date":
            published_date = row[-1]
            continue
        if row and row[0] == "Food Group" and len(row) >= 3:
            food_group = row[2]
            continue
        if len(row) >= 3 and row[0] == "Nutrient":
            header = " ".join(row)
            if re.search(r"100\s*ml", header, flags=re.I):
                basis = "per_100ml"
            elif re.search(r"100\s*g", header, flags=re.I):
                basis = "per_100g"
            continue
        if len(row) < 3 or row[0] in {"Proximates", "Minerals", "Vitamins", "Amino acids", "Fatty acids"}:
            continue
        # A detail row is [name, unit, value per basis, optional serving value].
        # Preserve the raw strings; numeric conversion is performed without
        # filling or deriving missing values.
        nutrient_rows.append(
            {
                "name": row[0],
                "unit": row[1],
                "value": row[2] or None,
                "serving_value": row[3] if len(row) >= 4 and row[3] else None,
            }
        )
    return {
        "catalog_id": record["id"],
        "description": record["name"],
        "edition": edition,
        "source_url": DETAIL_TEMPLATES[edition].format(id=record["id"]),
        "source": source or "Institute for Medical Research, Malaysia",
        "published_date": published_date,
        "food_group": food_group,
        "basis": basis,
        "nutrient_rows": nutrient_rows,
    }


def fetch_raw(delay: float = 0.05) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    for edition, listing_url in LISTINGS.items():
        listing_text = fetch(listing_url)
        (RAW_DIR / f"myfcd_{edition}_listing.html").write_text(listing_text, encoding="utf-8")
        api_text = fetch_listing_data(API_TEMPLATES[edition])
        (RAW_DIR / f"myfcd_{edition}_listing.json").write_text(api_text, encoding="utf-8")
        listing_records = parse_api_listing(edition, api_text)
        output = RAW_DIR / f"myfcd_{edition}_records.jsonl"
        temporary = output.with_suffix(output.suffix + ".part")
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            for index, record in enumerate(listing_records, start=1):
                detail_text = fetch(DETAIL_TEMPLATES[edition].format(id=record["id"]))
                parsed = parse_detail(edition, record, detail_text)
                parsed["retrieved_at"] = retrieved_at
                parsed["listing_url"] = listing_url
                handle.write(json.dumps(parsed, ensure_ascii=False, separators=(",", ":")) + "\n")
                if index % 100 == 0:
                    print(f"Fetched MyFCD {edition}: {index}/{len(listing_records)}")
                time.sleep(delay)
        temporary.replace(output)
        print(f"Saved MyFCD {edition}: {len(listing_records)} records")


def parse_number(raw: Any) -> float | None:
    if raw is None:
        return None
    text = clean_text(str(raw)).replace(",", "")
    if not text or text in {"-", "–", "—", "NA", "N/A", "nd", "ND"}:
        return None
    # Some records display a leading comparison sign. Do not treat a missing
    # value as zero; retain only a directly reported numeric value.
    if text.startswith(("<", ">")):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def nutrient_field(name: str) -> str | None:
    lowered = re.sub(r"[^a-z0-9]+", " ", name.casefold()).strip()
    aliases = {
        "energy": "energy_kcal",
        "protein": "protein_g",
        "fat": "fat_g",
        "carbohydrate": "carbohydrate_g",
        "total dietary fibre": "fibre_g",
        "fibre": "fibre_g",
        "fiber": "fibre_g",
        "sodium na": "sodium_mg",
        "calcium ca": "calcium_mg",
        "iron fe": "iron_mg",
        "potassium k": "potassium_mg",
        "phosphorus p": "phosphorus_mg",
        "total sugars": "sugars_g",
    }
    return aliases.get(lowered)


def read_raw(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}; run with --fetch first")
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {path}:{line_number}") from exc
            if not isinstance(record, dict):
                raise ValueError(f"Record in {path}:{line_number} is not an object")
            records.append(record)
    return records


def record_from_raw(raw: dict[str, Any]) -> dict[str, Any]:
    values: dict[str, float | None] = {field: None for field in MINIMUM_FIELDS}
    provenance: dict[str, str] = {}
    all_rows: list[dict[str, Any]] = []
    for row in raw.get("nutrient_rows") or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        value = parse_number(row.get("value"))
        field = nutrient_field(name)
        all_rows.append({"name": name, "unit": row.get("unit"), "value": value})
        if field is None or value is None:
            continue
        if values.get(field) is None:
            values[field] = value
            provenance[field] = f"MyFCD {raw['edition']} record {raw['catalog_id']} ({name})"
    complete = all(values[field] is not None for field in MINIMUM_FIELDS)
    return {
        "id": f"MYFCD-{raw['edition']}-{raw['catalog_id']}",
        "source": "MYFCD",
        "source_edition": raw["edition"],
        "source_record_id": raw["catalog_id"],
        "description": raw.get("description"),
        "food_group": raw.get("food_group"),
        "basis": raw.get("basis", "per_100g"),
        "source_url": raw.get("source_url"),
        "published_date": raw.get("published_date"),
        "complete_minimum": complete,
        "nutrients": values,
        "nutrient_provenance": provenance,
        "all_reported_nutrients": all_rows,
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_output(retrieved_at: str | None = None) -> dict[str, Any]:
    raw_records = read_raw(RAW_DIR / "myfcd_current_records.jsonl") + read_raw(RAW_DIR / "myfcd_1997_records.jsonl")
    records = [record_from_raw(record) for record in raw_records]
    records.sort(key=lambda row: (row["source_edition"], row["source_record_id"]))
    output_retrieved_at = retrieved_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    output_retrieved_date = output_retrieved_at.split("T", 1)[0]
    source_metadata = [
        {
            "id": "MyFCD-current",
            "name": "Malaysian Food Composition Database (current edition)",
            "publisher": "Ministry of Health Malaysia / Institute for Medical Research",
            "url": SOURCE_URL,
            "license": "Published on a Government of Malaysia public website; no explicit open licence stated. Used for academic, attributed reference only.",
            "retrieved_at": output_retrieved_date,
        },
        {
            "id": "MyFCD-1997",
            "name": "Malaysian Food Composition Database (1997 edition)",
            "publisher": "Ministry of Health Malaysia / Institute for Medical Research",
            "url": SOURCE_URL,
            "license": "Published on a Government of Malaysia public website; no explicit open licence stated. Used for academic, attributed reference only.",
            "retrieved_at": output_retrieved_date,
        },
    ]
    # Also expose the compact sources/foods shape consumed by the catalogue
    # nutrition contract. The rich records collection below remains the audit
    # representation with edition and raw nutrient provenance.
    foods = []
    for record in records:
        source_id = f"MyFCD-{record['source_edition']}"
        food_prefix = "MFC-CUR" if record["source_edition"] == "current" else "MFC-97"
        foods.append(
            {
                "id": f"{food_prefix}-{record['source_record_id']}",
                "source": source_id,
                "source_code": record["source_record_id"],
                "description": record["description"],
                "basis": record["basis"],
                "source_url": record["source_url"],
                "url": record["source_url"],
                "retrieved_at": output_retrieved_date,
                "nutrients": record["nutrients"],
            }
        )
    coverage = {
        "minimum_fields": list(MINIMUM_FIELDS),
        "complete_minimum_count": sum(row["complete_minimum"] for row in records),
        "nutrient_counts": {
            field: sum(row["nutrients"].get(field) is not None for row in records)
            for field in MINIMUM_FIELDS
        },
    }
    provenance = []
    for edition in LISTINGS:
        listing_path = RAW_DIR / f"myfcd_{edition}_listing.html"
        record_path = RAW_DIR / f"myfcd_{edition}_records.jsonl"
        provenance.append(
            {
                "edition": edition,
                "listing_url": LISTINGS[edition],
                "listing_raw": f"raw/{listing_path.name}",
                "listing_sha256": sha256_file(listing_path) if listing_path.exists() else None,
                "api_listing_url": API_TEMPLATES[edition],
                "api_listing_raw": f"raw/myfcd_{edition}_listing.json",
                "api_listing_sha256": sha256_file(RAW_DIR / f"myfcd_{edition}_listing.json"),
                "records_raw": f"raw/{record_path.name}",
                "records_sha256": sha256_file(record_path),
            }
        )
    return {
        "schema_version": "1.0",
        "source": "Malaysian Food Composition Database (MyFCD)",
        "source_url": SOURCE_URL,
        "retrieved_at": output_retrieved_at,
        "sources": source_metadata,
        "foods": foods,
        "basis": "per 100 g or per 100 ml as reported by MyFCD",
        "nutrient_units": {
            "energy_kcal": "kcal",
            "protein_g": "g",
            "fat_g": "g",
            "carbohydrate_g": "g",
            "fibre_g": "g",
            "sugars_g": "g",
            "sodium_mg": "mg",
            "calcium_mg": "mg",
            "iron_mg": "mg",
            "potassium_mg": "mg",
            "phosphorus_mg": "mg",
        },
        "coverage": coverage,
        "provenance": provenance,
        "record_count": len(records),
        "records": records,
    }


def write_output(payload: dict[str, Any], path: Path = OUTPUT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="download current and 1997 MyFCD pages into raw")
    parser.add_argument("--delay", type=float, default=0.05, help="seconds between detail requests")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()
    if args.fetch:
        fetch_raw(delay=max(args.delay, 0.0))
    payload = build_output()
    write_output(payload, args.output)
    print(
        f"Wrote {payload['record_count']} MyFCD records to {args.output} "
        f"({payload['coverage']['complete_minimum_count']} complete minimum records)"
    )


if __name__ == "__main__":
    main()
