# Iteration 2 requirements change map

Review draft for the Iteration 2 export, FIT5120 2026S2 TM17(3).csv. Epic 6 is intentionally excluded. Card IDs below are the CSV Card_Id values, so approved changes can be applied to the corresponding board cards later.

This map compares the export with the current SmartCart implementation and project notes. Each proposed acceptance criterion is one Given/When/Then sentence. Short comments identify the reason for a change; they are not extra acceptance criteria.

## Main changes

- Reorder the trip flow to travel preferences → item search → basket review → Search stores; location is not selected from the basket page.
- Keep partial baskets in one recommendation list and rank by directly priced coverage, then effective coverage and combined cost.
- Make price estimates, route estimates, and SARA candidate status explicit.
- Retire community submissions from Epic 5 while keeping Out of stock as a local-only checklist outcome, then realign the Epic 5 numbering.
- Align savings and spending summaries with the current estimated-savings and Epic 8 reporting model.

## Epic 1 — Essential Basket Building

**US 1.3, card 2495231571 — replace the story statement.**

As a household shopper, I want to see an item's name, package or pricing basis, category, and known SARA status before adding it, so I can understand what is verified and what needs checking.

**AC 1.3.1, card 2506549400 — replace.**

Given catalogue results are displayed, when the shopper views an item, then the row shows its name in the selected language with an original-name fallback, package-size or pricing-basis value, and catalogue category.

**AC 1.3.2, card 2506550090 — replace.**

Given catalogue results are displayed, when the shopper views an item, then its SARA label distinguishes verified eligibility, verified ineligibility, a potential category match requiring label or barcode verification, and unknown eligibility that is not verified.

Comment: the current catalogue supports verified, category-candidate, and unverified states; a category match is not proof of eligibility.

**AC 1.5.1, card 2506560979 — replace only the count wording.**

Given a basket contains one or more products, when the shopper changes a quantity, then the same product row updates within the existing 1–99 limit and the basket summary shows both total units and distinct products.

Comment: the current summary distinguishes units from product rows.

**US 1.6, card 2502890977 — replace the story statement.**

As a household shopper, I want to review and edit my basket after setting travel preferences, so I can confirm the items and quantities before searching stores.

**AC 1.6.2, card 2506564362 — replace.**

Given the shopper has set valid travel preferences and the basket contains at least one item, when they choose Search stores from basket review, then SmartCart requests current store-level prices for that basket and opens the comparison results.

Comment: routing candidates may be reused, but basket prices must be refreshed for every Search stores action.

**AC 1.6.3, card 2509026083 — replace.**

Given the basket is empty, when the shopper attempts to search stores, then the app stays on basket review and asks them to add at least one item.

Keep US 1.1, US 1.2, US 1.4, the 1–99 basket quantity validation, and the remaining basket add/remove criteria as written.

## Epic 2 — Reachable Store Recommendation

**US 2.1, card 2502891671 — replace the story statement.**

As a household shopper, I want to set my starting point, transport mode, travel limit, and optional SARA filter before building my basket, so SmartCart can prepare relevant store candidates for this trip.

**AC 2.1.2, card 2506512138 — replace.**

Given the shopper has selected a valid origin and travel preferences, when they continue from the Location screen, then SmartCart prepares a bounded in-session candidate cache without persisting the origin and opens item search without requesting basket prices.

**US 2.2, card 2502892774 — replace the story statement.**

As a household shopper, I want store candidates evaluated using my selected transport mode and travel limits, so SmartCart distinguishes verified reachability from approximate or unverified travel estimates.

**AC 2.2.1, card 2502892884 — replace.**

Given Google Routes results are available, when SmartCart evaluates a premise, then it uses the selected transport mode to calculate one-way route distance and travel time from the current-session origin.

**AC 2.2.2, card 2509021143 — replace.**

Given Google Routes results are available and a distance limit is selected, when SmartCart returns recommendations, then each premise labelled within the limit has a one-way route distance less than or equal to the selected distance.

**AC 2.2.3, card 2509032075 — replace.**

Given Google Routes results are available and a time limit is selected, when SmartCart returns recommendations, then each premise labelled within the limit has a one-way route duration less than or equal to the selected time.

**AC 2.2.4, card 2506520767 — replace.**

Given the shopper enables the SARA candidate filter, when recommendations are displayed, then only verified partners and match candidates are included and their verified or candidate labels remain distinct.

