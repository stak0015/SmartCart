"""Build current PriceCatcher status from current-year transactions.

By default, initialisation downloads every monthly file from January through
the current Malaysia month, selects the newest observation for each
item-premise pair, and upserts that status into PostgreSQL. A rolling six-month
set of monthly source archives is retained locally after a successful run.

Use ``--month`` without a value for the lighter daily refresh of the growing
current-month file, or supply ``--month YYYY-MM`` for a specific month.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import psycopg


ROOT = Path(__file__).resolve().parent
RAW_DATA_DIR = ROOT / "data" / "raw"
PREMISE_ENRICHMENT_PATH = (
    ROOT
    / "data"
    / "archive"
    / "lookup_premise_sara_one_to_one_2026-08-23.parquet"
)
PRICE_URL_TEMPLATE = (
    "https://storage.data.gov.my/pricecatcher/pricecatcher_{month}.parquet"
)
ITEM_URL = "https://storage.data.gov.my/pricecatcher/lookup_item.parquet"
PREMISE_URL = "https://storage.data.gov.my/pricecatcher/lookup_premise.parquet"
REQUIRED_PRICE_COLUMNS = {"date", "premise_code", "item_code", "price"}
REQUIRED_ITEM_COLUMNS = {
    "item_code",
    "item",
    "unit",
    "item_group",
    "item_category",
}
REQUIRED_PREMISE_COLUMNS = {
    "premise_code",
    "premise",
    "address",
    "district",
    "state",
}
REQUIRED_PREMISE_ENRICHMENT_COLUMNS = {
    "premise_code",
    "google_place_id",
    "google_place_match_status",
    "sara_match_status",
    "sara_review_decision",
}
PREMISE_DATABASE_ENRICHMENT_COLUMNS = [
    "google_place_id",
    "place_match_refreshed_at",
    "sara_match_candidate",
]

# US 3.2 ingest-time pack-quantity parsing (D3.2-A). The unit column carries
# the package size for most items (e.g. "10 kg"); the item name is only a
# fallback. Values are stored in the base unit (kg / litre) so pack ratios are
# directly comparable within a unit family. Unparseable rows stay NULL, which
# downstream code treats as "not comparable".
PACK_MULTIPACK_TOKEN = re.compile(
    r"(\d+)\s?[xX]\s?(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|litre|liter)\b",
    re.IGNORECASE,
)
PACK_UNIT_QTY_TOKEN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|litre|liter)\b",
    re.IGNORECASE,
)


def parse_pack_quantity(
    item_name: object, unit: object
) -> tuple[float, str] | None:
    """Return (quantity in base unit, 'KG'|'L') or None when not comparable."""

    for text in (unit, item_name):
        if not isinstance(text, str) or not text.strip():
            continue
        multipack = PACK_MULTIPACK_TOKEN.search(text)
        if multipack:
            total = float(multipack.group(1)) * float(multipack.group(2))
            kind = multipack.group(3).lower()
        else:
            single = PACK_UNIT_QTY_TOKEN.search(text)
            if not single:
                continue
            total = float(single.group(1))
            kind = single.group(2).lower()
        if kind in ("g", "gm"):
            return total / 1000.0, "KG"
        if kind == "ml":
            return total / 1000.0, "L"
        if kind == "kg":
            return total, "KG"
        return total, "L"
    return None


@dataclass(frozen=True)
class PreparedData:
    items: pd.DataFrame
    premises: pd.DataFrame
    statuses: pd.DataFrame
    source_price_rows: int
    source_min_date: str
    source_max_date: str
    unmatched_item_code_values: frozenset[str]
    unmatched_premise_code_values: frozenset[str]
    skipped_price_rows: int

    @property
    def unmatched_item_codes(self) -> int:
        return len(self.unmatched_item_code_values)

    @property
    def unmatched_premise_codes(self) -> int:
        return len(self.unmatched_premise_code_values)


def malaysia_current_month() -> str:
    malaysia_time = datetime.now(timezone(timedelta(hours=8)))
    return malaysia_time.strftime("%Y-%m")


def malaysia_current_year() -> int:
    return int(malaysia_current_month()[:4])


def months_for_year(year: int, current_month: str | None = None) -> list[str]:
    """Return published month labels for a year up to the current month."""
    current = current_month or malaysia_current_month()
    current_year = int(current[:4])
    current_month_number = int(current[5:])
    if year > current_year:
        raise ValueError("year cannot be in the future")
    end_month = current_month_number if year == current_year else 12
    return [f"{year}-{month:02d}" for month in range(1, end_month + 1)]


def retained_months(reference_month: str, count: int) -> set[str]:
    if count < 1:
        raise ValueError("retained archive count must be at least 1")
    year, month = (int(part) for part in reference_month.split("-"))
    retained: set[str] = set()
    for _ in range(count):
        retained.add(f"{year}-{month:02d}")
        month -= 1
        if month == 0:
            year -= 1
            month = 12
    return retained


def load_local_env(path: Path) -> None:
    """Load simple KEY=VALUE entries without overriding the process environment."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def validate_month(value: str) -> str:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        raise argparse.ArgumentTypeError("month must use YYYY-MM format")
    return value


