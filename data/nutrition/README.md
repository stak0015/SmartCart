# Epic 7 nutrition data

Static, version-controlled nutrition reference data for the Healthier
alternatives feature (Epic 7). Nothing here is generated at runtime and
nothing is fetched from the network by the application.

## Files

| File | Purpose |
|---|---|
| `foods.json` | Nutrition reference entries, each with a source id, the source record code, a comparison basis and nutrients per 100 g. |
| `mappings.json` | Approved catalogue-to-catalogue alternative mappings plus the rule set that justifies each one. |

## Data sources

| id | Dataset | Publisher | Licence |
|---|---|---|---|
| `MyFCD-1997` | Malaysian Food Composition Database (1997 edition) | Ministry of Health Malaysia / Institute for Medical Research | Published on a Government of Malaysia public website; no explicit open licence stated. Referenced for academic use with attribution. |
| `MyFCD-current` | Malaysian Food Composition Database (current edition) | Ministry of Health Malaysia / Institute for Medical Research | Same as above. Used here only for the fatty-acid composition of blended cooking oil. |
| `USDA-FDC` | USDA FoodData Central | U.S. Department of Agriculture, Agricultural Research Service | Public domain (CC0 1.0 Universal). |

Retrieved 2026-10-08 from the publisher sites. Each entry keeps the source
record code (`source_code`) so any value can be traced back and re-checked.

## Coverage

87 approved mappings across 7 rules:

| Rule | Meaning | Mappings |
|---|---|---|
| H1 | Full-cream or sweetened milk → low-fat milk powder | 16 |
| H2 | Full-cream fresh milk → low-fat fresh milk | 5 |
| H3 | White or wheatgerm bread → wholemeal bread | 2 |
| H4 | Palm or blended cooking oil, or ghee → corn oil | 30 |
| H5 | Red meat (beef, buffalo, mutton, pork) → chicken breast | 28 |
| H6 | Dried or salted seafood → fresh fish | 3 |
| H7 | Salted egg → fresh hen egg | 2 |

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
- Some mappings use a generic food entry rather than the exact brand (for
  example pork cuts map to a generic pork entry). The item's entry is still
  disclosed by source and code.
- MyFCD does not state an explicit open licence; it is recorded here as a
  Government of Malaysia public reference used with attribution.
