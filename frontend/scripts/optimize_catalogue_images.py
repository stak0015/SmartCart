"""Generate small, cacheable catalogue thumbnails from the checked-in PNGs.

The catalogue cards never display the source images larger than roughly 160px.
Keeping a pre-compressed, versioned WebP copy avoids making Vercel's image
optimizer transform every product image on the first request.

Usage:
    python scripts/optimize_catalogue_images.py
"""

from __future__ import annotations

import argparse
import csv
from io import BytesIO
import json
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "frontend" / "public" / "pricecatcher"
OUTPUT_DIR = ROOT / "frontend" / "public" / "pricecatcher-v1"
IMAGE_CSV = ROOT / "database" / "data" / "pricecatcher_images.csv"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
BACKEND_MANIFEST_PATH = ROOT / "backend" / "smartcart" / "catalogue_image_manifest.py"
THUMBNAIL_SIZE = (160, 160)


def valid_image_sources() -> dict[str, str]:
    with IMAGE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        return {
            row["item_code"].strip(): row["image_url"].strip()
            for row in csv.DictReader(handle)
            if row.get("image_status") == "valid"
            and row.get("item_code")
            and row.get("image_url")
        }


def optimize_image(source: Path, source_url: str, destination: Path) -> None:
    if source.is_file():
        source_image = Image.open(source)
    else:
        request = Request(source_url, headers={"User-Agent": "SmartCart catalogue thumbnail generator"})
        with urlopen(request, timeout=30) as response:
            source_image = Image.open(BytesIO(response.read()))

    with source_image as image:
        image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        if "A" in image.getbands():
            prepared = image.convert("RGBA")
        else:
            prepared = image.convert("RGB")
        prepared.save(destination, "WEBP", quality=82, method=4)


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
    args = parser.parse_args()

    image_sources = valid_image_sources()
    codes = set(image_sources)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = []
    skipped = []

    for code in sorted(codes, key=lambda value: (int(value) if value.isdigit() else 0, value)):
        source = SOURCE_DIR / f"{code}.png"
        destination = OUTPUT_DIR / f"{code}.webp"
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
