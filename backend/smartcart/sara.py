"""SARA credit eligibility at line level.

A basket line counts toward SARA Credit when either:
1. ``item.sara_eligible IS TRUE`` — a manually verified flag (once such data
   is loaded this branch takes effect with no code change), or
2. the item's category is on the official SARA 2026 category list
   (``SARA_CATEGORY_CANDIDATES`` below) — a *candidate* match, not a verified
   one; shoppers must still confirm the SARA label/barcode in store.

Everything else (``sara_eligible`` false/NULL and category not listed) counts
toward Cash Needed.
"""

# Official SARA 2026 categories, matched verbatim against the item_category
# values in the catalogue database.
SARA_CATEGORY_CANDIDATES: frozenset[str] = frozenset(
    {
        "ALAT TULIS DAN BAHAN BACAAN",
        "BAHAN-BAHAN MINUMAN",
        "BERAS",
        "BERUS GIGI",
        "BIHUN",
        "BISKUT",
        "CILI KERING",
        "COKLAT",
        "ESEN DAN RAGI",
        "GULA",
        "IKAN DALAM TIN",
        "KELAPA",
        "KICAP DAN SOS",
        "KRIMER DAN SUSU TEPUNG",
        "LAMPIN PAKAI BUANG",
        "MEE / BIHUN / KUEY TEOW",
        "MEE/KUETIAU",
        "MENTEGA",
        "MI SEGERA",
        "MINUMAN",
        "MINYAK DAN LEMAK",
        "MOUTH WASH",
        "PENJAGAAN DIRI",
        "PENJAGAAN RUMAH",
        "REMPAH RATUS (BERBUNGKUS)",
        "REMPAH RATUS (TIDAK BERBUNGKUS)",
        "ROTI",
        "SABUN BADAN",
        "SANTAN (KOTAK)",
        "SAPUAN (SPREADS)",
        "SUSU BAYI",
        "SYAMPU",
        "TELUR",
        "TEPUNG",
        "TERSEDIA MINUM",
        "TUALA WANITA",
        "UBAT GIGI",
        "UBAT-UBATAN",
    }
)


def is_sara_credit_line(sara_eligible: bool | None, item_category: str | None) -> bool:
    """True when the basket line counts toward SARA Credit: a verified item
    flag wins; otherwise a category-level candidate match counts (estimated)."""
    if sara_eligible is True:
        return True
    return item_category in SARA_CATEGORY_CANDIDATES
