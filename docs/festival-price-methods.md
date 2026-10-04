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

The five output datasets are:

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
current_fallback as a complete previous-year value. Early-purchase savings may
use historical_partial only as a disclosed partial historical baseline;
prior_occurrence, current_fallback, unavailable, and window_not_ready are not
eligible.

## Top recommendation rule

- Uses only festival_price_stats rows with status=ok, rise_status=rise and
  sample_status=full.
- Candidates are sorted by their own historical rise percentage in descending
  order before the top ten are selected.
- A row is marked as a festival-specific item when AC 4i.7.7 flagged its item
  code for the selected festival and state.
- The current price is the cached cross-store median from item.median_price_rm.
- If the catalogue item id or current price is unavailable, the recommendation
  remains visible but cannot be added to the basket; the API must not invent an
  id or price.

## Early-purchase saving rule

- Only festival_historical_prices rows with baseline_quality=historical_partial
  are eligible. Fallback rows are not treated as a historical same-period
  baseline.
- A purchase qualifies only when its recorded date is inside the matched
  festival-state current_rise_start to current_rise_end window.
- Saving is calculated per bought catalogue line as
  (historical_avg_price - paid_unit_price) x quantity.
- Zero or negative differences are excluded, not shown as a saving.
- The result is returned as a separate early-purchase total and is never added
  to ordinary comparison savings.

## Estimated price rule

- Estimated price method version: 4i.6.1-v1
- For items without a complete measured item window, the rise percentage is the festival-state average rise ratio.
- The expected price range is the cached cross-store median current price applied with that rise ratio.
- The UI label for these values is "Estimated from the festival average rise".

## Festival alert rule

- Alert rule version: 4i.2.1-v1
- Uses the current key-window method to show Shop/Basket banners only while the current date is inside the rise window.
- State filtering uses national festivals plus state-level festivals applicable to the selected state.
- Affected item counts are derived from item_price_stats rows with status=ok and rise_status=rise.

## Item forecast rule

- Forecast method version: 4i.3.5-v1.
- Uses the active pre-festival rise window and the selected state.
- Returns the festival name, a rise percentage range, and the item’s expected price range.
- The rise range is derived from the item’s baseline price and its forecast price range; both bounds are clamped at zero.
- If no forecast is active for the item and state, the API returns `forecast: null` and the UI shows no reminder.

## Checkout preview rule

- Preview method version: 4i.3.6-v1.
- Only actual store prices (`priceSource = store`) participate. Median estimates are excluded.
- Per line: `max(0, forecast maximum price - actual unit price) x quantity`.
- The result is displayed as a separate early-purchase saving and is not merged into comparison savings or historical early-purchase savings.

## Product data-richness ordering

- Default product browsing and search results are ordered by match tier, then store-price coverage, then median-price availability, then item name.
- Match tiers are exact, prefix, and contains.
- Items without current price observations remain in the result set but appear last within their match tier.

## Version change rule

When a method or formula changes:

1. Append a new method version and effective date to
   data/festival_method_registry.json.
2. Bump the dataset version in the registry.
3. Regenerate all affected output datasets.
4. Rebuild data/festival_dataset_manifest.json.
5. Run the validation tests and manifest builder before release.

Existing method versions must not be rewritten or reused.
