"""Build and validate the US 4i.7 dataset manifest."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from smartcart.festival_dataset import (  # noqa: E402
    DATASET_EFFECTIVE_DATE,
    DATASET_ID,
    DATASET_VERSION,
    OUTPUT_CONTRACTS,
    build_output_entry,
    known_versions,
    validate_manifest,
    validate_registry,
)

MALAYSIA_TZ = timezone.utc


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", required=True)
    parser.add_argument("--dataset-dir", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--allow-missing", action="store_true")
    args = parser.parse_args(argv)

    registry_path = Path(args.registry)
    dataset_dir = Path(args.dataset_dir)
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    registry_errors = validate_registry(registry)

    versions = known_versions(registry)
    outputs = []
    missing = []
    for file_name, contract in OUTPUT_CONTRACTS.items():
        path = dataset_dir / file_name
        if not path.exists():
            missing.append(file_name)
            outputs.append(
                {
                    "file": file_name,
                    "status": "missing",
                    "producer": contract["producer"],
                    "row_count": None,
                    "method_versions": {},
                }
            )
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        entry = build_output_entry(file_name, payload)
        for field, version in entry["method_versions"].items():
            if version not in versions:
                registry_errors.append(
                    f"{file_name}: unknown method version {field}={version}"
                )
        outputs.append(entry)

    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "effective_date": DATASET_EFFECTIVE_DATE,
        "generated_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "registry": registry_path.as_posix(),
        "single_source_rule": registry.get("single_source_rule"),
        "source_datasets": registry.get("source_datasets", []),
        "outputs": outputs,
    }
    validation_errors = list(registry_errors)
    validation_errors.extend(validate_manifest(manifest, registry))
    if missing and not args.allow_missing:
        validation_errors.append("missing outputs: " + ", ".join(missing))
    manifest["validation"] = {
        "status": "pass" if not validation_errors else "fail",
        "errors": validation_errors,
    }
    Path(args.out).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + chr(10),
        encoding="utf-8",
    )

    print("dataset_id:", manifest["dataset_id"])
    print("dataset_version:", manifest["dataset_version"])
    print("outputs:", len(outputs), " missing:", len(missing))
    print("validation:", manifest["validation"]["status"])
    if validation_errors:
        for error in validation_errors:
            print("  -", error)
    print("written:", args.out)
    return 0 if not validation_errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