def validate_year(value: str) -> int:
    if not re.fullmatch(r"\d{4}", value):
        raise argparse.ArgumentTypeError("year must use YYYY format")
    year = int(value)
    if year < 2020:
        raise argparse.ArgumentTypeError("year is outside the supported range")
    return year


def download_file(url: str, destination: Path, use_cache: bool) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if use_cache and destination.exists() and destination.stat().st_size > 0:
        print(f"Using cached {destination.name}")
        return destination

    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "SmartCart-PriceCatcher-Ingestion/1.0"},
    )
    print(f"Downloading {url}")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            with temporary.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
        if temporary.stat().st_size == 0:
            raise RuntimeError(f"downloaded file is empty: {url}")
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return destination


def require_columns(frame: pd.DataFrame, required: set[str], label: str) -> None:
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"{label} is missing required columns: {missing}")


def normalise_code(series: pd.Series, label: str) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    invalid_fractional = numeric.notna() & (numeric % 1 != 0)
    if invalid_fractional.any():
        examples = series.loc[invalid_fractional].head(5).tolist()
        raise ValueError(f"{label} contains non-integer codes: {examples}")
    return numeric.astype("Int64").astype("string")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def load_premise_enrichment(path: Path) -> pd.DataFrame:
    """Load and validate the committed, dated premise-enrichment snapshot."""
    provenance_path = path.with_name(f"{path.stem}_provenance.json")
    if not path.is_file():
        raise FileNotFoundError(f"premise enrichment snapshot not found: {path}")
    if not provenance_path.is_file():
        raise FileNotFoundError(
            f"premise enrichment provenance not found: {provenance_path}"
        )

    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    expected_hash = provenance.get("archive_sha256")
    actual_hash = sha256_file(path)
    if not expected_hash or actual_hash != expected_hash:
        raise ValueError("premise enrichment snapshot SHA-256 does not match provenance")

    generated_at = pd.to_datetime(
        provenance.get("generated_at"), errors="raise", utc=True
    )
    enrichment = pd.read_parquet(path, engine="fastparquet")
    require_columns(
        enrichment,
        REQUIRED_PREMISE_ENRICHMENT_COLUMNS,
        "premise enrichment snapshot",
    )
    enrichment = enrichment.loc[
        :, sorted(REQUIRED_PREMISE_ENRICHMENT_COLUMNS)
    ].copy()
    enrichment["premise_code"] = normalise_code(
        enrichment["premise_code"], "premise enrichment premise_code"
    )
    enrichment = enrichment.dropna(subset=["premise_code"])
    if enrichment["premise_code"].duplicated().any():
        raise ValueError("premise enrichment contains duplicate premise_code values")

    for column in (
        "google_place_id",
        "google_place_match_status",
        "sara_match_status",
        "sara_review_decision",
    ):
        enrichment[column] = enrichment[column].astype("string").str.strip()
        enrichment.loc[enrichment[column] == "", column] = pd.NA

    invalid_approved = enrichment["sara_review_decision"].eq("approved")
    if invalid_approved.any():
        raise ValueError(
            "the current snapshot has approved SARA rows but no reviewer/date fields; "
            "do not infer verified sara_partner values from it"
        )

    enrichment["sara_match_candidate"] = (
        enrichment["sara_match_status"].eq("candidate_requires_review")
        & enrichment["sara_review_decision"].eq("pending")
    ).fillna(False).astype(bool)
    enrichment["place_match_refreshed_at"] = generated_at
    return enrichment.loc[
        :, ["premise_code", *PREMISE_DATABASE_ENRICHMENT_COLUMNS]
    ]


