# Design decisions

Short decision records: what was decided, why, and what it costs. Newest understanding of the code, not the history of how we got here (that is in `docs/archive/`).

---

## D1. One Next.js frontend, one FastAPI backend

**Decision.** A single FastAPI service serves every feature. Provider keys stay server-side: all Places, Routes, Geocoding and Cerebras API calls go through the backend, and the browser never touches the database. The browser itself only loads a Google Maps embed (origin coordinates) on the Travel screen and opens Google Maps directions links when the shopper chooses.

**Why.** Provider keys must stay server-side. One backend keeps validation, error format (`{"error": {"code", "message"}}`) and caching headers (`Cache-Control: private, no-store`) consistent. Python suits the data work (pandas ingestion, forecast research).

**Trade-off.** Two deployables and a CORS allow-list (`CORS_ORIGINS`) to maintain.

## D2. Store only the latest price per item and store

**Decision.** `current_status` keeps one row per (item, premise): the newest observation. Price *history* is not rebuilt from `current_status`; it comes from the weekly forecast batch (D9).

**Why.** Recommendations only need current prices. Storing every daily observation since 2022 would multiply table size and slow every basket query for no recommendation benefit.

**Trade-off.** "Latest" can be weeks old for a quiet store, so every price carries its observed date. (A stale-price tag existed earlier but is no longer shown.)

## D3. Google Maps Platform as the only routing provider

**Decision.** Places (New) for search, Routes `computeRouteMatrix` for distance/time, Geocoding for device-location labels.

**Why.** One provider covers all four modes in Malaysia — walking, public transport, car and two-wheeler — with consistent place IDs. Openrouteservice has no public-transport routing. Monthly free tiers (10,000 elements/requests per SKU at the time of choice) cover a student project.

**Trade-off.** Billing must be enabled and quotas watched. Mitigations: at most 25 routed candidates per request (configurable 5–49), a 30-minute candidate snapshot (D6), and a straight-line fallback when Routes is missing or fails — clearly labelled, with travel limits marked as *not verified*.

## D4. Rank by combined cost, with labelled median estimates

**Decision.** Stores are ranked by **basket subtotal + estimated return travel cost**. If a store has no observation for an item, the item's cross-store median fills the gap and is labelled *estimate*. Lines with neither stay unpriced and are excluded from the subtotal. Ties: travel time, route distance, store name, premise ID.

**Why.** Shoppers care about total outlay, not item prices alone. PriceCatcher coverage per store is patchy; without medians, stores with fewer observed items would look artificially cheap. An earlier version ranked by price coverage first; the current rule compares totals directly and makes coverage visible on each store card instead.

**Trade-off.** A median is not that store's price. The UI always shows which lines are estimates and which are missing.

## D5. Only show premises believed to be open

**Decision.** Recommendation queries include only premises whose imported Google business status is exactly `open` and that have coordinates. Unknown, closed and missing are excluded.

**Why.** Sending a low-income shopper to a closed store costs real money. PriceCatcher does not publish opening status, so a dated enrichment snapshot provides it.

**Trade-off.** The status is a snapshot, not "open now". A reopened store stays hidden until the enrichment is regenerated and `migrate_premise_open_status.py` is rerun.

## D6. Short-lived candidate snapshot

**Decision.** `POST /recommendations/prepare` routes once from the origin and caches the result in PostgreSQL for 30 minutes under an opaque ID, bound to a SHA-256 fingerprint of the travel settings. Each worker also retains a bounded memory cache.

**Why.** The Shop screen shows nearby price ranges for every product, and the basket changes often. Re-routing on every change would multiply Google cost. The fingerprint stops a stale ID being reused after the shopper changes mode or limit.

**Trade-off.** Preparation adds one database write; a cold worker reads the shared snapshot once. This avoids losing nearby prices when requests hit different workers. Multi-store requests bypass it because they need a fresh inter-store matrix.

## D7. Transport cost from official fuel prices

**Decision.** Car and motorcycle cost = distance × litres/100 km × the official RON95 price (data.gov.my, refreshed once per Malaysian day). Public transport uses Google's fare when available, otherwise a base fare per leg plus a per-km rate. Walking costs RM0. Tolls are excluded and shown as *not included*; the shopper can record actual tolls on the checklist.

**Why.** Transparent, reproducible and sourced. Google does not support toll estimates in Malaysia. All rates are environment variables so the team can change assumptions without code changes.

**Trade-off.** Consumption figures are planning defaults (7.0 and 2.5 L/100 km), not the shopper's vehicle.

## D8. Personal data stays on the device; no accounts

**Decision.** Basket, checklist, trip history, planned items, report inbox and consent are stored in `localStorage`. The SmartCart database never stores anything about a shopper.

**Why.** Lowest-risk privacy posture for a vulnerable audience, and no account friction. It also removes a whole class of security work (authentication, user tables, deletion requests).

**Trade-off.** Data does not sync across devices and is lost if browser storage is cleared. Shared devices expose history to other users of the device. Every stored record is versioned and validated on read, so a corrupted record is discarded rather than crashing the app.

