# Code ownership

Who wrote and maintains each source file, derived from the repository's git history on 12 October 2026 (commit `cc35d4a`), plus the weekly forecasting files added in `092db28` (same day). Files deleted in the same day's dead-code cleanup are not listed. The same owners appear in a header comment at the top of each file.

## Method

- **Owners** are authors of at least 10 % of the file's current lines (`git blame -w -M -C`, whitespace ignored, moved/copied lines followed), largest share first.
- **Contributors** have under 10 % of current lines, or committed changes to the file that were later rewritten.
- Git identities are merged: `stak0015` → Shunnosuke Takei; `Randy Mong` → Chenglong Meng; `Zhihao` → Zhihao Zhao.
- Lines resolved during merges are attributed to whoever made the merge commit, so integration work by the main developer can hide some original authorship. Treat percentages as a guide; the board assignments in [Requirements](../02-requirements/README.md) show who delivered each story.
- Uncommitted working-tree lines at the time of analysis (two nutrition scripts) are attributed to Shunnosuke Takei, the owner of that working copy. Documentation comments added in the 12 October restructure are not counted.
- Code headers and the tables below use short names: **Shun** = Shunnosuke Takei, **Randy** = Chenglong Meng, **Zhihao** = Zhihao Zhao. Header format: `Owners: Shun, Randy | Contributors: Zhihao`.
- Generated files (`backend/smartcart/catalogue_image_manifest.py`) carry no header so regeneration does not drop it.
- Tests are not listed; they follow the module they test.
- To refresh: rerun `git blame --line-porcelain -w -M -C <file>` per file with the identity mapping above, then update this table and the file headers.

## Summary

| Person | Files owned (≥ 10 % of lines) | Primary owner of |
| --- | --- | --- |
| Shun | 147 | 137 |
| Zhihao | 24 | 13 |
| Randy | 16 | 4 |

Members without source files in the repository: Huan Yang (design, prototypes, e-portfolio) and Wei Yuan Tan (governance documents).

## Backend application

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`backend/main.py`](../../backend/main.py) | Shun (74 %), Randy (26 %) | — |
| [`backend/smartcart/__init__.py`](../../backend/smartcart/__init__.py) | Shun (100 %) | — |
| [`backend/smartcart/alternatives.py`](../../backend/smartcart/alternatives.py) | Shun (100 %) | — |
| [`backend/smartcart/api.py`](../../backend/smartcart/api.py) | Shun (74 %), Randy (16 %), Zhihao (10 %) | — |
| [`backend/smartcart/catalogue.py`](../../backend/smartcart/catalogue.py) | Shun (82 %), Zhihao (16 %) | Randy |
| [`backend/smartcart/catalogue_image_manifest.py`](../../backend/smartcart/catalogue_image_manifest.py) | Shun (100 %) | — |
| [`backend/smartcart/categories.py`](../../backend/smartcart/categories.py) | Shun (100 %) | — |
| [`backend/smartcart/cerebras_narrator.py`](../../backend/smartcart/cerebras_narrator.py) | Shun (100 %) | — |
| [`backend/smartcart/config.py`](../../backend/smartcart/config.py) | Shun (93 %) | Zhihao |
| [`backend/smartcart/database.py`](../../backend/smartcart/database.py) | Shun (100 %) | — |
| [`backend/smartcart/errors.py`](../../backend/smartcart/errors.py) | Shun (100 %) | — |
| [`backend/smartcart/forecast_rules.py`](../../backend/smartcart/forecast_rules.py) | Shun (100 %) | — |
| [`backend/smartcart/fuel.py`](../../backend/smartcart/fuel.py) | Shun (100 %) | — |
| [`backend/smartcart/item_nutrition.py`](../../backend/smartcart/item_nutrition.py) | Shun (98 %) | Zhihao |
| [`backend/smartcart/maps.py`](../../backend/smartcart/maps.py) | Shun (86 %), Randy (10 %) | Zhihao |
| [`backend/smartcart/models.py`](../../backend/smartcart/models.py) | Shun (51 %), Zhihao (26 %), Randy (23 %) | — |
| [`backend/smartcart/multi_store.py`](../../backend/smartcart/multi_store.py) | Randy (96 %) | Shun |
| [`backend/smartcart/multi_store_pricing.py`](../../backend/smartcart/multi_store_pricing.py) | Randy (81 %), Shun (19 %) | — |
| [`backend/smartcart/nutrition.py`](../../backend/smartcart/nutrition.py) | Zhihao (83 %), Shun (17 %) | — |
| [`backend/smartcart/nutrition_comparison.py`](../../backend/smartcart/nutrition_comparison.py) | Shun (100 %) | — |
| [`backend/smartcart/nutrition_repository.py`](../../backend/smartcart/nutrition_repository.py) | Shun (100 %) | — |
| [`backend/smartcart/pack_ratios.py`](../../backend/smartcart/pack_ratios.py) | Zhihao (56 %), Shun (44 %) | — |
| [`backend/smartcart/period_analytics.py`](../../backend/smartcart/period_analytics.py) | Shun (100 %) | — |
| [`backend/smartcart/premises.py`](../../backend/smartcart/premises.py) | Shun (77 %), Randy (23 %) | — |
| [`backend/smartcart/price_history.py`](../../backend/smartcart/price_history.py) | Shun (100 %) | — |
| [`backend/smartcart/pricing.py`](../../backend/smartcart/pricing.py) | Shun (68 %), Zhihao (32 %) | — |
| [`backend/smartcart/recommendation.py`](../../backend/smartcart/recommendation.py) | Shun (82 %), Zhihao (13 %) | Randy |
| [`backend/smartcart/report_insights.py`](../../backend/smartcart/report_insights.py) | Shun (100 %) | — |
| [`backend/smartcart/report_models.py`](../../backend/smartcart/report_models.py) | Shun (100 %) | — |
| [`backend/smartcart/reporting.py`](../../backend/smartcart/reporting.py) | Shun (100 %) | — |
| [`backend/smartcart/sara.py`](../../backend/smartcart/sara.py) | Zhihao (100 %) | — |
| [`backend/smartcart/translations.py`](../../backend/smartcart/translations.py) | Shun (100 %) | — |

