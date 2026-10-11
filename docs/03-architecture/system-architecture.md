# System architecture

## Context

```mermaid
flowchart LR
    shopper([Shopper's browser])
    subgraph SmartCart
        fe[Next.js frontend<br/>React 19, TypeScript]
        be[FastAPI backend<br/>Python 3.12]
        db[(PostgreSQL<br/>Neon in production)]
        snap[[Forecast snapshot<br/>backend/data/price_forecasts.json]]
        files[[Nutrition rules and policy<br/>data/nutrition/*.json]]
    end
    gm[Google Maps Platform<br/>Places · Routes · Geocoding]
    fuel[data.gov.my<br/>fuel price CSV]
    cb[Cerebras<br/>LLM, optional]
    pc[data.gov.my<br/>PriceCatcher]
    gha[GitHub Actions<br/>daily ingest]

    shopper <--> fe
    fe -- JSON over HTTPS /api --> be
    be --> db
    be --> snap
    be --> files
    be -- origin, place IDs --> gm
    be -- daily, on demand --> fuel
    be -- report facts, opt-in --> cb
    gha -- ingest_pricecatcher.py --> db
    pc --> gha
```

| Component | Responsibility | Location |
| --- | --- | --- |
| Frontend | All screens, client-side state, device storage (basket, checklist, trips, planned items, reports), checklist export, statistics | `frontend/` |
| Backend | Catalogue search, location proxy, store ranking, multi-store planning, alternatives, price history, nutrition, report generation | `backend/` |
| Database | PriceCatcher catalogue, premises, latest prices, nutrition records | `database/schema.sql`, `database/migrations/` |
| Forecast snapshot | Pre-computed weekly history and forecasts for 796 items | `backend/data/price_forecasts.json` |
| Nutrition files | Healthier-alternative mappings, rules and comparison policy | `data/nutrition/` |
| Data jobs | PriceCatcher ingestion, enrichment, migrations, imports | `database/*.py`, `.github/workflows/pricecatcher.yml` |

## Backend layering

```mermaid
flowchart TB
    main[main.py<br/>create_app: CORS, no-store headers,<br/>error handlers, report narrator injection]
    api[smartcart/api.py<br/>HTTP routes, candidate snapshot cache]
    subgraph domain["Domain logic (pure functions)"]
        rec[recommendation.py]
        ms[multi_store.py]
        msp[multi_store_pricing.py]
        fr[forecast_rules.py]
        nc[nutrition_comparison.py]
        ri[report_insights.py]
        pa[period_analytics.py]
    end
    subgraph data["Data access"]
        cat[catalogue.py]
        pre[premises.py]
        pri[pricing.py]
        alt[alternatives.py · pack_ratios.py]
        nut[nutrition.py · item_nutrition.py · nutrition_repository.py]
        ph[price_history.py]
    end
    subgraph ext["External adapters"]
        maps[maps.py — Google]
        fuel[fuel.py — data.gov.my]
        cer[cerebras_narrator.py]
    end
    rep[reporting.py — report assembly]
    main --> api
    api --> rec & ms & msp & cat & pre & pri & alt & nut & ph & maps & fuel & rep
    rep --> ri & pa
    rep -. narrator seam .-> cer
    rec --> pri
    msp --> pri
    ph --> fr
    nut --> nc
```

Domain modules take plain inputs and return Pydantic models or dataclasses, so ranking, routing rules, eligibility and report findings are unit-tested without a database or Google key. Data-access modules each open a short-lived connection (`database.py`) per request; there is no ORM.

## Key request flows

### Store recommendation (Epics 2 and 6)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend
    participant API as api.py
    participant DB as PostgreSQL
    participant G as Google Routes
    UI->>API: POST /recommendations/prepare (travel only)
    API->>DB: nearest open premises (Haversine, SARA filter)
    API->>G: route matrix origin → ≤25 stores
    API-->>UI: candidate_cache_id (valid 30 min)
    Note over UI: Shop screen uses the id for nearby price ranges
    UI->>API: POST /recommendations (travel, basket, id, optional second-store limit)
    alt cached snapshot, non-empty basket, no second-store limit
        API->>DB: basket prices for cached stores
    else
        API->>DB: candidates + prices
        API->>G: route matrix (+ inter-store matrix for two-store plans)
    end
    API->>API: rank by combined total, build two-store plans
    API-->>UI: ranked stores, plans, cost assumptions, warnings
```

If Google Routes is not configured or fails, the backend switches to the straight-line fallback (25 nearest stores, planning speeds, limits not verified) and says so in `route_warning`. Details: [Store recommendation](../04-backend/store-recommendation.md).

### AI report (Epic 8)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend
    participant API as /reports/generate
    participant R as reporting.py
    participant C as Cerebras
    UI->>UI: check consent v2 = accepted
    UI->>API: trips for period + baseline (no location)
    API->>R: validate, recompute analytics, detect findings
    R->>C: findings with {{placeholders}} (if key set)
    C-->>R: rewritten prose
    R->>R: validate prose, fill numbers, fall back per insight
    API-->>UI: report (not stored on server)
    UI->>UI: save to device inbox
```

Details: [Reports and analytics](../04-backend/reports-and-analytics.md).

## Where state lives

| State | Lives in | Lifetime |
| --- | --- | --- |
| Catalogue, premises, prices, nutrition | PostgreSQL | Refreshed daily (prices) or by migration |
| Price history and forecasts | JSON snapshot in the backend | Replaced by an offline batch run |
| Candidate snapshot | Backend process memory (LRU, 128 entries) | 30 minutes |
| Fuel price | Backend process memory | One Malaysian day; failures retried hourly |
| Origin (location) | Frontend memory; also inside the device-held shopping session (for resume) and the active checklist (for its map link) | Until the trip is cleared; never written to the SmartCart database |
| Basket, checklist, trips, planned items, reports, consent | Browser `localStorage` | Until the shopper deletes them |

Device record shapes are in the [Data model](../05-data/data-model.md#device-data-model).

## Technology choices (summary)

| Layer | Choice | Version source |
| --- | --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind 4, Recharts, html-to-image | `frontend/package.json` |
| Backend | FastAPI, Pydantic 2, psycopg2, Cerebras SDK | `backend/requirements.txt` |
| Database | PostgreSQL 16 locally (Docker), Neon in production | `database/docker-compose.yml` |
| Data jobs | pandas, fastparquet, psycopg 3 | `database/requirements.txt` |
| Tests | pytest, Vitest | `backend/requirements-dev.txt`, `frontend/vitest.config.mjs` |

Rationale for each: [Design decisions](design-decisions.md).
