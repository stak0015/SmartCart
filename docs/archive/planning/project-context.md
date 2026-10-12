# SmartCart project context

Updated: 7 October 2026 (Asia/Kuala_Lumpur).

This document records the current application context and agreed next-iteration
requirements. Planned features below are backlog requirements, not evidence of
implementation. The detailed cards are captured in
[the iteration backlog](iteration-3-backlog.md).

## Development artifact storage rule

- Store research notes, exploratory datasets, experimental model snapshots,
  generated audits, screenshots, recordings and validation evidence under the
  repository-root `research/` directory, which is ignored by Git.
- Use `research/evidence/<feature>/` for UI/testing evidence,
  `research/nutrition/` for nutrition audits and research notes, and
  `research/price_forecasting/` for forecast experiments. Generators must write
  these outputs there by default.
- Keep application source, meaningful tests and fixtures, approved runtime data,
  and maintained project documentation in their normal tracked locations.
  App builds and tests must not require ignored local research artifacts.
- Do not stage or force-add local research/evidence outputs unless the project
  owner explicitly asks to publish particular artifacts. Previously committed
  historical evidence is retained; new evidence goes under `research/evidence/`.

## Product and current application

SmartCart is a household-essential shopping and basket-planning application for
FIT5120 2026S2 team TM17, aligned with SDG 10. It uses the official Malaysian
PriceCatcher catalogue and price observations to help shoppers compare costs.

- Frontend: Next.js 15, React 19, TypeScript, with a mobile-first interface and
  English/Malay copy. Main application: `frontend/components/smartcart-app.tsx`.
- Backend: FastAPI; entry point `backend/main.py`, routes in
  `backend/smartcart/api.py`, and PostgreSQL-backed catalogue/pricing data.
- Location and routing: device geolocation or Malaysia-restricted Google Places
  autocomplete; Google Routes estimates travel where configured. A fallback
  uses nearby premises and clearly labelled approximate travel estimates.
- Current journey: Home -> Travel preferences -> Build basket -> Review basket
  -> Store recommendations -> Selected-store overview -> Confirm checklist ->
  Home. Checklist, shopping history, and Reports are also home destinations.
- Basket features include item search, categories, item details, quantities,
  editing/removal, selected-store cheaper alternatives and pack comparisons.
- Existing single-store recommendations use pricing coverage and estimated
  basket-plus-return-transport cost. Current delivery uses a unified list and
  can use explicitly labelled cached cross-store median estimates for missing
  store observations; this differs from the new multi-store complete/incomplete
  basket requirement and needs reconciliation during implementation.
- Travel modes: walk, motorcycle, car, and public transport. The initial location
  menu uses Distance / Time / Both selectors and preset buttons: **2, 5, 10,
  15 km**, and **10, 20, 30, 45 minutes**.
- Checklist and trip records support shopping outcomes, edited quantities and
  recorded prices, history, and export. Reports include weekly/monthly summaries
  and estimated savings.
- The current app already has a device-held Next trip saved-items area and
  Plan with saved items action (`frontend/lib/next-trip.ts`). Epic 4 extends and
  renames this existing list; intended buy weeks are newly agreed requirements,
  not functionality implemented by this documentation/board update.
- Origins and temporary routing candidates are session-only. Checklist/history
  records are device-held. Current report generation has a consent-gated
  `/api/reports/generate` backend request carrying selected trip-summary data;
  optional Cerebras narration is server-side with deterministic fallback. Do
  not describe all current report processing as exclusively on-device.
- A price observation or estimated price does not establish verified stock.
  SARA verified/candidate/unverified states remain distinct.

## Current epic map

| Epic | Scope | Status in this update |
| --- | --- | --- |
| 1 | Essential Basket Building | Existing functionality and board history |
| 2 | Reachable Store Recommendation | Existing single-store functionality |
| 3 | Smart Budget Alternatives | Existing functionality and refined stories |
| 4 | Price History, Forecasting and Planned Shopping | Planned; forecast-backed item scheduling and trip planning |
| 5 | Shopping Checklist and Trip Tracking | Existing functionality and board history |
| 6 | Multi-Store Basket Recommendations | Planned; now the sole active Epic 6 scope |
| 7 | Healthier Alternatives and Nutrition Insights | Planned; cards added |
| 8 | Personalised Shopping Progress Report | Existing functionality and board history |

The former Epic 6, **Price Freshness, Community Prices, and Availability
Signals**, is discontinued by the project owner. Its 22 cards, including its
epic, stories and acceptance criteria, were removed from LeanKit on 6 October
2026. This retires that epic's backlog scope; it does not authorize removing
existing source/freshness disclosures, SARA labels, or application code.

## Epic 4: price history, forecasting and Planned shopping

The user outcome is to schedule essentials by intended buy week, estimate the
budget needed, and plan an actual shopping trip with the items due this week.
The graph supports that outcome rather than being the feature's final result.

- Opening a Shop catalogue item shows historical prices and projected prices
  in a graph. Available historical records start in 2022 and extend to the
  latest available observations; individual items may have gaps or shorter
  coverage.
