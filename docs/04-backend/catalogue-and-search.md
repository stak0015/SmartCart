# Catalogue and search (Epics 0 and 1)

Code: `backend/smartcart/catalogue.py`, `categories.py`, `translations.py`, `catalogue_image_manifest.py`, `api.py` (`search_items`, `list_categories`). Frontend: `components/smartcart-app.tsx` (Shop screen), `components/catalogue-item-dialog.tsx`, `lib/api.ts`, `lib/result-row.ts`, `lib/basket-state.ts`, `lib/i18n.ts`.

## Search

`search_catalogue` builds one parameterised query:

- **Match:** `q` is wrapped as `%q%` and matched case-insensitively (`ILIKE`) against the Malay name, the English name, the raw category, and the English and Malay category labels. The UI requires at least 2 characters before searching by name; an empty query lists everything.
- **Filter:** selected broad categories expand to their raw PriceCatcher categories. The *Other* category includes any non-empty raw category not mapped elsewhere. *SARA categories only* restricts to the official SARA 2026 list.
- **Sort:** `price_asc` (default) / `price_desc` use the lowest observed price among the 25 nearest cached stores (when a candidate snapshot exists), else the item's cached median; unpriced items go last. Name sorts use the English name for `locale=en` and the Malay name for `ms`. Every sort ends with `item_id` for stable paging.
- **Page:** 25 items per page; the response includes `total` and `total_pages`.

Each row is enriched in Python with: broad and source category, `package_size` (parsed from the name, else the pricing unit), `sara_category_candidate`, `image_url` (only when a checked-in thumbnail exists), and `price_range` when a snapshot is supplied. For an item none of the nearby stores sells, `price_range` is the middle 95% of current national prices (2.5th–97.5th percentile, so outliers are left out), shown as "RMa – RMb (estimated)".

## Categories

PriceCatcher has 59 raw Malay categories. `categories.py` maps them to 11 broad, stable IDs used by filters, statistics and reports:

`fresh-produce`, `protein`, `staples`, `cooking-ingredients`, `drinks-milk`, `snacks-convenience`, `baby-care`, `personal-health`, `household`, `education-reading`, `other`.

Each broad category also has a spending class (`essential`, `discretionary`, `mixed_or_unknown`) used by Epic 8. The mapping is in code, independent of the database, so a new raw category safely falls into *Other*.

## Item details

| Field | Source |
| --- | --- |
| Name | `item_name_en` if present, else the official Malay `item_name` (both shown where useful) |
| Package size | Parsed size (`850G`, `5X79G`, `10S`, `8 PADS`), else the PriceCatcher unit; grade weight ranges (eggs) are not treated as sizes |
| Image | Pre-compressed WebP thumbnail listed in `catalogue_image_manifest.py`; neutral icon otherwise |
| SARA label | Shown only for SARA-category candidates; never claims verified eligibility |
| Price | Nearby price range, or the national estimate range with a note that it is estimated from prices across stores |

The details window also hosts nutrition (Epic 7), healthier alternatives (Epic 7) and price trends (Epic 4). It also opens from a planned item's name (with price trends already open) and from a checklist item's name, through `GET /items/lookup` (`components/item-details-dialog.tsx`); those copies offer no "Add to basket".

## Basket rules (frontend)

`lib/basket-state.ts` and `lib/result-row.ts` own basket logic:

- Quantity 1–99, whole numbers only; invalid input disables *Add* and shows a message.
- Adding an item already in the basket increases its quantity instead of creating a second line.
- Removing the last line empties the basket; *Continue* with an empty basket is blocked.
- The header basket button shows the total number of units.

## Language

All UI text comes from `COPY.en` / `COPY.ms` in `frontend/lib/i18n.ts`; the chosen locale is stored in `smartcart-locale`. English category labels come from `category_translation` (55 rows, seeded by `database/seed_category_translations.py`); Malay labels and unlabelled categories use the official PriceCatcher category name. English item names are seeded by `database/seed_item_names.py` from `database/data/item_name_en.csv` (757 rows); a blank or missing English name falls back to the Malay name.