def prepare_data(
    prices: pd.DataFrame,
    items: pd.DataFrame,
    premises: pd.DataFrame,
    premise_enrichment: pd.DataFrame | None = None,
) -> PreparedData:
    require_columns(prices, REQUIRED_PRICE_COLUMNS, "price file")
    require_columns(items, REQUIRED_ITEM_COLUMNS, "item lookup")
    require_columns(premises, REQUIRED_PREMISE_COLUMNS, "premise lookup")

    prices = prices.loc[:, ["date", "premise_code", "item_code", "price"]].copy()
    items = items.loc[
        :, ["item_code", "item", "unit", "item_group", "item_category"]
    ].copy()
    premises = premises.loc[
        :, ["premise_code", "premise", "address", "district", "state"]
    ].copy()

    prices["item_code"] = normalise_code(prices["item_code"], "price item_code")
    prices["premise_code"] = normalise_code(
        prices["premise_code"], "price premise_code"
    )
    items["item_code"] = normalise_code(items["item_code"], "lookup item_code")
    premises["premise_code"] = normalise_code(
        premises["premise_code"], "lookup premise_code"
    )
    prices["date"] = pd.to_datetime(prices["date"], errors="coerce").dt.date
    prices["price"] = pd.to_numeric(prices["price"], errors="coerce")

    invalid_prices = prices[
        prices[["date", "item_code", "premise_code", "price"]].isna().any(axis=1)
        | (prices["price"] <= 0)
    ]
    if not invalid_prices.empty:
        raise ValueError(
            f"price file contains {len(invalid_prices):,} rows with missing keys/date "
            "or a non-positive price"
        )

    items = items.dropna(subset=["item_code"]).copy()
    premises = premises.dropna(subset=["premise_code"]).copy()
    if items["item_code"].duplicated().any():
        raise ValueError("item lookup contains duplicate item_code values")
    if premises["premise_code"].duplicated().any():
        raise ValueError("premise lookup contains duplicate premise_code values")

    if premise_enrichment is None:
        for column in PREMISE_DATABASE_ENRICHMENT_COLUMNS:
            premises[column] = pd.NA
        premises["sara_match_candidate"] = False
    else:
        require_columns(
            premise_enrichment,
            {"premise_code", *PREMISE_DATABASE_ENRICHMENT_COLUMNS},
            "prepared premise enrichment",
        )
        enrichment = premise_enrichment.loc[
            :, ["premise_code", *PREMISE_DATABASE_ENRICHMENT_COLUMNS]
        ].copy()
        enrichment["premise_code"] = normalise_code(
            enrichment["premise_code"], "prepared enrichment premise_code"
        )
        if enrichment["premise_code"].duplicated().any():
            raise ValueError("prepared premise enrichment contains duplicate premise_code")
        premises = premises.merge(
            enrichment,
            how="left",
            on="premise_code",
            validate="one_to_one",
        )
        premises["sara_match_candidate"] = (
            premises["sara_match_candidate"].fillna(False).astype(bool)
        )

    duplicate_daily_keys = prices.duplicated(
        ["date", "premise_code", "item_code"], keep=False
    )
    if duplicate_daily_keys.any():
        raise ValueError(
            "price file contains duplicate date-premise-item rows; the source has no "
            "timestamp with which to select one safely"
        )

    item_codes = set(items["item_code"])
    premise_codes = set(premises["premise_code"])
    unmatched_item_mask = ~prices["item_code"].isin(item_codes)
    unmatched_premise_mask = ~prices["premise_code"].isin(premise_codes)
    skipped_mask = unmatched_item_mask | unmatched_premise_mask

    matched_prices = prices.loc[~skipped_mask].copy()
    matched_prices.sort_values(
        ["premise_code", "item_code", "date"], inplace=True
    )
    statuses = matched_prices.drop_duplicates(
        ["premise_code", "item_code"], keep="last"
    ).rename(
        columns={
            "date": "price_observed_date",
            "price": "current_price",
        }
    )
    statuses = statuses.loc[
        :, ["item_code", "premise_code", "current_price", "price_observed_date"]
    ]

    prepared_items = items.rename(columns={"item": "item_name"})
    pack_quantities = prepared_items.apply(
        lambda row: parse_pack_quantity(row["item_name"], row["unit"]), axis=1
    )
    prepared_items["quantity_value"] = [
        value[0] if value else pd.NA for value in pack_quantities
    ]
    prepared_items["quantity_unit"] = [
        value[1] if value else pd.NA for value in pack_quantities
    ]
    prepared_premises = premises.rename(columns={"premise": "premise_name"})

    return PreparedData(
        items=prepared_items,
        premises=prepared_premises,
        statuses=statuses,
        source_price_rows=len(prices),
        source_min_date=str(prices["date"].min()),
        source_max_date=str(prices["date"].max()),
        unmatched_item_code_values=frozenset(
            prices.loc[unmatched_item_mask, "item_code"].dropna().astype(str)
        ),
        unmatched_premise_code_values=frozenset(
            prices.loc[unmatched_premise_mask, "premise_code"].dropna().astype(str)
        ),
        skipped_price_rows=int(skipped_mask.sum()),
    )


