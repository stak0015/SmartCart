"""Helpers for bilingual catalogue data.

English item names are imported with the PriceCatcher ``lookup_item`` row and
stored on ``item.item_name_en``. The official ``item.item_name`` value remains
the Malay/original fallback. Category labels are still optional additive data
because the lookup feed has no translated category column.
"""

from __future__ import annotations

def catalogue_translation_joins() -> str:
    return """
        LEFT JOIN category_translation ct_en
          ON ct_en.category_name = i.item_category AND ct_en.locale = 'en'
        LEFT JOIN category_translation ct_ms
          ON ct_ms.category_name = i.item_category AND ct_ms.locale = 'ms'
    """


def catalogue_search_where() -> str:
    """SQL WHERE fragment for bilingual q matching and category filtering."""
    return """
        (
            i.item_name ILIKE %s
            OR COALESCE(i.item_name_en, '') ILIKE %s
            OR i.item_category ILIKE %s
            OR COALESCE(ct_en.translated_name, '') ILIKE %s
            OR COALESCE(ct_ms.translated_name, '') ILIKE %s
        )
        AND (
            cardinality(%s::text[]) = 0
            OR i.item_category = ANY(%s::text[])
            OR ct_en.translated_name = ANY(%s::text[])
            OR ct_ms.translated_name = ANY(%s::text[])
        )
    """


def catalogue_search_params(keyword: str, categories: list[str]) -> tuple[object, ...]:
    selected = [category.strip() for category in categories if category.strip()]
    return (keyword,) * 5 + (selected, selected, selected, selected)


def translation_select_columns() -> str:
    return """
        COALESCE(NULLIF(i.item_name_en, ''), i.item_name) AS item_name_en,
        i.item_name AS item_name_ms,
        COALESCE(ct_en.translated_name, i.item_category) AS item_category_en,
        COALESCE(ct_ms.translated_name, i.item_category) AS item_category_ms
    """
