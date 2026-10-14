# API reference

Base path: `/api`. Interactive OpenAPI docs: `http://localhost:8000/docs` when running locally. Request/response models: `backend/smartcart/models.py` (camelCase on the wire) and `backend/smartcart/report_models.py` (reports).

Every `/api/` response carries `Cache-Control: private, no-store`. Errors use one envelope:

```json
{ "error": { "code": "INVALID_TRAVEL_LIMIT", "message": "Distance must be 0.5-100 km and time must be 5-180 minutes; both values are required for a combined limit." } }
```

Errors that any endpoint can return:

| Code | Status | Cause |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | Request body failed validation (fixed message; the body is not echoed) |
| `DATABASE_NOT_CONFIGURED` | 503 | No `DATABASE_URL` (every database-backed endpoint) |
| `INTERNAL_ERROR` | 500 | Unexpected exception (logged with the request path only) |

## Endpoints

| Method | Path | Purpose | Epic |
| --- | --- | --- | --- |
| GET | `/health` | Liveness and catalogue row count | — |
| GET | `/items/search` | Search, filter, sort and page the catalogue | 1, 2.5 |
| GET | `/items/lookup` | Catalogue rows for known item IDs (item details from planned items and the checklist) | 4, 5 |
| GET | `/items/categories` | Broad categories with labels | 1 |
| GET | `/items/{item_code}/price-history` | Weekly national history and forecast | 4 |
| GET | `/items/{item_code}/nutrition` | Nutrition record for one item | 7 |
| GET | `/items/{item_code}/healthier-alternatives` | Approved healthier alternatives with comparisons | 7 |
| GET | `/locations/autocomplete` | Malaysia-restricted place suggestions | 2 |
| POST | `/locations/resolve` | Place ID → label and coordinates | 2 |
| POST | `/locations/reverse` | Coordinates → display label (best-effort) | 2 |
| POST | `/recommendations/prepare` | Route once and cache candidate stores for 30 min | 2.5 |
| POST | `/recommendations` | Ranked stores and optional two-store plans | 2, 6 |
| POST | `/premises/{premise_id}/basket-alternatives` | Cheaper equivalents and pack sizes at one store | 3 |
| POST | `/reports/generate` | Generate one weekly/monthly report (not stored) | 8 |

## Catalogue

### `GET /items/search`

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `q` | string | `""` | Case-insensitive substring match on Malay name, English name, raw category and translated category labels |
| `page` | int ≥ 1 | 1 | |
| `page_size` | 1–25 | 25 | |
| `category` | repeated broad category ID | none | Unknown ID → `400 INVALID_CATEGORY` |
| `sara_category_only` | bool | false | Only official SARA 2026 categories |
| `sort` | `price_asc`, `price_desc`, `name_asc`, `name_desc` | `price_asc` | Price sort uses the lowest nearby price, else the cached median; unpriced last |
| `locale` | `en`, `ms` | `en` | Name used for name sorting |
| `candidate_cache_id` | string | none | When valid, adds `price_range` from the 25 nearest cached stores, or the national estimate range for items they do not sell |

Response: `{ count, total, page, page_size, total_pages, items[], price_context: "ready" | "unavailable", price_store_count, sara_category_source }`. Each item has `item_code`, Malay/English names, `package_size`, `category`, `source_category`, `sara_eligible` (null = unverified), `sara_category_candidate`, `image_url`, and `price_range { min_rm, max_rm, store_count, oldest_observed_date, price_source: "store" | "median", estimate_rm }`. With `price_source = "median"`, `min_rm`–`max_rm` is the middle 95% of current national prices (2.5th–97.5th percentile) and `estimate_rm` is the median used in totals.

### `GET /items/lookup`

Repeated `id` (catalogue item ID, up to 50) and optional `candidate_cache_id`. Returns `{ items[] }` in the same shape as search results. Unknown IDs are left out.

### `GET /items/{item_code}/price-history`

`item_code` is 1–10 digits; optional `region` (only `national::` is published). Returns snapshot metadata (`generated_at`, `data_cutoff`, `source`, `aggregation`), `status` (`available`, `rejected`, `insufficient`, `no_history`, `not_evaluated`), `reasons[]`, `history[] {week, price|null, stores, observations}`, `forecast[]` (empty unless `available`), `coverage`, and validation diagnostics. Errors: `INVALID_PRICE_REGION` (400), `HISTORY_UNAVAILABLE` (503, snapshot unreadable). See [Price history and forecasts](price-history-and-forecasts.md).

### `GET /items/{item_code}/nutrition`

Optional `basis` (`per_100g` or `per_100ml`). Returns `available: false` for unmapped items (normal, not an error). When available: `food` (nutrients, basis, description), `source` (publisher, URL, licence), match type (`generic` or product-specific) and rationale.

### `GET /items/{item_code}/healthier-alternatives`

Optional `candidate_cache_id` for nearby price ranges. Returns `{ item_code, count, alternatives[] }`; each alternative has the catalogue item, rule ID, headline (e.g. "Lower saturated fat"), intention, usage note, comparison nutrient and direction, both sources, `generic_mapping`, and a per-nutrient comparison table. Empty list when nothing qualifies.

