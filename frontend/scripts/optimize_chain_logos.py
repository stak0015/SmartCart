"""Create small, versioned WebP copies of the collected retailer logos."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "frontend" / "public" / "chain-logos"
OUTPUT_DIR = ROOT / "frontend" / "public" / "chain-logos-v1"
SOURCE_MANIFEST = SOURCE_DIR / "manifest.json"
OUTPUT_MANIFEST = OUTPUT_DIR / "manifest.json"
THUMBNAIL_SIZE = (160, 160)


def save_webp(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image.load()
        image.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        if "A" in image.getbands() or "transparency" in image.info:
            prepared = image.convert("RGBA")
        else:
            prepared = image.convert("RGB")
        prepared.save(destination, "WEBP", quality=82, method=4)
        prepared.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="recreate existing WebP files")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="remove generated WebP files that are no longer listed in the source manifest",
    )
    args = parser.parse_args()

    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, str]] = []
    skipped: list[str] = []

    for chain in source_manifest.get("chains", []):
        asset = chain.get("asset")
        if not asset:
            continue
        source = SOURCE_DIR / Path(asset).name
        destination = OUTPUT_DIR / f"{source.stem}.webp"
        if not source.is_file():
            skipped.append(f"{chain.get('name', asset)} (missing {source.name})")
            continue
        try:
            if args.force or not destination.is_file():
                save_webp(source, destination)
        except (OSError, ValueError) as error:
            skipped.append(f"{chain.get('name', asset)} ({error})")
            continue
        entries.append(
            {
                "name": chain["name"],
                "asset": f"/chain-logos-v1/{destination.name}",
                "source_asset": asset,
            }
        )

    valid_names = {Path(entry["asset"]).stem for entry in entries}
    if args.clean:
        for path in OUTPUT_DIR.glob("*.webp"):
            if path.stem not in valid_names:
                path.unlink()

    OUTPUT_MANIFEST.write_text(
        json.dumps({"version": 1, "chains": entries}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(entries):,} chain logo WebP images in {OUTPUT_DIR}.")
    if skipped:
        print(f"Skipped {len(skipped):,} source logos: {skipped}")


if __name__ == "__main__":
    main()
