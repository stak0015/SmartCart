# Data model

SmartCart has two separate data models:

1. **Server data** — public catalogue, store and nutrition data in PostgreSQL, plus versioned files read by the backend. Nothing about individual shoppers.
2. **Device data** — the shopper's basket, checklist, trips, plans and reports, stored as versioned JSON in browser `localStorage`.

## Server data model

Schema: `database/schema.sql` (idempotent; safe to reapply) and `database/migrations/001_nutrition.sql`, `002_item_nutrition.sql`.

```mermaid
erDiagram
    ITEM ||--o{ CURRENT_STATUS : "priced at"
    PREMISE ||--o{ CURRENT_STATUS : "observes"
    ITEM }o--o| NUTRITION_FOOD : "nutrition_food_id"
    ITEM }o..o| CATEGORY_TRANSLATION : "item_category = category_name (no FK)"

    ITEM {
        bigint item_id PK
        varchar item_code UK "PriceCatcher code"
        varchar item_name "official Malay name"
        varchar item_name_en "maintained English label, nullable"
        varchar unit "pricing unit, e.g. 1kg"
        varchar item_group
        varchar item_category "raw Malay category"
        boolean sara_eligible "NULL = not verified"
        numeric quantity_value "pack size in kg or L"
        varchar quantity_unit "KG or L; NULL = not comparable"
        numeric median_price_rm "cached cross-store median, > 0"
        bigint nutrition_food_id FK
        jsonb nutrition_mapping_metadata "approval, match type, rationale, basis variants"
    }
    PREMISE {
        bigint premise_id PK
        varchar premise_code UK "PriceCatcher code"
        varchar premise_name
        varchar address
        varchar district
        varchar state
        varchar google_place_id "top-candidate enrichment"
        timestamptz place_match_refreshed_at
        varchar open_closed_status "open | closed_permanently | closed_temporarily | unknown"
        timestamptz place_status_refreshed_at
        float latitude "Google cache, 30-day rule"
        float longitude
        varchar location_provider
        timestamptz location_refreshed_at
        boolean sara_partner "TRUE = verified; NULL = not verified"
        boolean sara_match_candidate "automated one-to-one match"
    }
    CURRENT_STATUS {
        bigint item_id PK, FK
        bigint premise_id PK, FK
        numeric current_price "> 0"
        date price_observed_date "source observation date"
        timestamptz price_synced_at "ingestion time"
        timestamptz status_updated_at
    }
    CATEGORY_TRANSLATION {
        varchar category_name PK "raw Malay category"
        varchar locale PK "en | ms"
        varchar translated_name
    }
    NUTRITION_FOOD {
        text dataset PK "items | foods"
        text food_id PK
        bigserial nutrition_id UK "referenced by item"
        text source_id "publisher dataset"
        text source_record_code "publisher record ID"
        text description
        text basis "per_100g | per_100ml"
        jsonb nutrients "nulls = unknown"
        jsonb source_metadata "name, URL, licence"
        jsonb document "original record"
        text snapshot_sha256
        timestamptz imported_at
    }
```

### Table notes

| Table | Rows (approx.) | Notes |
| --- | --- | --- |
| `item` | ~800 | One row per PriceCatcher item. `median_price_rm` is refreshed during ingestion for touched items and backfilled by `migrate_median_prices.py`. |
| `premise` | thousands | PriceCatcher lookup is authoritative for name and address. Place ID, status and coordinates come from the enrichment snapshot. Only `open` premises with coordinates are recommended. |
| `current_status` | one per item–premise pair with a price | Latest observation only; older observations never overwrite newer rows. A price is not proof of stock. |
| `category_translation` | 55 (English only) | Optional labels for 55 of the 59 raw categories; Malay and missing labels fall back to the raw PriceCatcher category. |
| `nutrition_food` | ~196 current foods | `items` namespace = current item profiles; `foods` = legacy reference snapshot. One table holds values and provenance; there is no separate source table. |

Key constraints: positive prices and medians; coordinates in range and set together; `open_closed_status` enumerated; JSONB columns must be objects.

Indexes: `premise (state, district)`, partial `premise (latitude, longitude)`, `premise (open_closed_status)`, `current_status (price_observed_date DESC)`, `current_status (premise_id)`, `category_translation (translated_name)`, partial `item (nutrition_food_id)`.

### Backend data files

| File | Keyed by | Contents |
| --- | --- | --- |
| `backend/data/price_forecasts.json` | `item_code` | Weekly national history, forecasts, eligibility status (see [Price history and forecasts](../04-backend/price-history-and-forecasts.md)) |
| `backend/data/nutrition/mappings.json` | `original_item_code` → `alternative_item_code` | Healthier-alternative rules and approved mappings |
| `backend/data/nutrition/comparison_policy.json` | rule ID → category | Nutrient thresholds, priorities, guards |
| `backend/smartcart/catalogue_image_manifest.py` | `item_code` | Which items have a checked-in thumbnail |
| `database/data/item_name_en.csv` | `item_code` | English item labels (seed) |
| `database/data/category_translations.csv` | raw category | Category labels (seed) |
| `database/data/archive/lookup_premise_sara_one_to_one_2026-08-23.parquet` (+ provenance JSON) | `premise_code` | Premise enrichment: candidate Place IDs and SARA candidate flags |