## Backend scripts

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`backend/scripts/requalify_price_forecasts.py`](../../backend/scripts/requalify_price_forecasts.py) | Shun (100 %) | — |

## Weekly forecasting

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`forecasting/model.py`](../../forecasting/model.py) | Shun (100 %) | — |
| [`forecasting/refresh.py`](../../forecasting/refresh.py) | Shun (100 %) | — |
| [`forecasting/store.py`](../../forecasting/store.py) | Shun (100 %) | — |

## Database schema, ingestion and migrations

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`database/enrich_lookup_premise_postcodes_places.py`](../../database/enrich_lookup_premise_postcodes_places.py) | Shun (100 %) | — |
| [`database/geocode_postcodes.py`](../../database/geocode_postcodes.py) | Shun (100 %) | — |
| [`database/identify_sara_chains.py`](../../database/identify_sara_chains.py) | Shun (100 %) | — |
| [`database/import_nutrition.py`](../../database/import_nutrition.py) | Shun (100 %) | — |
| [`database/ingest_pricecatcher.py`](../../database/ingest_pricecatcher.py) | Shun (94 %) | Zhihao |
| [`database/migrate_item_name_en.py`](../../database/migrate_item_name_en.py) | Shun (100 %) | — |
| [`database/migrate_median_prices.py`](../../database/migrate_median_prices.py) | Shun (100 %) | — |
| [`database/migrate_pack_quantities.py`](../../database/migrate_pack_quantities.py) | Shun (100 %) | — |
| [`database/migrate_premise_open_status.py`](../../database/migrate_premise_open_status.py) | Shun (100 %) | — |
| [`database/migrate_sara_chain_partners.py`](../../database/migrate_sara_chain_partners.py) | Shun (100 %) | — |
| [`database/migrate_sara_verified.py`](../../database/migrate_sara_verified.py) | Shun (100 %) | — |
| [`database/migrations/001_nutrition.sql`](../../database/migrations/001_nutrition.sql) | Shun (100 %) | — |
| [`database/migrations/002_item_nutrition.sql`](../../database/migrations/002_item_nutrition.sql) | Shun (100 %) | — |
| [`database/migrations/003_price_forecasts.sql`](../../database/migrations/003_price_forecasts.sql) | Shun (100 %) | — |
| [`database/sara_chain_catalog.py`](../../database/sara_chain_catalog.py) | Shun (100 %) | — |
| [`database/schema.sql`](../../database/schema.sql) | Shun (96 %) | Zhihao |
| [`database/seed_category_translations.py`](../../database/seed_category_translations.py) | Shun (100 %) | — |
| [`database/seed_demo_alternatives.py`](../../database/seed_demo_alternatives.py) | Shun (100 %) | — |
| [`database/seed_item_names.py`](../../database/seed_item_names.py) | Shun (100 %) | — |
| [`database/verify_database.py`](../../database/verify_database.py) | Shun (100 %) | — |
| [`database/verify_nutrition_runtime.py`](../../database/verify_nutrition_runtime.py) | Shun (100 %) | — |

