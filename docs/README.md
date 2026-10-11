# SmartCart documentation

Single home for SmartCart's product, requirements, design and operations documentation. Everything outside `docs/archive/` describes the application as built on branch `iteration3` (12 October 2026).

## Reading order

| If you want to… | Start with |
| --- | --- |
| Understand the product in five minutes | [Product overview](01-product/overview.md) |
| Look up a term (SARA, premise, median estimate…) | [Glossary](01-product/glossary.md) |
| See what each feature must do | [Requirements](02-requirements/README.md) |
| Understand how the pieces fit together | [System architecture](03-architecture/system-architecture.md) |
| Know *why* it was built this way | [Design decisions](03-architecture/design-decisions.md) |
| Check what data leaves the device | [Security and privacy](03-architecture/security-and-privacy.md) |
| Call or change the API | [API reference](04-backend/api-reference.md) |
| Change a ranking, pricing or forecasting rule | [Backend logic](#backend-logic) |
| Understand the tables and browser records | [Data model](05-data/data-model.md) |
| Refresh or import data | [Data sources and pipelines](05-data/data-sources-and-pipelines.md) |
| Work on the UI | [Frontend architecture](06-frontend/frontend-architecture.md) |
| Run it locally | [Local setup](07-operations/local-setup.md) |
| Deploy or operate it | [Deployment and operations](07-operations/deployment-and-operations.md) |
| Run or extend tests | [Testing](07-operations/testing.md) |
| Find evidence for an AC | [Traceability matrix](08-evidence/traceability-matrix.md) |
| Know who owns a file | [Code ownership](09-team/code-ownership.md) |

## Structure

```text
docs/
├── 01-product/          overview, glossary
├── 02-requirements/     one file per epic (stories + acceptance criteria), retired scope
├── 03-architecture/     system architecture, design decisions, security and privacy
├── 04-backend/          API reference and one logic document per feature area
├── 05-data/             data model (ERDs), data sources and pipelines
├── 06-frontend/         frontend architecture
├── 07-operations/       local setup, deployment and operations, testing
├── 08-evidence/         traceability matrix
├── 09-team/             code ownership
└── archive/             superseded documents, kept unchanged for history
```

### Backend logic

- [Catalogue and search](04-backend/catalogue-and-search.md) — Epic 0 language, Epic 1
- [Store recommendation](04-backend/store-recommendation.md) — Epic 2
- [Budget alternatives](04-backend/budget-alternatives.md) — Epic 3
- [Price history and forecasts](04-backend/price-history-and-forecasts.md) — Epic 4
- [Multi-store planning](04-backend/multi-store-planning.md) — Epic 6
- [Nutrition and healthier alternatives](04-backend/nutrition.md) — Epic 7
- [Reports and analytics](04-backend/reports-and-analytics.md) — Epic 8

## Conventions

- **Language:** English only. Bilingual UI copy lives in code (`frontend/lib/i18n.ts`), not in docs.
- **Style:** short sections, tables for facts, Mermaid for diagrams (renders on GitHub and in VS Code).
- **Source of truth:** the LeanKit board for requirements, the code for behaviour. When they disagree, the docs say so explicitly.
- **Paths** are relative to the repository root unless the link says otherwise.
- **Research artefacts** (experiments, audits, screenshots, recordings) go in the git-ignored `research/` folder, not in `docs/`. Only maintained documentation is committed here.
- **Archive:** never edit files in `docs/archive/`. Add a new current document instead and link the old one from the [archive index](archive/README.md) if needed.
- **Regenerating requirements:** the epic files in `02-requirements/` and the traceability matrix are generated from the board snapshot; see [Requirements](02-requirements/README.md#keeping-this-folder-current).
