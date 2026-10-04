# US 4i.7 Festival Price Dataset Methods

## Dataset identity

- Dataset ID: US4i.7
- Dataset version: 4i.7-dataset-v3
- Effective date: 2026-10-04
- Registry: data/festival_method_registry.json
- Manifest: data/festival_dataset_manifest.json

## Single source of truth

US 4i.1 to US 4i.6 must consume only the US 4i.7 output datasets listed in the
manifest. Displayed figures must not be calculated directly from raw CSV files
or from third-party price sources.

The significance dataset also includes a per-row `daily_index` series used by the US 4i.1 evidence chart.

The four output datasets are:

- festival_significance.json
- festival_price_stats.json
- festival_rise_ratios.json
- festival_historical_prices.json
- festival_specialty_stats.json

## Source data

- PriceCatcher monthly price files: pricecatcher_*.csv
- PriceCatcher item lookup: lookup_item.csv
- PriceCatcher premise lookup: lookup_premise.csv
- Maintained festival register: data/festivals.json

## Method versions

| Method | Version | Effective date | Purpose |
|---|---|---|---|
| significance | 4i.7-v1 | 2026-10-04 | Per-state festival significance and 3-sigma outlier handling |
| key_windows | 4i.7.2-v1 | 2026-10-04 | Festival-state rise and recovery windows |
| item_price_stats | 4i.7.3-v1 | 2026-10-04 | Item baseline, peak, recovery prices and category summaries |
| average_rise_ratio | 4i.7.4-v1 | 2026-10-04 | Equal-weighted festival average rise ratio |
| historical_price_baseline | 4i.7.5-v1 | 2026-10-04 | Historical average price with fallback quality |
| festival_specialty_analysis | 4i.7.7-v1 | 2026-10-04 | Festival-specific key commodity rise comparison and flag |

## Historical baseline quality

- historical: full previous-year window coverage, currently unavailable.
- historical_partial: previous-year window exists but coverage is below 80 percent.
- prior_occurrence: most recent prior festival occurrence was used.
- current_fallback: current rise window was used because no historical data was available.
- unavailable: no usable observations.
- window_not_ready: the festival-state key window was not ready.

Consumers must not treat historical_partial, prior_occurrence, or
current_fallback as a complete previous-year value.

## Version change rule

When a method or formula changes:

1. Append a new method version and effective date to
   data/festival_method_registry.json.
2. Bump the dataset version in the registry.
3. Regenerate all affected output datasets.
4. Rebuild data/festival_dataset_manifest.json.
5. Run the validation tests and manifest builder before release.

Existing method versions must not be rewritten or reused.
