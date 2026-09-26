"""Authoritative, database-independent broad catalogue categories."""

from __future__ import annotations

import logging
from types import MappingProxyType
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


logger = logging.getLogger(__name__)

BroadCategoryId = Literal[
    "fresh-produce",
    "protein",
    "staples",
    "cooking-ingredients",
    "drinks-milk",
    "snacks-convenience",
    "baby-care",
    "personal-health",
    "household",
    "education-reading",
    "other",
]
SpendingClass = Literal["essential", "discretionary", "mixed_or_unknown"]


class CategorySummary(BaseModel):
    """Immutable public category metadata, serialized with camelCase fields."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        frozen=True,
        populate_by_name=True,
    )

    id: BroadCategoryId
    label_en: str
    label_ms: str
    spending_class: SpendingClass


class SourceCategorySummary(BaseModel):
    """One catalogue item's original, specifically translated category."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        frozen=True,
        populate_by_name=True,
    )

    id: str
    label_en: str
    label_ms: str


def source_category_for_raw(
    raw_category: str | None,
    label_en: str | None = None,
    label_ms: str | None = None,
) -> SourceCategorySummary | None:
    """Preserve the raw category and use translated labels when available."""
    if raw_category is None or not raw_category.strip():
        return None
    return SourceCategorySummary(
        id=raw_category,
        label_en=label_en.strip() if label_en and label_en.strip() else raw_category,
        label_ms=label_ms.strip() if label_ms and label_ms.strip() else raw_category,
    )


CATEGORY_SUMMARIES: tuple[CategorySummary, ...] = (
    CategorySummary(
        id="fresh-produce",
        label_en="Fresh Produce",
        label_ms="Hasil Segar",
        spending_class="essential",
    ),
    CategorySummary(
        id="protein",
        label_en="Meat, Seafood & Protein",
        label_ms="Daging, Makanan Laut & Protein",
        spending_class="essential",
    ),
    CategorySummary(
        id="staples",
        label_en="Rice, Noodles & Bread",
        label_ms="Beras, Mi & Roti",
        spending_class="essential",
    ),
    CategorySummary(
        id="cooking-ingredients",
        label_en="Cooking Ingredients",
        label_ms="Bahan Masakan",
        spending_class="essential",
    ),
    CategorySummary(
        id="drinks-milk",
        label_en="Drinks & Milk",
        label_ms="Minuman & Susu",
        spending_class="mixed_or_unknown",
    ),
    CategorySummary(
        id="snacks-convenience",
        label_en="Snacks & Convenience Foods",
        label_ms="Snek & Makanan Mudah",
        spending_class="discretionary",
    ),
    CategorySummary(
        id="baby-care",
        label_en="Baby Food & Care",
        label_ms="Makanan & Penjagaan Bayi",
        spending_class="essential",
    ),
    CategorySummary(
        id="personal-health",
        label_en="Personal Care & Health",
        label_ms="Penjagaan Diri & Kesihatan",
        spending_class="essential",
    ),
    CategorySummary(
        id="household",
        label_en="Household Care",
        label_ms="Penjagaan Rumah",
        spending_class="essential",
    ),
    CategorySummary(
        id="education-reading",
        label_en="Education & Reading",
        label_ms="Pendidikan & Bahan Bacaan",
        spending_class="essential",
    ),
    CategorySummary(
        id="other",
        label_en="Other",
        label_ms="Lain-lain",
        spending_class="mixed_or_unknown",
    ),
)

CATEGORIES_BY_ID = MappingProxyType(
    {category.id: category for category in CATEGORY_SUMMARIES}
)