## Nutrition data scripts

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`data/nutrition/scripts/audit_recommendations.py`](../../data/nutrition/scripts/audit_recommendations.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/build_item_nutrition.py`](../../data/nutrition/scripts/build_item_nutrition.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/export_catalogue.py`](../../data/nutrition/scripts/export_catalogue.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/import_afcd.py`](../../data/nutrition/scripts/import_afcd.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/import_fndds.py`](../../data/nutrition/scripts/import_fndds.py) | Shun (98 %) | Zhihao |
| [`data/nutrition/scripts/import_myfcd.py`](../../data/nutrition/scripts/import_myfcd.py) | Shun (99 %) | Zhihao |
| [`data/nutrition/scripts/import_singapore.py`](../../data/nutrition/scripts/import_singapore.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/import_usda.py`](../../data/nutrition/scripts/import_usda.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/map_ingredient_nutrition.py`](../../data/nutrition/scripts/map_ingredient_nutrition.py) | Shun (100 %) | — |
| [`data/nutrition/scripts/map_prepared_foods.py`](../../data/nutrition/scripts/map_prepared_foods.py) | Shun (100 %) | — |

## Frontend routes

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`frontend/app/basket/page.tsx`](../../frontend/app/basket/page.tsx) | Shun (100 %) | — |
| [`frontend/app/checklist/page.tsx`](../../frontend/app/checklist/page.tsx) | Shun (100 %) | — |
| [`frontend/app/compare/page.tsx`](../../frontend/app/compare/page.tsx) | Shun (100 %) | — |
| [`frontend/app/history/page.tsx`](../../frontend/app/history/page.tsx) | Shun (100 %) | — |
| [`frontend/app/layout.tsx`](../../frontend/app/layout.tsx) | Shun (100 %) | — |
| [`frontend/app/location/page.tsx`](../../frontend/app/location/page.tsx) | Shun (100 %) | — |
| [`frontend/app/page.tsx`](../../frontend/app/page.tsx) | Shun (100 %) | — |
| [`frontend/app/planner/page.tsx`](../../frontend/app/planner/page.tsx) | Shun (100 %) | — |
| [`frontend/app/reports/page.tsx`](../../frontend/app/reports/page.tsx) | Shun (100 %) | — |
| [`frontend/app/shop/page.tsx`](../../frontend/app/shop/page.tsx) | Shun (100 %) | — |
| [`frontend/app/store/[id]/page.tsx`](../../frontend/app/store/[id]/page.tsx) | Shun (100 %) | — |