- History buttons: 3 months, 6 months, 1 year, All available. Forecast buttons:
  4, 8, 12 weeks. These selections operate independently.
- The draft proposes regional weekly median prices for the exact item/package
  and defaults of six months of history plus four weeks of forecast. Geographic
  scope, aggregation, defaults, model, and eligibility thresholds still need
  implementation confirmation; the source series and forecast must match.
- Identify price basis, scope, aggregation, source and observation dates. Separate
  historical and projected lines with a legend and boundary; tapping/hovering
  shows values. Forecasts identify generation date and data cutoff and are
  estimates rather than guaranteed future store prices.
- Handle gaps, no history, insufficient history, quality/freshness rejection,
  and forecast failure explicitly. Never fabricate observations or replace
  current recommendation/basket prices with projections.
- Quantity-based cost insights show projected unit price, estimated item cost,
  and the comparable historical-reference difference for the selected week.
  Update the estimate after quantity/week changes; an estimate is not a
  guaranteed store quote, actual spending, or realised saving.
- Evaluate a machine-learning forecasting approach on chronological holdout
  periods at 4/8/12 weeks against a simple baseline before choosing the model.
  Existing `research/price_seasonality/` is exploratory analysis, not a shipped
  forecast service or a confirmed weekly regional series.

### One planned-items list with an intended week per item

- Rename the existing Next trip saved-items area to **Planned shopping**. Do not
  create a separate future-purchases list, another saved-items list, or a
  second future checklist. The active trip checklist still tracks purchases
  after basket building and store selection.
- Every planned item has an identity, quantity, and intended buy week, defaulting
  to **This week**, editable before save. A catalogue item can enter this list
  through **Add to planned shopping** without changing the usual Add to basket
  action. Existing save-for-later and unbought-item flows feed the same list.
- Persist planned items on the device. Preserve legacy saved items, including
  manual items, and assign missing intended weeks to the current week once
  during migration. Do not discard or duplicate existing saved records.
- Editing or re-saving the same item updates its existing planned record;
  changing plans does not silently rewrite confirmed trip quantities. Removing
  a plan does not remove an item from a confirmed checklist or trip history.
- Planning works without a usable forecast, for manual items, or outside the
  forecast horizon. Show an unavailable estimate instead of inventing a value.

### Items planned for this week

- Place an **Items planned for this week** container within Planned shopping.
  It is a filtered view of the canonical list, not a separate list. Use
  Monday-to-Sunday weeks in Asia/Kuala_Lumpur.
- Show names, quantities, intended weeks and status, with item selection and a
  **Plan shopping trip** action. No selected items means the action is disabled.
  Future items are grouped by week below; overdue items remain visible with
  their original intended week and a Reschedule action.
- Recalculate groups on opening/resuming after a week boundary; do not silently
  move overdue plans to the new current week.
- Weekly budget summaries are item estimates with coverage counts. Label
  incomplete sums **Partial estimated item cost**. Exclude transport costs,
  recorded spending and unavailable values from the numeric estimate.

### Turn selected plans into a trip and reconcile the outcome

- Plan shopping trip uses only selected current-week items. Preserve unrelated
  basket lines, use the existing saved-item merge rule (matching catalogue
  quantity is the greater of basket/planned quantity), and allow review before
  store comparison. Do not automatically include future or overdue items.
- Continue through the existing location/travel, basket, store recommendation
  and confirmation flow. Recommendations use current pricing under the existing
  source rules, never forecast prices. Preserve linkage to the planned records.
- Selected manual items remain manual checklist lines, with no fabricated
  catalogue forecast or pricing; catalogue comparisons exclude those lines.
- After trip confirmation, linked planned items show **In current trip**, not
  bought, and cannot be reselected to duplicate inclusion in that active trip.
  Abandoning unconfirmed planning does not fulfil or delete a plan.
- Recording a trip fulfils only the quantities actually marked bought. A fully
  bought item leaves the outstanding planned list; a partial quantity leaves
  its remainder, and an unbought item retains its quantity and intended week.
  Outstanding items are released from the completed trip and can be rescheduled.
- Reprocessing the same recorded trip must not deduct quantities twice. New
  unbought items go into this same Planned shopping list rather than a second
  Next trip list. Actual purchase records remain in trip history.
- This supersedes the earlier separate Planned purchases screen proposal and
  the later trip-level scheduled-week proposal. Scheduling is now per item.
  Notifications, reminders and automatic purchases remain outside this scope.

## Epic 6: multi-store recommendations

- Disabled by default. Enabling **Include multi-store plans** expands a separate
  **Second-store travel limits** menu on the recommendation page.
- Initial scope is single-store and two-store plans. Each basket line's entire
  requested quantity is assigned to one store; do not split a line across stores.
- The second-store menu matches initial location selection: Distance / Time /
  Both and the shared preset buttons listed above. No manual numeric inputs.
  Highlight selections, apply selected presets, reject invalid/missing presets,
  and restore selections on reopening or return from a plan overview.