## Device data model

All keys are in `localStorage`. Every structured record (session, checklist, trips, planned items, inbox, consent) has a version and is validated on read; an invalid record is discarded (or migrated) rather than trusted. Parsers live next to each type in `frontend/lib/`.

```mermaid
erDiagram
    SHOPPING_SESSION ||--o{ BASKET_ITEM : contains
    SHOPPING_SESSION ||--o| STORE_RECOMMENDATION : "selected store"
    SHOPPING_SESSION ||--o{ PLANNED_ITEM : "items being used for this trip"
    BASKET_ITEM ||--o| APPLIED_REPLACEMENT : "Epic 3 swap (undoable)"
    SHOPPING_CHECKLIST ||--|{ CHECKLIST_ITEM : contains
    SHOPPING_CHECKLIST ||--o| ESTIMATED_SAVINGS : "frozen at save"
    SHOPPING_CHECKLIST ||..o| TRIP_RECORD : "recorded as (checklistId)"
    TRIP_RECORD ||--|{ TRIP_RECORD_LINE : contains
    TRIP_RECORD ||--o| ESTIMATED_SAVINGS : copies
    PLANNED_ITEM }o..o| CHECKLIST_ITEM : "same id (catalogue:<itemId>)"
    INBOX ||--o{ REPORT : stores
    REPORT_CONSENT ||..o{ REPORT : "gates generation"

    SHOPPING_SESSION {
        string key "smartcart.shopping-session.v1"
        object preferences "origin, mode, limits, SARA filter"
        string resumeStep "location | shop | basket | compare"
    }
    BASKET_ITEM {
        string id "db-<itemId>"
        string name
        int qty "1-99"
        boolean saraEligible
        boolean saraCategoryCandidate
    }
    APPLIED_REPLACEMENT {
        string kind "lower_cost | pack"
        object original "basket item before swap"
        string premiseId
        number sourceUnitPriceRm
        number alternativeUnitPriceRm
    }
    STORE_RECOMMENDATION {
        string premiseId
        number combinedTotalRm
    }
    PLANNED_ITEM {
        string key "smartcart.next-trip.v1 (v3)"
        string id "catalogue:<itemId> or manual ID"
        string source "catalogue | manual"
        int quantity
        string plannedWeek "Monday ISO date or null"
    }
    SHOPPING_CHECKLIST {
        string key "smartcart.shopping-checklist.v1 (v6)"
        string id
        object store "plus stores[] for two-store plans"
        object routeOrigin "lat/lng for map link"
        number plannedSubtotalRm
        number estimatedRoundTripCostRm
        number actualTollCostRm "shopper-entered"
        string routeProvider "google | straight_line"
    }
    CHECKLIST_ITEM {
        string id
        string source "catalogue | manual"
        string catalogueItemId
        string storePremiseId "two-store plans"
        int quantity
        number unitPriceRm
        string priceSource "store | median | manual"
        number actualPriceRm
        int actualQuantity
        string status "neutral | bought | not_bought"
        object originalValues "for Revert"
    }
    ESTIMATED_SAVINGS {
        number medianCombinedCostRm
        number storeChoiceImpactRm
        number itemChangeImpactRm
        number netSavingRm
        boolean routeEstimated
    }
    TRIP_RECORD {
        string key "smartcart.trip-history.v1 (v3)"
        string id
        string recordedAt
        string checklistId
        number actualTotalRm "sum of priced bought lines"
        number actualTollCostRm
    }
    TRIP_RECORD_LINE {
        string itemName
        string status
        number actualLineTotalRm
        string quantitySource "planned | actual"
    }
    INBOX {
        string key "smartcart.inbox.v1 (v5)"
        string cadence "weekly | monthly"
    }
    REPORT {
        string id "cadence:periodStart"
        boolean read
        string generationSource "llm | fallback"
    }
    REPORT_CONSENT {
        string key "smartcart.report-consent.v1 (v2)"
        string status "accepted | declined"
        string decidedAt
    }
```

### Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Session: choose origin / add items
    Session --> Checklist: Save plan (store or two-store plan)
    Checklist --> Checklist: tick bought / not bought, edit, add custom, enter tolls
    Checklist --> TripRecord: Record trip (frozen copy)
    TripRecord --> [*]: shown in History, Statistics, Reports
    Checklist --> PlannedItems: bookmark unbought item
    PlannedItems --> Session: Plan trip with selected items
    Checklist --> PlannedItems: ticking Bought removes a planned item
```

Recording a trip **freezes** its lines, prices, estimates and savings; later catalogue changes never alter history. Spending figures use only lines marked bought; estimated travel is kept separately and never counted as spending.

Other keys: `smartcart-travel-preferences` (remembered preferences, no origin), `smartcart-locale`, `smartcart.report-language.v1`.