## Frontend components

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`frontend/components/catalogue-item-dialog.tsx`](../../frontend/components/catalogue-item-dialog.tsx) | Shun (92 %) | Zhihao |
| [`frontend/components/catalogue-item-image.tsx`](../../frontend/components/catalogue-item-image.tsx) | Shun (100 %) | — |
| [`frontend/components/estimated-savings-summary.tsx`](../../frontend/components/estimated-savings-summary.tsx) | Shun (100 %) | — |
| [`frontend/components/healthier-alternatives.tsx`](../../frontend/components/healthier-alternatives.tsx) | Zhihao (83 %), Shun (17 %) | — |
| [`frontend/components/icons/basket.ts`](../../frontend/components/icons/basket.ts) | Shun (100 %) | — |
| [`frontend/components/icons/compare.ts`](../../frontend/components/icons/compare.ts) | Shun (100 %) | — |
| [`frontend/components/icons/location.ts`](../../frontend/components/icons/location.ts) | Shun (100 %) | — |
| [`frontend/components/icons/saved.ts`](../../frontend/components/icons/saved.ts) | Shun (100 %) | — |
| [`frontend/components/item-nutrition.tsx`](../../frontend/components/item-nutrition.tsx) | Shun (96 %) | Zhihao |
| [`frontend/components/journey-screens.tsx`](../../frontend/components/journey-screens.tsx) | Shun (80 %), Randy (20 %) | — |
| [`frontend/components/multi-store-panel.tsx`](../../frontend/components/multi-store-panel.tsx) | Randy (69 %), Shun (31 %) | — |
| [`frontend/components/nearby-price-status.tsx`](../../frontend/components/nearby-price-status.tsx) | Shun (100 %) | — |
| [`frontend/components/plan-comparison.tsx`](../../frontend/components/plan-comparison.tsx) | Shun (86 %), Randy (14 %) | — |
| [`frontend/components/plan-detail.tsx`](../../frontend/components/plan-detail.tsx) | Shun (90 %), Randy (10 %) | — |
| [`frontend/components/price-history.tsx`](../../frontend/components/price-history.tsx) | Shun (100 %) | — |
| [`frontend/components/price-series-chart.tsx`](../../frontend/components/price-series-chart.tsx) | Shun (100 %) | — |
| [`frontend/components/quantity-selector.tsx`](../../frontend/components/quantity-selector.tsx) | Shun (94 %) | Zhihao |
| [`frontend/components/recommendation-basket-row.tsx`](../../frontend/components/recommendation-basket-row.tsx) | Shun (100 %) | — |
| [`frontend/components/report-screens.tsx`](../../frontend/components/report-screens.tsx) | Shun (100 %) | — |
| [`frontend/components/shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx) | Shun (81 %), Zhihao (19 %) | — |
| [`frontend/components/shopping-history.tsx`](../../frontend/components/shopping-history.tsx) | Shun (100 %) | — |
| [`frontend/components/shopping-step-nav.tsx`](../../frontend/components/shopping-step-nav.tsx) | Shun (100 %) | — |
| [`frontend/components/smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) | Shun (88 %) | Randy, Zhihao |
| [`frontend/components/statistics-panel.tsx`](../../frontend/components/statistics-panel.tsx) | Shun (100 %) | — |
| [`frontend/components/store-basket-row.tsx`](../../frontend/components/store-basket-row.tsx) | Shun (98 %) | Randy |
| [`frontend/components/store-chain-logo.tsx`](../../frontend/components/store-chain-logo.tsx) | Shun (100 %) | — |
| [`frontend/components/store-tags.tsx`](../../frontend/components/store-tags.tsx) | Shun (52 %), Randy (48 %) | — |
| [`frontend/components/transport-mode-icon.tsx`](../../frontend/components/transport-mode-icon.tsx) | Shun (61 %), Zhihao (39 %) | — |
| [`frontend/components/travel-cost-breakdown.tsx`](../../frontend/components/travel-cost-breakdown.tsx) | Shun (100 %) | — |
| [`frontend/components/trip-facts.tsx`](../../frontend/components/trip-facts.tsx) | Shun (100 %) | — |
| [`frontend/components/ui-icon.tsx`](../../frontend/components/ui-icon.tsx) | Shun (100 %) | — |