**Add AC 2.2.6 — combined route limits; confirm the next free ID when editing the board.**

Given Google Routes results are available and a combined distance-and-time limit is selected, when SmartCart returns recommendations, then both the one-way route distance and route duration for each premise labelled within the limit are less than or equal to their selected thresholds.

**Add AC 2.2.7 — route fallback disclosure; confirm the next free ID when editing the board.**

Given Google Routes results are unavailable, when SmartCart displays nearest-premise fallback results, then it labels straight-line distance, travel time, and transport cost as approximate and route feasibility and travel-limit compliance as unverified.

**Add AC 2.2.8 — public-transport explanation; confirm the next free ID when editing the board.**

Given public transport is selected, when a route explanation is displayed, then it states that the estimated journey includes walking to and from transit stops.

**Add AC 2.2.9 — expanded-search disclosure; confirm the next free ID when editing the board.**

Given no routed store is within the selected travel limit, when SmartCart shows nearest stores outside that limit, then it states that none met the limit and labels every such store as beyond-limit rather than reachable within the limit.

Comment: the existing archived AC 2.2.5 is a reachability-summary card; leave it archived unless the team wants to restore and repurpose it.

**US 2.3, card 2502902153 — replace the story statement.**

As a household shopper on a limited budget, I want stores ranked by basket-price coverage and then basket-plus-transport cost, so I can compare the most useful store options without hiding missing prices.

**AC 2.3.1, card 2502907167 — replace.**

Given a valid basket and travel request, when store prices are returned, then each line uses a positive observed store price or a separately labelled cached median estimate and remains unavailable if neither exists.

**AC 2.3.2, card 2509034528 — replace.**

Given recommendation results are returned, when the shopper opens the comparison page, then one unified store list shows the active basket and travel summary without separate complete-basket and incomplete-basket tabs.

**AC 2.3.3, card 2506549993 — replace.**

Given stores have different priced-item coverage, when the unified list is displayed, then every store shows its priced-item count, any partial total is labelled partial, and no combined total is shown if no basket line is priced.

**AC 2.3.4, card 2509034483 — replace.**

Given multiple stores have recommendation data, when SmartCart ranks them, then it orders by observed store-price coverage, effective priced-line coverage including median estimates, combined basket and return-transport cost, travel time, route distance, store name, and premise ID.

**AC 2.3.5, card 2509035591 — replace.**

Given at least one store has a usable price for a basket line, when the ranked list is displayed, then the first such store is identified as the Best basket match.

**AC 2.3.7, card 2506551317 — replace.**

Given a priced basket contains verified or category-candidate SARA lines, when its SARA Credit and Cash Needed amounts are displayed, then candidate lines retain their potential-item label pending in-store verification and both amounts reconcile to the priced basket subtotal.

**AC 2.3.8, card 2506552794 — replace.**

Given a priced basket has no verified or category-candidate SARA lines, when the SARA breakdown is displayed, then SARA Credit is RM0 and Cash Needed equals the priced basket subtotal.

**AC 2.3.9, card 2506553868 — replace.**

Given the shopper expands item prices for a store, when each basket line is displayed, then the row shows its name, package or unit, quantity, price source, and any available unit price and line total while unavailable lines remain visible and unpriced.

**AC 2.3.10, card 2506538154 — replace.**

Given no recommendation can be returned for the selected travel and SARA filters, when the request completes, then the page explains that no matching stores were found and offers a way to revise those filters.

Keep AC 2.3.6's three-way verified/candidate/unverified store labels, with wording aligned to the current UI.

Comment: this map targets active AC 2.3.4 card 2509034483; archived duplicate card 2509033996 remains archived.

**US 2.4, card 2502907270 — replace the story statement.**

As a household shopper, I want to open a store shown in the comparison list, so I can review its basket prices, travel estimates, and cost impact before confirming it.

**AC 2.4.2, card 2506554845 — replace.**

Given a store overview is open, when the shopper reviews its totals, then the page shows store identity and SARA status, priced basket subtotal, estimated return-transport cost, combined total, one-way travel values, selected limits, and priced-item coverage.

**AC 2.4.3, card 2509128190 — replace.**

Given a store total includes partial or estimated prices, when its overview is shown, then the page identifies the missing or estimated lines and states that the displayed combined cost is not a verified full-basket price.

**AC 2.4.4, card 2506554346 — replace.**