def combine_prepared_data(months: list[PreparedData]) -> PreparedData:
    """Combine validated monthly results without retaining all raw rows in memory."""
    if not months:
        raise ValueError("at least one prepared month is required")

    statuses = pd.concat(
        [month.statuses for month in months], ignore_index=True
    ).sort_values(["premise_code", "item_code", "price_observed_date"])
    statuses = statuses.drop_duplicates(["premise_code", "item_code"], keep="last")

    return PreparedData(
        items=months[-1].items,
        premises=months[-1].premises,
        statuses=statuses,
        source_price_rows=sum(month.source_price_rows for month in months),
        source_min_date=min(month.source_min_date for month in months),
        source_max_date=max(month.source_max_date for month in months),
        unmatched_item_code_values=frozenset().union(
            *(month.unmatched_item_code_values for month in months)
        ),
        unmatched_premise_code_values=frozenset().union(
            *(month.unmatched_premise_code_values for month in months)
        ),
        skipped_price_rows=sum(month.skipped_price_rows for month in months),
    )


def prune_price_archives(
    data_dir: Path, *, reference_month: str, keep_count: int
) -> list[Path]:
    """Delete only monthly PriceCatcher archives outside the rolling window."""
    resolved_data_dir = data_dir.resolve()
    keep = retained_months(reference_month, keep_count)
    removed: list[Path] = []
    pattern = re.compile(r"pricecatcher_(\d{4}-\d{2})\.parquet$")
    for path in resolved_data_dir.iterdir():
        if not path.is_file():
            continue
        match = pattern.fullmatch(path.name)
        if match and match.group(1) not in keep:
            path.unlink()
            removed.append(path)
    return removed


