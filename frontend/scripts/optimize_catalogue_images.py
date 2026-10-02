"""Generate small, cacheable catalogue thumbnails.

The catalogue cards never display the source images larger than roughly 160px.
Keeping a pre-compressed, versioned WebP copy avoids making Vercel's image
optimizer transform every product image on the first request.

Usage:
    python scripts/optimize_catalogue_images.py
    python scripts/optimize_catalogue_images.py --refresh-links-through 589
"""

from __future__ import annotations

import argparse
import csv
from io import BytesIO
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "frontend" / "public" / "pricecatcher"
OUTPUT_DIR = ROOT / "frontend" / "public" / "pricecatcher-v1"
IMAGE_CSV = ROOT / "database" / "data" / "pricecatcher_images.csv"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
BACKEND_MANIFEST_PATH = ROOT / "backend" / "smartcart" / "catalogue_image_manifest.py"
THUMBNAIL_SIZE = (160, 160)
MAX_SOURCE_BYTES = 25 * 1024 * 1024
USER_AGENT = "SmartCart catalogue image refresh"


def valid_image_sources() -> dict[str, str]:
    with IMAGE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        return {
            row["item_code"].strip(): row["image_url"].strip()
            for row in csv.DictReader(handle)
            if row.get("image_status") == "valid"
            and row.get("item_code")
            and row.get("image_url")
        }


def download_image(source_url: str) -> tuple[int, str, bytes]:
    request = Request(
        source_url,
        headers={
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=30) as response:
        payload = response.read(MAX_SOURCE_BYTES + 1)
        if len(payload) > MAX_SOURCE_BYTES:
            raise ValueError(f"source image exceeds {MAX_SOURCE_BYTES:,} bytes")
        return response.status, response.headers.get_content_type(), payload


def save_thumbnail(payload: bytes, destination: Path) -> None:
    with Image.open(BytesIO(payload)) as image:
        image.load()
        image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        if "A" in image.getbands() or "transparency" in image.info:
            prepared = image.convert("RGBA")
        else:
            prepared = image.convert("RGB")
        prepared.save(destination, "WEBP", quality=82, method=4)
        prepared.close()


def optimize_image(source: Path, source_url: str, destination: Path) -> None:
    if source.is_file():
        save_thumbnail(source.read_bytes(), destination)
        return
    _, _, payload = download_image(source_url)
    save_thumbnail(payload, destination)


def read_image_rows() -> tuple[list[dict[str, str]], list[str]]:
    with IMAGE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def write_image_rows(rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    temporary_path = IMAGE_CSV.with_suffix(".csv.tmp")
    with temporary_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    temporary_path.replace(IMAGE_CSV)


def canonical_image_url(item_code: str) -> str:
    return f"https://img.manamurah.com/barang_nobg/{item_code}.png"


def refresh_updated_links(
    rows: list[dict[str, str]],
    max_csv_row: int,
) -> tuple[list[str], list[str]]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    downloaded: list[str] = []
    failed: list[str] = []

    for index, row in enumerate(rows):
        csv_row = index + 2  # row 1 is the CSV header
        code = (row.get("item_code") or "").strip()
        source_url = (row.get("image_url") or "").strip()
        if (
            csv_row > max_csv_row
            or not code
            or not source_url
            or source_url == canonical_image_url(code)
            or row.get("image_status") == "valid"
        ):
            continue

        try:
            try:
                status, content_type, payload = download_image(source_url)
            except HTTPError as error:
                # Wikimedia may rate-limit the original upload URL while its
                # download endpoint remains available for the same asset.
                if (
                    error.code == 429
                    and source_url.startswith("https://upload.wikimedia.org/")
                    and "?" not in source_url
                ):
                    status, content_type, payload = download_image(
                        f"{source_url}?download=1"
                    )
                else:
                    raise
            destination = OUTPUT_DIR / f"{code}.webp"
            save_thumbnail(payload, destination)
        except HTTPError as error:
            row["http_status"] = str(error.code)
            row["content_type"] = ""
            row["image_bytes"] = "0"
            row["image_status"] = "missing"
            failed.append(f"{code} (HTTP {error.code})")
            continue
        except (OSError, ValueError) as error:
            row["http_status"] = "0"
            row["content_type"] = ""
            row["image_bytes"] = "0"
            row["image_status"] = "missing"
            failed.append(f"{code} ({error})")
            continue

        row["http_status"] = str(status)
        row["content_type"] = content_type
        row["image_bytes"] = str(len(payload))
        row["image_status"] = "valid"
        downloaded.append(code)

    return downloaded, failed


def write_backend_manifest(codes: list[str]) -> None:
    entries = ",\n".join(f'    "{code}"' for code in codes)
    BACKEND_MANIFEST_PATH.write_text(
        "\"\"\"Generated catalogue image manifest; do not edit by hand.\"\"\"\n\n"
        "CATALOGUE_IMAGE_CODES = frozenset({\n"
        f"{entries}\n"
        "})\n\n"
        "def catalogue_image_url(item_code: str | None) -> str | None:\n"
        "    code = str(item_code or \"\").strip()\n"
        "    if code not in CATALOGUE_IMAGE_CODES:\n"
        "        return None\n"
        "    return f\"/pricecatcher-v1/{code}.webp\"\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--clean",
        action="store_true",
        help="remove generated thumbnails that no longer have a valid source image",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="recreate thumbnails even when the destination WebP already exists",
    )
    parser.add_argument(
        "--refresh-links-through",
        type=int,
        metavar="CSV_ROW",
        help="download non-canonical missing-image links through this CSV row before generating thumbnails",
    )
    args = parser.parse_args()

    if args.refresh_links_through is not None:
        rows, fieldnames = read_image_rows()
        downloaded, failed = refresh_updated_links(rows, args.refresh_links_through)
        write_image_rows(rows, fieldnames)
        print(
            f"Downloaded {len(downloaded):,} updated catalogue images through CSV row "
            f"{args.refresh_links_through}."
        )
        if failed:
            print(f"Failed {len(failed):,} updated image links: {failed}")

    image_sources = valid_image_sources()
    codes = set(image_sources)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = []
    skipped = []

    for code in sorted(codes, key=lambda value: (int(value) if value.isdigit() else 0, value)):
        source = SOURCE_DIR / f"{code}.png"
        destination = OUTPUT_DIR / f"{code}.webp"
        if destination.is_file() and not args.force:
            generated.append(code)
            continue
        try:
            optimize_image(source, image_sources[code], destination)
        except OSError as error:
            skipped.append(f"{code} ({error})")
            continue
        generated.append(code)

    if args.clean:
        for path in OUTPUT_DIR.glob("*.webp"):
            if path.stem not in codes:
                path.unlink()

    MANIFEST_PATH.write_text(
        json.dumps({"version": 1, "codes": generated}, indent=2) + "\n",
        encoding="utf-8",
    )
    write_backend_manifest(generated)
    print(f"Generated {len(generated):,} WebP catalogue thumbnails.")
    if skipped:
        print(f"Skipped {len(skipped):,} valid manifest rows without a source PNG: {skipped}")


if __name__ == "__main__":
    main()