## Location

| Endpoint | Body / query | Response | Errors |
| --- | --- | --- | --- |
| `GET /locations/autocomplete` | `query` (3–160 chars), `sessionToken` (8–128 chars) | `{ suggestions: [{ placeId, mainText, secondaryText, fullText }] }` | `INVALID_LOCATION_QUERY`, `INVALID_SESSION_TOKEN`, `MAPS_NOT_CONFIGURED`, `MAPS_UNAVAILABLE` |
| `POST /locations/resolve` | `{ placeId, sessionToken }` | `{ placeId, label, latitude, longitude }` | `INVALID_LOCATION`, `LOCATION_NOT_RESOLVED` (422), `MAPS_NOT_CONFIGURED` (503), `MAPS_UNAVAILABLE` (502) |
| `POST /locations/reverse` | `{ latitude, longitude }` | `{ label: string \| null }` — null when Geocoding is unavailable | `INVALID_LOCATION` |

## Recommendations

### Request (`POST /recommendations`)

```json
{
  "travel": {
    "origin": { "label": "Taman Tun", "latitude": 3.14, "longitude": 101.63, "placeId": "…", "source": "search" },
    "transportMode": "car",
    "limit": { "type": "both", "distanceKm": 10, "timeMinutes": 20 },
    "saraFilter": "any"
  },
  "basket": [ { "itemId": 1, "quantity": 2 } ],
  "candidateCacheId": "…",
  "secondStoreLimit": { "type": "distance", "value": 5 }
}
```

| Field | Rules |
| --- | --- |
| `transportMode` | `walk`, `public_transport`, `motorcycle`, `car` |
| `limit` | `distance` (`value` 0.5–100 km), `time` (`value` 5–180 min) or `both` (`distanceKm` and `timeMinutes`) |
| `saraFilter` | `any`, `candidate` (verified or candidate stores), `verified`. The app sends `verified` (default) or `any` |
| `basket` | ≤ 100 lines; quantity 1–99. Empty basket → transport-only ranking |
| `candidateCacheId` | Reuses the prepared snapshot when travel settings match; ignored when `secondStoreLimit` is set |
| `secondStoreLimit` | Optional; enables two-store plans (same validation as `limit`) |

### Response

| Field | Meaning |
| --- | --- |
| `recommendations[]` | Ranked stores: identity, address, SARA status, route distance/time, `estimatedRoundTripCostRm`, `travelCostBreakdown` (fuel), `basketSubtotalRm`, `combinedTotalRm`, `pricedCount`/`basketLineCount`, `storePriceCount`/`medianPriceCount`, `missingItems`, `saraCreditRm`/`cashNeededRm`, `basketPrices[]` (median-priced lines add `estimateLowRm`/`estimateHighRm`), `exceedsLimit` |
| `rankingMethod` | Plain-English description of the ranking applied |
| `costAssumptions` | Per-mode cost assumptions (shown to the shopper) |
| `routeProvider` | `google` or `straight_line` |
| `routeWarning` | Fallback, beta-route or transit notes; null when none |
| `expandedSearch` | True when nothing was within the limit and the nearest stores are shown instead |
| `multiStore` | Null unless `secondStoreLimit` was sent; else `plans[]`, `comparison` (complete/incomplete priced plans), `stores`, `emptyReason`, pair counters |

`POST /recommendations/prepare` takes `{ travel }` and returns `{ candidateCacheId, candidateCount, reachableCount, generatedAt, expiresAt }`.

Error codes: `INVALID_TRAVEL_LIMIT`, `INVALID_REQUEST`, `PREMISE_LOCATIONS_NOT_READY` (503), `DATABASE_NOT_CONFIGURED` (503). Google failures do not surface: the endpoint retries with the straight-line fallback.

## Store alternatives

`POST /premises/{premise_id}/basket-alternatives` with `{ basket: [{ itemId, quantity }] }`. Returns `{ premiseId, generatedAt, lines[] }`; each line has `source` (the basket item at this store), `alternative` (cheaper equivalent or null), `savingsRm`, and `packOptions[]` (only when the source has a store price). `404 PREMISE_NOT_FOUND` if the store is unknown or not open. See [Budget alternatives](budget-alternatives.md).

## Reports

`POST /reports/generate` — body `GenerateReportRequest`: `cadence` (`weekly`/`monthly`), `periodStart`, `periodEnd`, `locale`, `timeZone` (`Asia/Kuala_Lumpur`), `trips[]` (current and baseline periods). Response `GeneratedReport`: totals, savings components, category and spending-class breakdowns, previous-period comparison, `newsletter` (headline, ≤ 4 insights with evidence and action), `disclosures`, `generationSource` (`llm` or `fallback`).

| Code | Status | Cause |
| --- | --- | --- |
| `REPORT_REQUEST_TOO_LARGE` | 413 | Body over 512 KiB |
| `INVALID_REPORT_REQUEST` | 400 | Schema or period/trip validation failed |
| `REPORT_RATE_LIMITED` | 429 | Injected limiter rejected the call |
| `REPORT_UNAVAILABLE` | 500 | Unexpected failure |

See [Reports and analytics](reports-and-analytics.md).
