# SmartCart backend

FastAPI service. Documentation lives in [`docs/`](../docs/README.md):

- [Local setup](../docs/07-operations/local-setup.md#2-backend) — install, `.env`, run (`uvicorn main:app --reload --port 8000`)
- [API reference](../docs/04-backend/api-reference.md)
- [System architecture](../docs/03-architecture/system-architecture.md#backend-layering) — module layout
- Feature logic: [store recommendation](../docs/04-backend/store-recommendation.md), [multi-store](../docs/04-backend/multi-store-planning.md), [alternatives](../docs/04-backend/budget-alternatives.md), [price history](../docs/04-backend/price-history-and-forecasts.md), [nutrition](../docs/04-backend/nutrition.md), [reports](../docs/04-backend/reports-and-analytics.md)
- [Testing](../docs/07-operations/testing.md) — `python -m pytest`
