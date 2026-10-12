# SmartCart database

PostgreSQL schema, PriceCatcher ingestion, enrichment and migration scripts. Documentation lives in [`docs/`](../docs/README.md):

- [Local setup](../docs/07-operations/local-setup.md#1-database) — Docker, first load, enrichment
- [Data model](../docs/05-data/data-model.md) — ERD and table notes (`schema.sql`, `migrations/`)
- [Data sources and pipelines](../docs/05-data/data-sources-and-pipelines.md) — every script, when to run it, SARA status rules
- [Deployment and operations](../docs/07-operations/deployment-and-operations.md) — daily ingestion, scheduled tasks, Neon