Given the selected-store overview is open, when item prices are listed, then each basket line shows its price source and includes an observation date only if one is available.

**AC 2.4.5, card 2509127516 — replace.**

Given a basket line has neither an observed store price nor a cached median estimate, when the selected-store item list is displayed, then the line remains visible as unavailable with no line total and is excluded from the subtotal.

Keep the existing selected-premise snapshot behavior in AC 2.4.1.

## Cross-cutting journey — Home and resume behavior

The export has no user story for the implemented Home screen and top-level destinations. Add a story under Epic 5 or the team's chosen navigation epic; assign card IDs after confirming its parent.

As a household shopper, I want Home to let me start or resume a trip and open my checklist, history, or Inbox, so I can use SmartCart before and after shopping.

**Proposed AC — Home destinations.**

Given SmartCart is opened, when the initial screen loads, then Home shows Start or Resume trip, Checklist, Shopping history, and Inbox with checklist progress and unread-report count where available.

**Proposed AC — preserve and resume a trip.**

Given a trip is in progress, when the shopper returns Home and resumes the trip, then the current step and basket remain available in the session.

**Proposed AC — confirm a reset or checklist replacement.**

Given a trip is unfinished or an active checklist would be replaced, when the shopper starts a new trip or confirms another store, then SmartCart requires explicit confirmation before resetting the trip or replacing the checklist.

**Proposed AC — keep checklist navigation at Home.**

Given the shopper is in a trip-planning step, when its header and actions are displayed, then no checklist navigation shortcut is shown inside the trip flow.

## Epic 3 — Smart Budget Alternatives

Keep the archived, unrefined US 3.1–3.4 cards archived and retain refined US 3.1R–3.3R; those refined stories align with the current same-store cheaper-equivalent, pack comparison, swap, and undo behavior.

**US 3.4R, card 2510515251 — replace the story statement.**

As a household shopper, I want to understand the estimated effect of my store choice and item changes compared with a typical recommended store, so I can judge the plan without mistaking an estimate for money already saved.

**AC 3.4.1R, card 2510515259 — replace.**

Given a recommendation result is open before the first item change, when the shopper applies a swap or pack change, then SmartCart freezes the original recommendation result, basket, travel preferences, and selected-store totals as the comparison baseline.

**AC 3.4.2R, card 2510515721 — retain with this wording.**

Given a basket line has a valid original and replacement price, when the selected-store details are shown, then its cost impact is labelled as a saving, a higher upfront cost, or no change.

**AC 3.4.3R, card 2510515617 — replace.**

Given all applied item changes have comparable prices, when SmartCart calculates their combined impact, then the result equals the sum of unrounded line impacts before display rounding.

**AC 3.4.4R, card 2510515822 — replace.**

Given the current selected-store total and a comparable-store median are available, when the savings summary is shown, then it reports store-choice impact as median minus pre-change selected-store cost, item-change impact as pre-change cost minus current cost, and net estimated saving as median minus current cost equal to the sum of those impacts.

**AC 3.4.5R, card 2510515559 — replace.**

Given fewer than two comparable stores or a required price is unavailable, when SmartCart calculates estimated savings, then it labels the store comparison unavailable, shows only any valid item-change impact, and never substitutes zero for missing data.

**AC 3.4.6R, card 2510516030 — replace.**

Given an item change has been applied, when the shopper undoes it, then the original item and quantity are restored and the displayed cost impact is recalculated.

**Add AC 3.4.7R — comparable-store median; assign the next free card ID.**

Given a pre-change recommendation result is available, when SmartCart calculates a typical store cost, then it uses the statistical median of at least two in-limit stores including the selected store with non-null combined costs and the same priced basket lines, using the mean of the two middle costs for an even count.

**Add AC 3.4.8R — estimate disclosures; assign the next free card ID.**

Given cached median prices or straight-line route estimates contribute to the comparison, when the savings summary is shown, then it discloses those estimates and describes the result as estimated rather than actual savings.

**Add AC 3.4.9R — truthful savings language; assign the next free card ID.**

Given the estimated net impact is positive, negative, or zero, when the savings summary is shown, then it describes the plan as estimated savings, above the typical cost, or about the same without claiming money was definitely saved.

Comment: this replaces the old “You save” framing with the current median-based store-choice plus item-change calculation.

## Epic 5 — Shopping Checklist and Expense Tracking

**US 5.1, card 2512848121 — replace the story statement.**

