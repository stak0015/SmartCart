"""Tests for US 4i.7 dataset version metadata."""

from __future__ import annotations

from smartcart.festival_dataset import (
    DATASET_EFFECTIVE_DATE,
    DATASET_ID,
    DATASET_VERSION,
    build_output_entry,
    validate_manifest,
    validate_registry,
)


def registry():
    return {
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "effective_date": DATASET_EFFECTIVE_DATE,
        "methods": [
            {
                "method_id": "significance",
                "version": "4i.7-v1",
                "effective_date": DATASET_EFFECTIVE_DATE,
                "description": "significance",
            },
            {
                "method_id": "key_windows",
                "version": "4i.7.2-v1",
                "effective_date": DATASET_EFFECTIVE_DATE,
                "description": "windows",
            },
        ],
    }


def test_registry_validates():
    assert validate_registry(registry()) == []


def test_registry_rejects_duplicate_versions():
    data = registry()
    data["methods"].append(dict(data["methods"][0]))
    errors = validate_registry(data)
    assert any("duplicate" in error for error in errors)


def test_manifest_validates_known_versions():
    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "effective_date": DATASET_EFFECTIVE_DATE,
        "outputs": [
            {
                "file": "festival_significance.json",
                "status": "present",
                "method_versions": {
                    "method_version": "4i.7-v1",
                    "window_method_version": "4i.7.2-v1",
                },
            }
        ],
    }
    assert validate_manifest(manifest, registry()) == []


def test_manifest_rejects_unknown_version():
    manifest = {
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "effective_date": DATASET_EFFECTIVE_DATE,
        "outputs": [
            {
                "file": "festival_significance.json",
                "status": "present",
                "method_versions": {
                    "method_version": "4i.7-v99",
                    "window_method_version": "4i.7.2-v1",
                },
            }
        ],
    }
    errors = validate_manifest(manifest, registry())
    assert any("unknown method version" in error for error in errors)

def test_build_output_entry_counts_list_rows():
    entry = build_output_entry(
        "festival_significance.json",
        {
            "method_version": "4i.7-v1",
            "window_method_version": "4i.7.2-v1",
            "rows": [{"id": 1}, {"id": 2}],
        },
    )
    assert entry["row_count"] == 2
    assert entry["method_versions"]["method_version"] == "4i.7-v1"

