# SmartCart

Plan essential grocery shopping in Malaysia at the lowest total cost — item prices plus the cost of getting there. Built by team TM17 for FIT5120 (2026 S2), aligned with UN SDG 10 (Reduced Inequalities). Uses the government's open PriceCatcher price data and shows SARA eligibility signals.

**All documentation is in [`docs/`](docs/README.md).**

| Start here | |
| --- | --- |
| What the product does | [Product overview](docs/01-product/overview.md) |
| Requirements (epics, stories, ACs) | [Requirements](docs/02-requirements/README.md) |
| How it works | [System architecture](docs/03-architecture/system-architecture.md), [Design decisions](docs/03-architecture/design-decisions.md) |
| Run it locally | [Local setup](docs/07-operations/local-setup.md) |
| API | [API reference](docs/04-backend/api-reference.md) |

## Repository layout

```text
backend/    FastAPI service (Python) — catalogue, routing, ranking, forecasts, nutrition, reports
frontend/   Next.js app (TypeScript) — all screens and on-device records
database/   PostgreSQL schema, PriceCatcher ingestion, enrichment and migrations
data/       Versioned nutrition datasets and their build scripts
docs/       Documentation (current) and docs/archive (superseded)
.github/    Daily PriceCatcher ingestion workflow
```

## Quick start

```bash
cd database && docker compose up -d && python ingest_pricecatcher.py
```

```bash
cd backend && uvicorn main:app --reload --port 8000
```

```bash
cd frontend && pnpm install && pnpm dev
```

The quick start alone gives no store recommendations; the premise open-status import and `.env` files are also needed. Full steps, environment variables and data imports: [Local setup](docs/07-operations/local-setup.md).

## Data attribution

Price data: Government of Malaysia, PriceCatcher (data.gov.my), CC BY 4.0. Other sources and terms: [Security and privacy](docs/03-architecture/security-and-privacy.md#data-licences-and-attribution).