As a household shopper, I want to open a checklist from a selected store recommendation, so I can track each planned basket line while shopping.

**AC 5.1.1, card 2512847967 — replace.**

Given I pick a store from my recommendations, when I open the shopping checklist, then the app snapshots that store and basket without changing my recommendation or basket and keeps the store, shopping date, planned subtotal when known, estimated return transport labelled as an estimate, and planned combined total when known.

**AC 5.1.3, card 2512848029 — replace.**

Given a basket line has no official store price, when its price is shown, then it is labelled unavailable unless a separately labelled cross-store reference price exists and that reference is never presented as the store's official price or proof of stock.

**AC 5.1.5, card 2512847969 — replace.**

Given I save a custom checklist item, when its required name and positive whole-number quantity are valid and its optional price is blank or a positive RM amount, then it appears once with a stable local ID as a Custom item, shows any entered price to two decimals, and has no official or reference price.

**Add AC 5.1.6 — custom-line edits; confirm the next free ID when editing the board.**

Given an unrecorded custom checklist line exists, when the shopper edits or removes it, then only that local line changes and the original catalogue basket remains unchanged.

Comment: remove the community-report action clause; custom checklist items remain local.

**AC 5.1.2, card 2512848426 — replace.**

Given my checklist is open, when I review its lines, then every basket line appears once with catalogue lines keyed by item ID, custom lines keyed by stable local ID, and each line showing its name with local-language fallback, package size, requested quantity, reference-price source, and purchase outcome.

Keep AC 5.1.4 as written.

**US 5.2, card 2512848124 — replace the story statement.**

As a household shopper, I want to mark each line as purchased, not purchased, or out of stock, so my expense record reflects what happened in the store.

**AC 5.2.2, card 2512848603 — replace.**

Given I did not buy a checklist line, when I mark it Not purchased or Out of stock, then the two local-only outcomes remain distinct and mutually exclusive with Purchased and are not sent anywhere.

**AC 5.2.3, card 2512847971 — replace.**

Given my checklist has no lines, when I open it or choose to record the trip, then the app shows an empty state and never saves an expense record with a made-up zero total.

**Add AC 5.2.4 — unfinished lines; confirm the next free ID when editing the board.**

Given unfinished checklist lines exist, when I record the trip, then those lines remain visible and are labelled unfinished.

Comment: Out of stock is a local checklist outcome only; community submissions remain out of scope.

**AC 5.3.4, card 2512848035 — replace.**

Given a purchased line has an actual spending total, when the trip record is saved, then it clearly identifies whether the total used the planned quantity or a shopper-entered actual quantity.

Comment: the supplied criteria leave actual-quantity entry as an open decision; whichever option is chosen, the saved record must identify the quantity source.

Keep AC 5.3.1–5.3.3 as written.

**US 5.4, card 2512848037 and ACs 5.4.1–5.4.4, cards 2512848608, 2512848039, 2512848524, 2512848129 — retire.**

Comment: retire community price/out-of-stock submissions under the no-crowdsourcing constraint; the local Out of stock outcome remains in scope under US 5.2.

**Renumber the remaining Epic 5 stories after retiring US 5.4:**

- Current US 5.5, card 2512848245 → US 5.4, Record a completed shopping trip.
- Current US 5.6, card 2512848526 → US 5.5, View shopping-trip history.
- Current US 5.7, card 2512848530 → merge into existing Epic 8 / US 8.1 reporting work; do not keep a duplicate monthly-only summary in Epic 5.
- Current US 5.8, card 2512848248 → proposed US 5.6, including renumbering its ACs, if the optional export story remains in scope.

**US 5.4 after renumbering, card 2512848245 — replace the story statement.**

As a household shopper, I want to record a completed checklist as a local trip-history entry, so I can review what I actually spent.

**AC 5.4.1, current AC 5.5.1 card 2512848610 — replace.**

Given I choose Record shopping trip, when the save succeeds, then my local record keeps the date and time, store, catalogue and custom lines, each line outcome, actual quantity when supported, actual unit price when entered, and actual line total when known, while custom lines retain my names and shopper-added status.

**AC 5.4.2, current AC 5.5.2 card 2512847764 — replace.**

Given a trip record contains purchased lines, when its actual expense total is calculated, then only known purchased-line actual totals are summed, an unknown total remains unavailable rather than RM0.00, and planned transport remains estimate metadata.

