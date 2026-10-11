# Epic 7 nutrition data

Version-controlled import snapshots for the nutrition features (Epic 7).
The application reads nutrient values and their publisher provenance from
one PostgreSQL table, `nutrition_food`. Item references and their reviewed
mapping metadata live on existing `item` rows. Alternative rules and comparison
policy stay in the existing files/scripts. Publisher
data is not downloaded or generated at runtime. Food values in JSON remain
reproducible import snapshots and offline audit fixtures; editing those values
alone does not update the database.

## Database import

Run from the repository root:

```powershell
backend\.venv\Scripts\python.exe database\import_nutrition.py
backend\.venv\Scripts\python.exe database\import_nutrition.py --verify-only
backend\.venv\Scripts\python.exe database\verify_nutrition_runtime.py
```

The importer reads `DATABASE_URL_UNPOOLED` or `DATABASE_URL` from the environment,
then falls back to the ignored `database/.env` (override with `--env-file`).
Use an unpooled connection for hosted migrations. Never commit real URLs.
Import and exact document/column verification share one transaction. Failed
validation leaves the previous dataset intact. Rerunning upserts imported
food records and backfills item nutrition references from the reviewed snapshots.
Existing food keys remain stable. Other catalogue fields, prices and premises
are unchanged. Back up any separately maintained nutrition
edits before deliberately reimporting a snapshot.

`nutrition_food` uses `items` and `foods` namespaces because overlapping
current/legacy IDs have different nutrient values and provenance. Its primary
key is `(dataset, food_id)`. Publisher details are embedded in each row, so
there is no separate source or mapping table.

| Column | Meaning |
|---|---|
| `nutrition_id` | Stable numeric key referenced by `item.nutrition_food_id` |
| `dataset` | Current item profiles (`items`) or reference snapshot (`foods`) |
| `food_id` | Stable food identity within that namespace |
| `source_id` | Publisher/dataset identity |
| `source_record_code` | Original publisher record identifier |
| `description` | Food description |
| `basis` | `per_100g` or `per_100ml` |
| `nutrients` | JSONB nutrient values; unknowns remain null |
| `source_metadata` | JSONB source name, URL, licence and provenance |
| `document` | Original food metadata, retaining source-specific fields |
| `snapshot_sha256` | Import-snapshot checksum |
| `imported_at` | Import timestamp |

The migration also removes the seven tables introduced by the earlier
multi-table nutrition prototype, after preserving its food/source data.
It does not use `CASCADE` or change unrelated application tables.

`item.nutrition_food_id` is a nullable foreign key to
`nutrition_food.nutrition_id`. `item.nutrition_mapping_metadata` stores approval,
generic/product match type, rationale, source evidence and basis variants.
Unmapped items have null values. The API follows this database reference;
it does not read `item_nutrition.json` at runtime. The mapping metadata is
kept on `item` to preserve disclosures without creating another table.

Nutrient reads have no persistent process cache and no automatic JSON fallback.
Alternative rules retain their existing file-based loading behaviour. Missing profiles
still return the existing unavailable response;
database failures are surfaced as service errors. External API response shapes,
generic/product disclosures, basis compatibility and comparison rules are
unchanged. Offline audits explicitly supply snapshots and comparison policy.

## Files

| File | Purpose |
|---|---|
| `foods.json` | Nutrition reference entries, each with a source id, the source record code, a comparison basis and nutrients per 100 g. |
| `mappings.json` | Approved catalogue-to-catalogue alternative mappings plus the rule set that justifies each one. |
| `item_nutrition.json` | Import snapshot for foods and reviewed item references/metadata; offline audit fixture. Runtime item nutrition reads use the database. |
| `comparison_policy.json` | File-based comparison thresholds, priorities and trade-off checks; not imported. |

## Data sources

| id | Dataset | Publisher | Licence |
|---|---|---|---|
| `MyFCD-1997` | Malaysian Food Composition Database (1997 edition) | Ministry of Health Malaysia / Institute for Medical Research | Published on a Government of Malaysia public website; no explicit open licence stated. Referenced for academic use with attribution. |
| `MyFCD-current` | Malaysian Food Composition Database (current edition) | Ministry of Health Malaysia / Institute for Medical Research | Same as above. Used here only for the fatty-acid composition of blended cooking oil. |
| `USDA-FDC` | USDA FoodData Central | U.S. Department of Agriculture, Agricultural Research Service | Public domain (CC0 1.0 Universal). |

Retrieved 2026-10-08 from the publisher sites. Each entry keeps the source
record code (`source_code`) so any value can be traced back and re-checked.

## How alternatives are chosen

Each rule defines a candidate pool: catalogue items in the same product family
that a shopper can add to the basket. Alternatives are picked by **price
availability, never by nutrition**:

1. a candidate is eligible only when it has at least **5 official price
   observations** (rows in `current_status` with a positive price) — this keeps
   a single odd observation from deciding the outcome;
2. the **two** eligible candidates with the lowest **median** observed official
   price are approved for that rule;
3. when no candidate in the pool carries a price at all, the single previously
   approved unpriced alternative is kept as a fallback, so an entire product
   family does not lose the feature.

Price only decides *which* catalogue item is offered. The reason shown to the
shopper is always the nutrition difference, and a nutritional recommendation
does not imply a lower price.

## Coverage

151 approved mappings across 7 rules, covering 87 distinct catalogue items:

| Rule | Meaning | Alternatives offered | Mappings |
|---|---|---|---|
| H1 | Full-cream or sweetened milk → low-fat milk powder | 1 (no priced candidate; fallback) | 16 |
| H2 | Full-cream fresh milk → low-fat fresh milk | 1 (no priced candidate; fallback) | 5 |
| H3 | White or wheatgerm bread → wholemeal bread | 1 (no priced candidate; fallback) | 2 |
| H4 | Palm or blended cooking oil, or ghee → corn oil | 2 (two brands) | 60 |
| H5 | Red meat (beef, buffalo, mutton, pork) → chicken | 2 | 56 |
| H6 | Dried or salted seafood → fresh fish | 2 | 6 |
| H7 | Salted egg → fresh hen egg | 2 | 6 |

The PriceCatcher catalogue is mostly raw produce and branded staples, so
only these product families have a defensible healthier counterpart in the
catalogue itself. Every other catalogue item has no approved mapping and is
shown with the "no healthier alternatives" message (AC 7.1.4).

## Rules for adding data

1. An alternative must itself be an active catalogue item, so the shopper can
   open and add it.
2. Every mapping needs a nutrition-based reason on a single comparison
   nutrient, with both sides on the same basis.
3. Nutrients must come from a listed source and keep its record code.
4. Missing or non-comparable values stay null. They are never treated as zero
   and never used to justify a recommendation.
5. `pytest backend/tests/test_nutrition.py` must pass.

## Known limitations

- MyFCD entries do not carry a fatty-acid breakdown, so saturated-fat
  comparisons use USDA FoodData Central for both sides.
- Some mappings use a generic food entry rather than the exact product: H5
  (whole chicken) and H6 (fish species) rely on a family entry. Each such
  mapping carries `"generic_mapping": true` so the interface discloses it.
- Comparing pack prices across different pack sizes means the cheaper pack is
  not always the cheaper unit price; the mapping is about which alternative is
  offered, not about declaring a saving.
- MyFCD does not state an explicit open licence; it is recorded here as a
  Government of Malaysia public reference used with attribution.

## Local research and audit outputs

Detailed research notes and generated audit reports live in ignored
[`research/nutrition/`](../../research/nutrition/). They are local development
artifacts; approved nutrition data and app-required metadata stay here.
