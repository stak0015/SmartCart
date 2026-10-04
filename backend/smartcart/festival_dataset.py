"""Dataset identity, version registry, and single-source validation."""

from __future__ import annotations

from datetime import date
from typing import Mapping, Sequence

DATASET_ID = "US4i.7"
DATASET_VERSION = "4i.7-dataset-v2"
DATASET_EFFECTIVE_DATE = "2026-10-04"

OUTPUT_CONTRACTS = {
    "festival_significance.json": {
        "method_fields": ("method_version", "window_method_version"),
        "row_count_field": "rows",
        "producer": "database/compute_festival_stats.py",
    },
    "festival_price_stats.json": {
        "method_fields": ("price_stats_method_version", "window_method_version"),
        "row_count_field": "item_row_count",
        "producer": "database/compute_festival_price_stats.py",
    },
    "festival_rise_ratios.json": {
        "method_fields": ("rise_ratio_method_version",),
        "row_count_field": "festival_state_count",
        "producer": "database/compute_festival_rise_ratios.py",
    },
    "festival_historical_prices.json": {
        "method_fields": ("historical_price_method_version", "window_method_version"),
        "row_count_field": "row_count",
        "producer": "database/compute_festival_historical_prices.py",
    },
    "festival_specialty_stats.json": {
        "method_fields": ("specialty_analysis_method_version",),
        "row_count_field": "row_count",
        "producer": "database/compute_festival_specialty_stats.py",
    },
}


def validate_registry(registry: Mapping[str, object]):
    """Return a list of registry consistency errors."""

    errors = []
    if registry.get("dataset_id") != DATASET_ID:
        errors.append("dataset_id must be " + DATASET_ID)
    if not registry.get("dataset_version"):
        errors.append("dataset_version is required")
    effective = registry.get("effective_date")
    if not effective:
        errors.append("effective_date is required")
    else:
        try:
            date.fromisoformat(str(effective))
        except ValueError:
            errors.append("effective_date must be ISO date")

    methods = registry.get("methods")
    if not isinstance(methods, Sequence) or isinstance(methods, (str, bytes)):
        return errors + ["methods must be a list"]
    if not methods:
        return errors + ["methods must not be empty"]

    seen_ids = set()
    seen_versions = set()
    required = ("method_id", "version", "effective_date", "description")
    for index, method in enumerate(methods):
        if not isinstance(method, Mapping):
            errors.append(f"method {index} must be an object")
            continue
        for key in required:
            if not method.get(key):
                errors.append(f"method {index} missing {key}")
        method_id = method.get("method_id")
        version = method.get("version")
        if method_id in seen_ids:
            errors.append("duplicate method_id: " + str(method_id))
        if version in seen_versions:
            errors.append("duplicate method version: " + str(version))
        seen_ids.add(method_id)
        seen_versions.add(version)
        try:
            date.fromisoformat(str(method.get("effective_date")))
        except ValueError:
            errors.append("invalid effective_date for " + str(method_id))
    return errors


def known_versions(registry: Mapping[str, object]):
    methods = registry.get("methods") or []
    return {
        str(method["version"])
        for method in methods
        if isinstance(method, Mapping) and method.get("version")
    }


def validate_manifest(manifest: Mapping[str, object], registry: Mapping[str, object]):
    """Return a list of manifest-to-registry consistency errors."""

    errors = validate_registry(registry)
    if manifest.get("dataset_id") != registry.get("dataset_id"):
        errors.append("manifest dataset_id does not match registry")
    if manifest.get("dataset_version") != registry.get("dataset_version"):
        errors.append("manifest dataset_version does not match registry")
    if manifest.get("effective_date") != registry.get("effective_date"):
        errors.append("manifest effective_date does not match registry")

    versions = known_versions(registry)
    outputs = manifest.get("outputs")
    if not isinstance(outputs, Sequence) or isinstance(outputs, (str, bytes)):
        return errors + ["outputs must be a list"]
    seen_files = set()
    for index, output in enumerate(outputs):
        if not isinstance(output, Mapping):
            errors.append(f"output {index} must be an object")
            continue
        file_name = output.get("file")
        if file_name not in OUTPUT_CONTRACTS:
            errors.append("unknown output file: " + str(file_name))
        if file_name in seen_files:
            errors.append("duplicate output file: " + str(file_name))
        seen_files.add(file_name)
        if output.get("status") == "missing":
            continue
        method_versions = output.get("method_versions")
        if not isinstance(method_versions, Mapping):
            errors.append("missing method_versions for " + str(file_name))
            continue
        for field, version in method_versions.items():
            if version not in versions:
                errors.append(
                    f"{file_name}: unknown method version {field}={version}"
                )
    return errors


def build_output_entry(file_name, payload):
    """Build one manifest output entry from a generated dataset payload."""

    contract = OUTPUT_CONTRACTS[file_name]
    raw_row_count = payload.get(contract["row_count_field"])
    row_count = (
        len(raw_row_count)
        if isinstance(raw_row_count, (list, tuple))
        else raw_row_count
    )
    return {
        "file": file_name,
        "status": "present",
        "producer": contract["producer"],
        "row_count": row_count,
        "method_versions": {
            field: payload.get(field) for field in contract["method_fields"]
        },
    }