def copy_frame(cursor: psycopg.Cursor, table: str, frame: pd.DataFrame) -> None:
    buffer = io.StringIO()
    frame.to_csv(buffer, index=False, lineterminator="\n", na_rep=r"\N")
    buffer.seek(0)
    columns = ", ".join(frame.columns)
    with cursor.copy(
        f"COPY {table} ({columns}) FROM STDIN "
        "WITH (FORMAT CSV, HEADER TRUE, NULL '\\N')"
    ) as copy:
        while data := buffer.read(1024 * 1024):
            copy.write(data)


def upsert_data(connection: psycopg.Connection, data: PreparedData) -> dict[str, int]:
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TEMP TABLE stage_item (
                item_code TEXT,
                item_name TEXT,
                unit TEXT,
                item_group TEXT,
                item_category TEXT,
                quantity_value NUMERIC(12, 4),
                quantity_unit TEXT
            ) ON COMMIT DROP;
            CREATE TEMP TABLE stage_premise (
                premise_code TEXT,
                premise_name TEXT,
                address TEXT,
                district TEXT,
                state TEXT,
                google_place_id TEXT,
                place_match_refreshed_at TIMESTAMPTZ,
                sara_match_candidate BOOLEAN
            ) ON COMMIT DROP;
            CREATE TEMP TABLE stage_current_status (
                item_code TEXT,
                premise_code TEXT,
                current_price NUMERIC(12, 2),
                price_observed_date DATE
            ) ON COMMIT DROP;
            """
        )
        copy_frame(cursor, "stage_item", data.items)
        copy_frame(cursor, "stage_premise", data.premises)
        copy_frame(cursor, "stage_current_status", data.statuses)

        cursor.execute(
            """
            INSERT INTO item (
                item_code, item_name, unit, item_group, item_category,
                quantity_value, quantity_unit
            )
            SELECT item_code, item_name, unit, item_group, item_category,
                   quantity_value, quantity_unit
            FROM stage_item
            ON CONFLICT (item_code) DO UPDATE SET
                item_name = EXCLUDED.item_name,
                unit = EXCLUDED.unit,
                item_group = EXCLUDED.item_group,
                item_category = EXCLUDED.item_category,
                quantity_value = EXCLUDED.quantity_value,
                quantity_unit = EXCLUDED.quantity_unit;
            """
        )
        item_rows = cursor.rowcount

        cursor.execute(
            """
            INSERT INTO premise (
                premise_code,
                premise_name,
                address,
                district,
                state,
                google_place_id,
                place_match_refreshed_at,
                sara_match_candidate
            )
            SELECT
                premise_code,
                premise_name,
                address,
                district,
                state,
                google_place_id,
                place_match_refreshed_at,
                sara_match_candidate
            FROM stage_premise
            ON CONFLICT (premise_code) DO UPDATE SET
                premise_name = EXCLUDED.premise_name,
                address = EXCLUDED.address,
                district = EXCLUDED.district,
                state = EXCLUDED.state,
                google_place_id = COALESCE(
                    premise.google_place_id, EXCLUDED.google_place_id
                ),
                place_match_refreshed_at = COALESCE(
                    premise.place_match_refreshed_at,
                    EXCLUDED.place_match_refreshed_at
                ),
                sara_match_candidate = (
                    premise.sara_match_candidate
                    OR EXCLUDED.sara_match_candidate
                );
            """
        )
        premise_rows = cursor.rowcount

        cursor.execute(
            """
            INSERT INTO current_status (
                item_id,
                premise_id,
                current_price,
                price_observed_date,
                price_synced_at,
                status_updated_at
            )
            SELECT
                i.item_id,
                p.premise_id,
                s.current_price,
                s.price_observed_date,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM stage_current_status AS s
            JOIN item AS i ON i.item_code = s.item_code
            JOIN premise AS p ON p.premise_code = s.premise_code
            ON CONFLICT (item_id, premise_id) DO UPDATE SET
                current_price = EXCLUDED.current_price,
                price_observed_date = EXCLUDED.price_observed_date,
                price_synced_at = EXCLUDED.price_synced_at,
                status_updated_at = EXCLUDED.status_updated_at
            WHERE current_status.price_observed_date <= EXCLUDED.price_observed_date;
            """
        )
        status_rows = cursor.rowcount

    return {
        "item_rows_upserted": item_rows,
        "premise_rows_upserted": premise_rows,
        "status_rows_upserted": status_rows,
    }


def apply_premise_enrichment(
    connection: psycopg.Connection, enrichment: pd.DataFrame
) -> dict[str, int]:
    """Apply the committed enrichment to premises already in PostgreSQL."""
    require_columns(
        enrichment,
        {"premise_code", *PREMISE_DATABASE_ENRICHMENT_COLUMNS},
        "prepared premise enrichment",
    )
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TEMP TABLE stage_premise_enrichment (
                premise_code TEXT,
                google_place_id TEXT,
                place_match_refreshed_at TIMESTAMPTZ,
                sara_match_candidate BOOLEAN
            ) ON COMMIT DROP;
            """
        )
        copy_frame(cursor, "stage_premise_enrichment", enrichment)
        cursor.execute(
            """
            UPDATE premise AS p
            SET
                google_place_id = COALESCE(
                    p.google_place_id, e.google_place_id
                ),
                place_match_refreshed_at = COALESCE(
                    p.place_match_refreshed_at,
                    e.place_match_refreshed_at
                ),
                sara_match_candidate = e.sara_match_candidate
            FROM stage_premise_enrichment AS e
            WHERE p.premise_code = e.premise_code;
            """
        )
        updated_rows = cursor.rowcount
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM stage_premise_enrichment AS e
            LEFT JOIN premise AS p ON p.premise_code = e.premise_code
            WHERE p.premise_id IS NULL
            """
        )
        missing_premise_rows = cursor.fetchone()[0]
    return {
        "premise_rows_updated": updated_rows,
        "enrichment_rows_without_database_premise": missing_premise_rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    period = parser.add_mutually_exclusive_group()
    period.add_argument(
        "--year",
        type=validate_year,
        help="Initial-load year (default: current Malaysia year)",
    )
    period.add_argument(
        "--month",
        nargs="?",
        const=malaysia_current_month(),
        type=validate_month,
        help=(
            "Single month in YYYY-MM format; omit its value to refresh the "
            "current Malaysia month"
        ),
    )
    parser.add_argument(
        "--database-url",
        help="PostgreSQL URL; defaults to DATABASE_URL from the environment or .env",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=RAW_DATA_DIR,
        help="Directory for downloaded Parquet archives",
    )
    parser.add_argument(
        "--premise-enrichment",
        type=Path,
        default=PREMISE_ENRICHMENT_PATH,
        help="Dated premise-enrichment Parquet snapshot",
    )
    parser.add_argument(
        "--no-premise-enrichment",
        dest="premise_enrichment",
        action="store_const",
        const=None,
        help="Ingest only the official PriceCatcher premise lookup",
    )
    parser.add_argument(
        "--enrichment-only",
        action="store_true",
        help="Apply the committed premise enrichment without downloading prices",
    )
    parser.add_argument(
        "--use-cache",
        action="store_true",
        help="Use existing non-empty files instead of refreshing them",
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Download, validate and transform data without connecting to PostgreSQL",
    )
    parser.add_argument(
        "--retain-months",
        type=int,
        default=6,
        help="Number of monthly PriceCatcher archives to retain locally (default: 6)",
    )
    parser.add_argument(
        "--keep-all-archives",
        action="store_true",
        help="Do not apply the rolling archive-retention cleanup",
    )
    return parser.parse_args()


def main() -> int:
    load_local_env(ROOT / ".env")
    args = parse_args()
    if args.enrichment_only:
        if args.premise_enrichment is None:
            raise ValueError(
                "--enrichment-only cannot be combined with --no-premise-enrichment"
            )
        database_url = args.database_url or os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy .env.example to .env or pass "
                "--database-url."
            )
        print(f"Validating premise enrichment: {args.premise_enrichment.name}")
        premise_enrichment = load_premise_enrichment(args.premise_enrichment)
        print("Applying premise enrichment to PostgreSQL")
        with psycopg.connect(database_url, connect_timeout=10) as connection:
            result = apply_premise_enrichment(connection, premise_enrichment)
        for key, value in result.items():
            print(f"  {key}: {value:,}")
        print("Premise enrichment complete.")
        return 0

    selected_months = (
        [args.month]
        if args.month
        else months_for_year(args.year or malaysia_current_year())
    )
    if args.retain_months < 1:
        raise ValueError("--retain-months must be at least 1")

    print(f"Selected transaction months: {', '.join(selected_months)}")
    price_paths = [
        download_file(
            PRICE_URL_TEMPLATE.format(month=month),
            args.data_dir / f"pricecatcher_{month}.parquet",
            args.use_cache,
        )
        for month in selected_months
    ]
    item_path = download_file(
        ITEM_URL, args.data_dir / "lookup_item.parquet", args.use_cache
    )
    premise_path = download_file(
        PREMISE_URL, args.data_dir / "lookup_premise.parquet", args.use_cache
    )

    print("Reading official lookup files")
    items = pd.read_parquet(item_path, engine="fastparquet")
    premises = pd.read_parquet(premise_path, engine="fastparquet")
    premise_enrichment = None
    if args.premise_enrichment is not None:
        print(f"Validating premise enrichment: {args.premise_enrichment.name}")
        premise_enrichment = load_premise_enrichment(args.premise_enrichment)
    prepared_months: list[PreparedData] = []
    for month, price_path in zip(selected_months, price_paths, strict=True):
        print(f"Reading and validating {month}")
        prices = pd.read_parquet(price_path, engine="fastparquet")
        prepared_months.append(
            prepare_data(prices, items, premises, premise_enrichment)
        )
        del prices
    prepared = combine_prepared_data(prepared_months)

    summary = {
        "source_price_rows": prepared.source_price_rows,
        "source_months": len(selected_months),
        "source_min_date": prepared.source_min_date,
        "source_max_date": prepared.source_max_date,
        "unmatched_item_codes": prepared.unmatched_item_codes,
        "unmatched_premise_codes": prepared.unmatched_premise_codes,
        "skipped_price_rows": prepared.skipped_price_rows,
        "item_rows_prepared": len(prepared.items),
        "premise_rows_prepared": len(prepared.premises),
        "status_rows_prepared": len(prepared.statuses),
    }
    print("Preparation summary:")
    for key, value in summary.items():
        print(f"  {key}: {value:,}" if isinstance(value, int) else f"  {key}: {value}")

    if prepared.unmatched_item_codes or prepared.unmatched_premise_codes:
        print(
            "WARNING: observations without official lookup rows were skipped; "
            "no labels or premises were invented.",
            file=sys.stderr,
        )

    if args.prepare_only:
        print("Prepare-only run complete; PostgreSQL was not changed.")
    else:
        database_url = args.database_url or os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy .env.example to .env or pass "
                "--database-url."
            )

        print("Connecting to PostgreSQL and applying idempotent upserts")
        with psycopg.connect(database_url, connect_timeout=10) as connection:
            result = upsert_data(connection, prepared)
        for key, value in result.items():
            print(f"  {key}: {value:,}")
        print("Ingestion complete.")

    if not args.keep_all_archives:
        removed = prune_price_archives(
            args.data_dir,
            reference_month=malaysia_current_month(),
            keep_count=args.retain_months,
        )
        if removed:
            print("Removed monthly archives outside the retention window:")
            for path in removed:
                print(f"  {path.name}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