- Existing location preferences govern origin -> first store. Second-store
  limits govern first store -> second store, using the selected transport mode.
  Both requires both limits. The second store need not independently pass the
  original origin-to-store limit. Active store filters apply to both stores.
- Evaluate both visit orders. Choose the lowest estimated complete-route
  transport cost among eligible orders. Transport cost includes origin -> first
  store -> second store -> origin; second-store limits constrain only the middle
  leg. This replaces the earlier proposed whole-trip-limit design.
- Rank complete single-store and two-store plans together by basket subtotal
  plus complete-route transport estimate. Tie-break: fewer stores, shorter total
  travel time, shorter total route distance, stable store identifiers.
- Keep incomplete pricing under Incomplete baskets with price coverage and
  Partial total; do not present it as a cheapest complete basket. The initial
  draft uses valid positive official prices for allocation; reconciling this
  with existing median-price fallback is an implementation decision.
- Compare two-store savings with the cheapest eligible complete single-store
  combined total. Omit numeric comparison savings if that baseline is absent.
- Overview groups purchases by store and shows visit order, prices/observation
  dates, inter-store limits and travel, total return route, and cost breakdown.
- If inter-store routing or fares cannot support a transport mode, explain its
  unavailability instead of inventing estimates. No eligible multi-store plan
  must not hide eligible single-store results.
- Carrying store assignments into Epic 5 checklist/history needs a separate
  integration story; it is not included in the current feature-card set.

## Epic 7: healthier alternatives and nutrition insights

- Manually map healthier alternatives within the fixed catalogue and map each
  item to a nutrition dataset. Below item details, show small alternative cards
  with item name, package size, and a supported comparison reason.
- The original item's quantity/Add controls remain available. Clicking an
  alternative's main card opens its own details and Add controls without changing
  the basket. Adding it does not automatically replace/remove the original.
- A visible Back to [previous item] control restores the previous item and its
  unsubmitted quantity. Preserve navigation through further alternatives so the
  shopper can return to the original item.
- **Why this alternative?** is a separate button on each suggestion. It expands
  an inline comparison below the alternatives section without navigating away,
  changing quantity, or changing the basket. Another suggestion updates the
  comparison; Close insights collapses it.
- Compare both items on compatible bases, such as per 100 g or per 100 mL,
  identify dataset/mapped entries, disclose generic mappings, show relevant
  trade-offs, and mark missing or incompatible values unavailable. Missing is
  not zero. Nutritional recommendations do not imply lower prices.
- Existing `research/openfoodfacts_matching/` contains candidate matching
  research. It does not establish approved nutrition mappings or finalize the
  dataset; manual review remains required.

## LeanKit and acceptance conventions

Board: [FIT5120 2026S2 TM17](https://monashie.leankit.com/board/2494576111).

The feature set scheduled for 6-13 October 2026 contains **113 cards**: 3 epics,
14 user stories, and 96 acceptance criteria (Epic 4: 45 ACs; Epic 6: 30 ACs;
Epic 7: 21 ACs). These cards are in **TO DO THIS ITERATION**.

- Card headers: exactly `EPIC`, `User story`, and `AC` respectively; card type
  remains New Feature.
- Planned start: 2026-10-06. Planned finish: 2026-10-13.
- Hierarchy: epic -> user story -> acceptance criterion, using parent links.
- Every AC has one explicit Given / When / Then scenario. Independent conditions
  or error scenarios go into additional numbered AC cards. Epics and stories
  retain their As a / I want / so that descriptions.
- The single-scenario audit split the original 54 ACs into 68 ACs by adding
  14 cards. Existing card IDs and parent stories were preserved.
- The 7 October Epic 4 update adds stories 4.4-4.7 and 28 ACs (including 4.3.5),
  and revises the epic and the cost-insight story/criterion. Story scope:
  4.4 Schedule items in Planned shopping; 4.5 Review this week's and upcoming
  planned items; 4.6 Plan a shopping trip with this week's items; 4.7 Reconcile
  planned items with actual purchases. Existing 4.1/4.2 history/forecast scope
  is retained. Epic 4 now has 7 stories and 45 ACs.
- Current Epic 6 card ID: `2527216862`; retired Epic 6 ID: `2512848438`.
  Identify cards by IDs and current titles, not an old CSV's numbering alone.
- LeanKit tokens are credentials and must not be stored in project context,
  source files, or backlog exports.

## References and remaining decisions

- [Recommendation architecture](recommendation-engine.md)
- [Earlier journey/report requirements](future-iteration-improvements.md)
- [Frontend setup](../frontend/README.md), [backend setup](../backend/README.md),
  [database setup](../database/SETUP_GUIDE.md)
- [Detailed Epic 4/6/7 cards](iteration-3-backlog.md)

Older documents can describe earlier iterations, planned device-only report
processing, or previous ranking rules. Check current code for implementation
and this context plus the current LeanKit cards for newly agreed requirements.
This update changes documentation and the board, not runtime implementation.