## Frontend libraries

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`frontend/lib/api-base.ts`](../../frontend/lib/api-base.ts) | Shun (100 %) | — |
| [`frontend/lib/api-client.ts`](../../frontend/lib/api-client.ts) | Shun (100 %) | — |
| [`frontend/lib/api.ts`](../../frontend/lib/api.ts) | Shun (52 %), Zhihao (30 %), Randy (19 %) | — |
| [`frontend/lib/basket-coverage.ts`](../../frontend/lib/basket-coverage.ts) | Zhihao (100 %) | — |
| [`frontend/lib/basket-lines.ts`](../../frontend/lib/basket-lines.ts) | Zhihao (64 %), Shun (36 %) | — |
| [`frontend/lib/basket-state.ts`](../../frontend/lib/basket-state.ts) | Shun (100 %) | — |
| [`frontend/lib/catalogue-image.ts`](../../frontend/lib/catalogue-image.ts) | Shun (100 %) | — |
| [`frontend/lib/catalogue-price.ts`](../../frontend/lib/catalogue-price.ts) | Shun (100 %) | — |
| [`frontend/lib/checklist-export.ts`](../../frontend/lib/checklist-export.ts) | Zhihao (99 %) | Shun |
| [`frontend/lib/contracts.ts`](../../frontend/lib/contracts.ts) | Shun (60 %), Randy (26 %), Zhihao (14 %) | — |
| [`frontend/lib/estimated-savings.ts`](../../frontend/lib/estimated-savings.ts) | Shun (100 %) | — |
| [`frontend/lib/format-rm.ts`](../../frontend/lib/format-rm.ts) | Zhihao (100 %) | — |
| [`frontend/lib/i18n.ts`](../../frontend/lib/i18n.ts) | Shun (68 %), Randy (18 %), Zhihao (14 %) | — |
| [`frontend/lib/inbox.ts`](../../frontend/lib/inbox.ts) | Shun (98 %) | Randy |
| [`frontend/lib/item-name.ts`](../../frontend/lib/item-name.ts) | Shun (100 %) | — |
| [`frontend/lib/item-stack.ts`](../../frontend/lib/item-stack.ts) | Zhihao (100 %) | — |
| [`frontend/lib/multi-store.ts`](../../frontend/lib/multi-store.ts) | Randy (86 %), Shun (14 %) | — |
| [`frontend/lib/next-trip.ts`](../../frontend/lib/next-trip.ts) | Shun (97 %) | Zhihao |
| [`frontend/lib/nutrition.ts`](../../frontend/lib/nutrition.ts) | Zhihao (94 %) | Shun |
| [`frontend/lib/package-size.ts`](../../frontend/lib/package-size.ts) | Shun (100 %) | — |
| [`frontend/lib/period-analytics.ts`](../../frontend/lib/period-analytics.ts) | Shun (99 %) | Randy |
| [`frontend/lib/plan-detail-edits.ts`](../../frontend/lib/plan-detail-edits.ts) | Shun (100 %) | — |
| [`frontend/lib/planned-week.ts`](../../frontend/lib/planned-week.ts) | Shun (100 %) | — |
| [`frontend/lib/price-history.ts`](../../frontend/lib/price-history.ts) | Shun (100 %) | — |
| [`frontend/lib/recommendation-detail.ts`](../../frontend/lib/recommendation-detail.ts) | Shun (97 %) | Randy, Zhihao |
| [`frontend/lib/report-consent.ts`](../../frontend/lib/report-consent.ts) | Shun (100 %) | — |
| [`frontend/lib/report-format.ts`](../../frontend/lib/report-format.ts) | Shun (100 %) | — |
| [`frontend/lib/report-generation.ts`](../../frontend/lib/report-generation.ts) | Shun (98 %) | Randy |
| [`frontend/lib/report-language.ts`](../../frontend/lib/report-language.ts) | Shun (100 %) | — |
| [`frontend/lib/result-row.ts`](../../frontend/lib/result-row.ts) | Zhihao (88 %), Shun (12 %) | — |
| [`frontend/lib/shopping-checklist.ts`](../../frontend/lib/shopping-checklist.ts) | Shun (75 %), Zhihao (23 %) | Randy |
| [`frontend/lib/shopping-session.ts`](../../frontend/lib/shopping-session.ts) | Shun (100 %) | — |
| [`frontend/lib/statistics-view.ts`](../../frontend/lib/statistics-view.ts) | Shun (100 %) | — |
| [`frontend/lib/travel.ts`](../../frontend/lib/travel.ts) | Shun (100 %) | — |
| [`frontend/lib/trip-history.ts`](../../frontend/lib/trip-history.ts) | Zhihao (58 %), Shun (40 %) | Randy |
| [`frontend/lib/trip-travel-cost.ts`](../../frontend/lib/trip-travel-cost.ts) | Shun (100 %) | — |
| [`frontend/lib/visible-stores.ts`](../../frontend/lib/visible-stores.ts) | Zhihao (80 %), Shun (20 %) | — |

## Frontend scripts

| File | Owners (share of current lines) | Contributors |
| --- | --- | --- |
| [`frontend/scripts/check-catalogue-controls-ui.cjs`](../../frontend/scripts/check-catalogue-controls-ui.cjs) | Shun (100 %) | — |
| [`frontend/scripts/check-feedback-ui.cjs`](../../frontend/scripts/check-feedback-ui.cjs) | Shun (99 %) | Zhihao |
| [`frontend/scripts/check-planned-items-ui.cjs`](../../frontend/scripts/check-planned-items-ui.cjs) | Shun (100 %) | — |
| [`frontend/scripts/check-price-history-ui.cjs`](../../frontend/scripts/check-price-history-ui.cjs) | Shun (100 %) | — |
| [`frontend/scripts/check-short-price-history-ui.cjs`](../../frontend/scripts/check-short-price-history-ui.cjs) | Shun (100 %) | — |
| [`frontend/scripts/optimize_catalogue_images.py`](../../frontend/scripts/optimize_catalogue_images.py) | Shun (100 %) | — |
| [`frontend/scripts/optimize_chain_logos.py`](../../frontend/scripts/optimize_chain_logos.py) | Shun (100 %) | — |
| [`frontend/scripts/sync-premise-locations.mjs`](../../frontend/scripts/sync-premise-locations.mjs) | Shun (96 %) | Zhihao |