## D9. Forecasts are generated by a weekly batch and served from the database

**Decision.** History and forecasts are generated every Monday by a GitHub Actions job (Chronos-2 Small with a shared ridge correction, fixed after model selection) and published as versioned batches to PostgreSQL; the API reads the active batch (`SMARTCART_FORECAST_SOURCE=postgres`). `backend/data/price_forecasts.json` remains as the reference file and an explicit fallback source. The API never fits or runs a model at request time. Each item must pass explicit quality rules (`forecast_rules.py`) to show a forecast; the runtime re-checks freshness and can withdraw a forecast.

**Why.** Model inference per request would be slow and costly to host. Showing a confident forecast that is wrong is worse than showing none, so the bar is strict: in the first weekly batch (12 October 2026), 105 of 796 items qualify. A weekly batch, rather than a manual refresh, keeps forecasts inside the 28-day freshness limit without a redeploy.

**Trade-off.** The job needs GitHub Actions minutes, a database secret and someone watching for failed runs; a failed run leaves the previous batch, which then ages. Each batch records `generated_at` and `data_cutoff`, both shown to the shopper. History is national, not per store.

## D10. Two-store plans: simple, bounded, honest

**Decision.** At most two stores. Each basket line is bought entirely at one store. The shopper's normal travel limit applies to origin → first store; a separate second-store limit applies only to first → second store. Both visit orders are tried and the cheaper complete loop (origin → A → B → origin) is kept. Single- and two-store plans are ranked together by combined cost.

**Why.** Splitting lines or allowing three stores makes plans hard to follow in a shop. Evaluating both orders and pricing the full return loop avoids under-stating travel.

**Trade-off.** Inter-store routing costs quota. A lossless straight-line pre-filter (straight-line distance can never exceed route distance) and a 600-pair cap bound it. A pair with no route data is excluded, never estimated.

## D11. Healthier alternatives are curated, not scored

**Decision.** Alternatives come from hand-reviewed catalogue-to-catalogue mappings grouped into 33 rules (e.g. condensed milk → low-fat milk, instant noodles → plain oats), chosen for the shopper's buying intention and practical use. An alternative is shown only if its category policy confirms a meaningful improvement in a priority nutrient *and* no material trade-off in guard nutrients, on the same per-100 g/ml basis. Price is informational only; it never decides which alternative is offered.

**Why.** A generic "health score" would overclaim. Curated, explainable comparisons with named sources (USDA FoodData Central, AFCD, MyFCD) can be defended item by item, and usage notes state preparation limits.

**Trade-off.** Coverage is limited to items with a defensible counterpart in the PriceCatcher catalogue (261 mappings covering 183 items). All current nutrition records are generic reference foods rather than product labels, which the UI discloses.

## D12. AI reports: deterministic numbers, optional AI prose, explicit consent

**Decision.** The backend computes every number and finding deterministically (`report_insights.py`). The LLM (Cerebras) only rewrites wording, and must use `{{placeholders}}` for every figure, name and amount; each insight is validated and falls back to template text if invalid. Reports require versioned consent, are not stored on the server, and work without an LLM key.

**Why.** An LLM must never invent a saving or a price. Consent is required because report generation sends trip details (items, prices, store names) to the backend and, if configured, to Cerebras.

**Trade-off.** Prose is less varied than free generation. Consent version 2 re-asks shoppers who agreed under the narrower version 1 disclosure.

## D13. SARA has three states

**Decision.** Stores are *verified* (`sara_partner = TRUE`), *candidate* (`sara_match_candidate = TRUE`) or *unverified* (everything else). Items are SARA-eligible only when verified per item; otherwise a category on the official SARA 2026 list makes them a *category candidate*. Unknown never means ineligible.

**Why.** A wrong "eligible" sends a recipient to pay cash unexpectedly; a wrong "ineligible" hides a benefit. Both errors are avoided by being explicit about uncertainty.

**Trade-off.** "Verified" includes a documented, team-approved assumption that all branches of the eight chains named in the official SARA 2026 FAQ participate (see [Data sources](../05-data/data-sources-and-pipelines.md#sara-store-status)).

## D14. Money is exact; ordering is deterministic

**Decision.** Backend money arithmetic uses `Decimal` and rounds half-up to cents in API values; frontend period analytics work in integer cents (`period-analytics.ts`). Every ranking has a full tie-break chain ending in a stable ID.

**Why.** Totals must reconcile to the cent across screens (subtotal + travel = combined), and the same request must always produce the same order — important for trust and for tests.

## D15. English and Malay throughout

**Decision.** All UI copy exists in English and Bahasa Melayu (`frontend/lib/i18n.ts`). Item names use the maintained English label with the official Malay name as fallback; English category labels come from `category_translation`; Malay uses the official PriceCatcher category name.

**Why.** PriceCatcher names are Malay; many target users prefer either language. Reports are generated in the chosen report language.