**AC 5.4.3, current AC 5.5.3 card 2512847679 — replace.**

Given a trip record is saved, when the save completes, then the app confirms it and makes it available immediately in device-local history.

Comment: exclude not-purchased, out-of-stock, missing-price, and reference-price lines from actual spending; keep estimated transport as planned metadata.

**US 5.5 after renumbering, card 2512848526 — replace the story statement.**

As a household shopper, I want to view and manage my trip history, so I can review my recorded trips over time.

**AC 5.5.1, current AC 5.6.1 card 2512847832 — replace.**

Given I have recorded trips, when I open trip history, then records appear newest first with date and time, store, purchase-outcome counts, and a known actual total labelled complete, partial, or unavailable as appropriate.

**AC 5.5.2, current AC 5.6.2 card 2512848528 — confirm before retaining.**

Given a saved trip appears in history, when I open its details, then every catalogue and custom line shows its name and type, outcome, package or unit, planned quantity, actual quantity when recorded, reference-price source, actual unit price, and actual line total or an explicit unavailable label.

Comment: the current History screen shows summary cards and has no record-detail view.

**AC 5.5.3, current AC 5.6.3 card 2512847834 — replace.**

Given I have no recorded trips, when I open history, then the app shows an empty state explaining how to start a checklist and displays no fabricated RM0.00 spending total.

**Add AC 5.5.4 — delete a saved trip; confirm the next free ID when editing the board.**

Given I choose to delete a saved trip, when I confirm deletion, then only that trip is removed from device-local history and the history list updates immediately.

**AC 5.5.5, current AC 5.6.4 card 2512848612 — replace.**

Given trip history is open, when I navigate it with a keyboard or screen reader, then each trip, detail action, and delete action has a clear accessible name and usable focus.

Comment: “Manage” is interpreted as deleting an individual saved trip; editing a recorded trip is not included unless the team wants that capability.

**Merge current US 5.7, card 2512848530, into existing Epic 8 / US 8.1; proposed acceptance text for that existing story:**

**AC 8.1.1 — current-period actual spending.**

Given trip records exist in the current weekly or monthly period, when the shopper opens Inbox, then the summary shows the known actual spending and trip count without adding planned totals or estimated transport.

**AC 8.1.2 — estimates are not spending.**

Given current-period records contain only planned or estimated amounts, when the summary is shown, then it explains that estimates are not confirmed spending and displays no amount.

**AC 8.1.3 — no activity.**

Given no trip records exist in the current period, when the shopper opens Inbox, then the summary shows a no-activity state rather than RM0.

**AC 8.1.4 — incomplete actual prices.**

Given a current-period trip has purchased lines with unknown actual prices, when the summary is shown, then it labels known spending as partial or unavailable.

Comment: these behaviors already have implementation notes under US 8.1; remove the duplicate monthly-only US 5.7 and its budget-line AC unless monthly budgeting is reintroduced as a separate feature.

Keep the US 5.8 export story only if it remains an agreed backlog item; it is marked COULD and no matching export flow was found in the current frontend.

## Confirm before applying

1. Community submissions remain retired; the supplied US 5.2 keeps Out of stock as a local-only outcome.
2. Confirm that US 5.5 should include trip details and deletion; neither interaction is present in the current history UI.
3. Confirm that the monthly budget line is out of scope and US 5.7 should merge into Epic 8 / US 8.1.
4. Epic 5 and its remaining stories are still in the CSV's “to do this iteration” lane even though checklist, actual-price/quantity, trip-history, and inbox code is present; review lane changes separately from text changes.
5. Confirm the parent epic for the proposed Home and trip-navigation story.

## Sources checked

- AGENTS.md — current ranking, privacy, SARA, and route-fallback constraints.
- docs/future-iteration-improvements.md — current Home journey, candidate cache, Search stores action, and estimated-savings/reporting rules.
- docs/recommendation-engine.md — provider fallback, price-source, ranking, and SARA semantics.
- US-iteration1-feedbackREADME.txt — dual basket counts and historical expanded-search behavior.
- US5.3(AC 5.3.4)README.txt and US5.4README.txt — actual quantity and local trip records; the supplied criteria now retain a local-only Out of stock outcome.
- US8.1(AC 8.1.1-8.1.4)README.txt — current-period weekly/monthly spending summary.
- Current frontend/backend modules for journey navigation, recommendation ranking, checklist persistence, trip history, and estimated savings.
