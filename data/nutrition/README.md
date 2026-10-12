# Nutrition data

Versioned nutrition snapshots, alternative mappings and comparison policy for Epic 7, plus the scripts that build them. Documentation: [Nutrition and healthier alternatives](../../docs/04-backend/nutrition.md).

| File | Purpose |
| --- | --- |
| [`mappings.json`](../../backend/data/nutrition/mappings.json) | Alternative rules and approved original → alternative mappings (read at runtime) |
| [`comparison_policy.json`](../../backend/data/nutrition/comparison_policy.json) | Nutrient thresholds, priorities and guards (read at runtime) |
| `item_nutrition.json`, `foods.json` | Import snapshots for the `nutrition_food` table; offline audit fixtures (not read at runtime) |
| `catalogue_snapshot.json`, `priority-review.json` | Inputs and review records used by the build scripts |
| `scripts/` | Importers for each source and build/audit scripts |

Research notes and generated audits belong in the git-ignored `research/nutrition/`.

Runtime mappings and comparison policy live in `backend/data/nutrition/` so the backend deployment includes them. Offline build and audit inputs remain here.