_CATEGORY_RAW_CATEGORIES: tuple[tuple[BroadCategoryId, tuple[str, ...]], ...] = (
    (
        "fresh-produce",
        ("BAWANG", "BUAH-BUAHAN", "KELAPA", "SAYUR-SAYURAN", "UBI KENTANG"),
    ),
    (
        "protein",
        (
            "AYAM",
            "BAHAN LAUT",
            "DAGING",
            "HASIL LAUT KERING",
            "IKAN DALAM TIN",
            "IKAN DARAT",
            "KACANG",
            "TAUHU DAN TEMPE",
            "TELUR",
        ),
    ),
    (
        "staples",
        (
            "BERAS",
            "BIHUN",
            "MEE / BIHUN / KUEY TEOW",
            "MEE/KUETIAU",
            "MI SEGERA",
            "NASI",
            "ROTI",
        ),
    ),
    (
        "cooking-ingredients",
        (
            "CILI KERING",
            "ESEN DAN RAGI",
            "GULA",
            "KICAP DAN SOS",
            "MENTEGA",
            "MINYAK DAN LEMAK",
            "REMPAH RATUS (BERBUNGKUS)",
            "REMPAH RATUS (TIDAK BERBUNGKUS)",
            "SANTAN (KOTAK)",
            "SAPUAN (SPREADS)",
            "TEPUNG",
        ),
    ),
    (
        "drinks-milk",
        (
            "BAHAN-BAHAN MINUMAN",
            "KRIMER DAN SUSU TEPUNG",
            "MINUMAN",
            "TERSEDIA MINUM",
        ),
    ),
    (
        "snacks-convenience",
        ("BISKUT", "COKLAT", "LAUK", "MAKANAN RINGAN", "MAKANAN SEGERA"),
    ),
    ("baby-care", ("LAMPIN PAKAI BUANG", "MAKANAN BAYI", "SUSU BAYI")),
    (
        "personal-health",
        (
            "BERUS GIGI",
            "MOUTH WASH",
            "PENJAGAAN DIRI",
            "SABUN BADAN",
            "SYAMPU",
            "TUALA WANITA",
            "UBAT GIGI",
            "UBAT-UBATAN",
        ),
    ),
    (
        "household",
        ("PENGHALAU NYAMUK", "PENJAGAAN RUMAH", "PEWANGI RUMAH", "TISU"),
    ),
    ("education-reading", ("ALAT TULIS DAN BAHAN BACAAN", "MAJALAH")),
    ("other", ("LAIN-LAIN",)),
)

_raw_category_pairs = [
    (raw_category, category_id)
    for category_id, raw_categories in _CATEGORY_RAW_CATEGORIES
    for raw_category in raw_categories
]
if len({raw_category for raw_category, _ in _raw_category_pairs}) != len(
    _raw_category_pairs
):
    raise RuntimeError("A raw catalogue category is assigned more than once")

RAW_CATEGORY_TO_ID = MappingProxyType(dict(_raw_category_pairs))
ALL_MAPPED_RAW_CATEGORIES: tuple[str, ...] = tuple(RAW_CATEGORY_TO_ID)
CATEGORY_RAW_CATEGORIES = MappingProxyType(
    {
        category_id: raw_categories
        for category_id, raw_categories in _CATEGORY_RAW_CATEGORIES
    }
)


def category_for_raw(raw_category: str | None) -> CategorySummary | None:
    """Map a source category to its broad summary, warning on future values."""
    if raw_category is None or not raw_category.strip():
        return None

    normalized = raw_category.strip()
    category_id = RAW_CATEGORY_TO_ID.get(normalized)
    if category_id is None:
        logger.warning(
            "Unmapped source category fell back to other",
            extra={
                "event": "unmapped_source_category",
                "raw_category": raw_category,
                "broad_category_id": "other",
            },
        )
        category_id = "other"
    return CATEGORIES_BY_ID[category_id]


def expand_broad_category_filters(
    category_ids: list[str] | tuple[str, ...],
) -> tuple[list[str], bool]:
    """Return mapped raw values and whether the SQL fallback clause is needed."""
    raw_categories: list[str] = []
    included: set[str] = set()
    include_unmapped = False
    for category_id in category_ids:
        category = CATEGORIES_BY_ID.get(category_id)
        if category is None:
            raise ValueError(f"Unknown broad category ID: {category_id}")
        include_unmapped = include_unmapped or category_id == "other"
        for raw_category in CATEGORY_RAW_CATEGORIES[category.id]:
            if raw_category not in included:
                included.add(raw_category)
                raw_categories.append(raw_category)
    return raw_categories, include_unmapped
