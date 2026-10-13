# Epic 6 — Multi-store basket recommendations

> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2527216862](https://monashie.leankit.com/card/2527216862) |
| Size | 10 |
| Planned window | 2026-10-06 → 2026-10-13 |
| Assigned | Chenglong Meng |
| Stories / ACs | 5 / 44 |

As a household shopper, I want to optionally compare two-store plans alongside single stores, including their travel costs and limits, and then shop and record a two-store plan, so that I can decide whether splitting my basket is worthwhile and follow it through.

two-store plans are ranked in the same list as single stores; checklist, export and history now support two-store plans (US 6.5).

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [6.1](#us-61-enable-and-configure-multi-store-recommendations) | Enable and configure multi-store recommendations | — | 8 | 12 | Chenglong Meng |
| [6.2](#us-62-apply-second-store-travel-constraints) | Apply second-store travel constraints | — | 10 | 10 | Chenglong Meng |
| [6.3](#us-63-compare-plans-by-combined-cost) | Compare plans by combined cost | — | 10 | 8 | Chenglong Meng |
| [6.4](#us-64-inspect-a-multi-store-plan) | Inspect a multi-store plan | — | 10 | 8 | Chenglong Meng |
| [6.5](#us-65-shop-and-record-a-two-store-plan) | Shop and record a two-store plan | — | 8 | 6 | Shunnosuke Takei |

## US 6.1 Enable and configure multi-store recommendations

Card [2527215479](https://monashie.leankit.com/card/2527215479) · size 8

As a household shopper, I want to enable multi-store recommendations and choose preset limits for travelling to a second store using the same travel-limit menu as the initial location selection, so that I can compare split-basket plans that suit my travel preferences.

**Implementation** — frontend: [`multi-store-panel.tsx`](../../frontend/components/multi-store-panel.tsx), [`multi-store.ts`](../../frontend/lib/multi-store.ts); backend/data: [`models.py`](../../backend/smartcart/models.py) (RecommendationRequest.second_store_limit).

**Tests** — [`multi-store-panel.test.tsx`](../../frontend/components/multi-store-panel.test.tsx), [`multi-store.test.ts`](../../frontend/lib/multi-store.test.ts), [`test_multi_store_api.py`](../../backend/tests/test_multi_store_api.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **6.1.1** Off by default | Given the shopper has just opened SmartCart, when they press "Store plans" on the Recommendations screen, then the "Include multi-store plans" switch is off and no second-store limits are shown. | 3 |
| **6.1.2** Turn on multi-store plans | Given the shopper has pressed "Store plans", when they turn on "Include multi-store plans", then "Second-store travel limits" appear with "Distance", "Time" and "Both" options, preset buttons and "Apply limits". | 3 |
| **6.1.3** Distance presets | Given "Second-store travel limits" are showing, when the shopper presses "Distance", then only the distance presets used on the Travel screen are shown, with no box for typing a number. | 3 |
| **6.1.4** Explain the travel leg | Given "Include multi-store plans" is on, when the shopper views the limits, then a note explains they apply to travel from the first store to the second. | 1 |
| **6.1.5** Select and highlight a travel preset | Given the second-store travel menu is expanded, When the shopper selects a preset button, Then that preset becomes the selected maximum and is visibly highlighted, with exactly one selected preset in each active group; limits are chosen using buttons rather than manually entered values. | 3 |
| **6.1.6** Turn off multi-store plans | Given two-store plans are showing, when the shopper turns off "Include multi-store plans", then the limits section hides, the list reloads with single stores only and the basket is unchanged. | 3 |
| **6.1.7** Time presets | Given "Second-store travel limits" are showing, when the shopper presses "Time", then only the time presets used on the Travel screen are shown, with no box for typing a number. | 3 |
| **6.1.8** Both preset groups | Given "Second-store travel limits" are showing, when the shopper presses "Both", then both the distance and time presets are shown, keeping any preset already chosen. | 3 |
| **6.1.9** Apply limits | Given a preset is chosen in every shown group, when the shopper presses "Apply limits", then the list reloads with single stores and two-store plans together, and "Store plans" shows that limits are active. | 5 |
| **6.1.10** Missing preset | Given a shown group has no preset chosen, when the shopper presses "Apply limits", then nothing reloads and a message names the missing limit. | 1 |
| **6.1.11** Changing the limit type needs a new Apply | Given limits have been applied, when the shopper switches between "Distance", "Time" and "Both", then the applied limits are cleared and two-store plans disappear until they press "Apply limits" again. | 3 |
| **6.1.12** Close the Store plans menu | Given the "Store plans" menu is open, when the shopper clicks outside it or presses Escape, then the menu closes and the chosen settings are kept. | 1 |

## US 6.2 Apply second-store travel constraints

Card [2527217087](https://monashie.leankit.com/card/2527217087) · size 10

As a household shopper, I want the journey between recommended stores to meet my selected time and distance limits, so that splitting my basket does not require more travel between stores than I am willing to make.

**Implementation** — frontend: —; backend/data: [`multi_store.py`](../../backend/smartcart/multi_store.py), [`api.py`](../../backend/smartcart/api.py) (_build_multi_store_plans), [`maps.py`](../../backend/smartcart/maps.py) (compute_route_matrix_multi_origin), [`route_cache.py`](../../backend/smartcart/route_cache.py).

**Tests** — [`test_multi_store.py`](../../backend/tests/test_multi_store.py), [`test_multi_store_api.py`](../../backend/tests/test_multi_store_api.py), [`test_route_cache.py`](../../backend/tests/test_route_cache.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **6.2.1** First store uses the normal limits | Given the shopper pressed "Apply limits", when two-store plans are listed, then each plan's first store is within the Travel screen limit from the starting location, while its second store only has to be within the second-store limit from the first store. | 8 |
| **6.2.2** Time limit between stores | Given the shopper chose "Time" and a preset, when they press "Apply limits", then every plan's trip from the first to the second store takes no longer than the chosen minutes. | 5 |
| **6.2.3** Distance limit between stores | Given the shopper chose "Distance" and a preset, when they press "Apply limits", then every plan's trip from the first to the second store is no longer than the chosen km. | 5 |
| **6.2.4** Both limits between stores | Given the shopper chose "Both" and a preset in each group, when they press "Apply limits", then every plan's store-to-store trip is within both the chosen km and the chosen minutes. | 5 |
| **6.2.5** Cheaper visit order | Given a pair of stores can be visited in either order within the limits, when the plan is shown, then it uses the visit order with the lower travel cost, shown as "Store 1" and "Store 2". | 8 |
| **6.2.6** Whole journey included | Given the shopper opens a two-store plan, when they expand "Journey", then it lists each leg of the trip with its distance and time and the second-store limit applied, and the travel cost covers all legs. | 5 |
| **6.2.7** No route between stores | Given no route can be found between the recommended stores, when the list loads, then no two-store plans are shown and a message explains there was no route between the stores. | 3 |
| **6.2.8** No plan within the limits | Given no store pair fits the second-store limits, when the list loads, then single stores are still listed with a message that no plans match, how many pairs were checked, and an "Edit limits" button that opens "Store plans". | 3 |
| **6.2.9** Too few stores to split | Given fewer than two stores are reachable, when the shopper presses "Apply limits", then a message says at least two reachable stores are needed. | 1 |
| **6.2.10** Approximate routes still give plans | Given route data is unavailable (approximate routes only), when the shopper presses "Apply limits", then two-store plans are still listed using approximate distances and times, and the page notes that travel limits are not checked. | 3 |

## US 6.3 Compare plans by combined cost

Card [2527217090](https://monashie.leankit.com/card/2527217090) · size 10

As a household shopper, I want two-store plans ranked in the same list as single stores by basket cost plus travel cost, so that I can see at a glance whether splitting my basket is cheaper.

**Implementation** — frontend: [`multi-store.ts`](../../frontend/lib/multi-store.ts) (rankedStorePlanOptions), [`plan-comparison.tsx`](../../frontend/components/plan-comparison.tsx); backend/data: [`multi_store_pricing.py`](../../backend/smartcart/multi_store_pricing.py).

**Tests** — [`test_multi_store_pricing.py`](../../backend/tests/test_multi_store_pricing.py), [`multi-store-options.test.ts`](../../frontend/lib/multi-store-options.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **6.3.1** Each item bought at one store | Given a two-store plan is shown, when the shopper opens "View item prices", then each basket item is listed under exactly one of the two stores with its full quantity. | 8 |
| **6.3.2** Plan totals | Given a two-store plan card is shown, when the shopper reads its costs, then the basket subtotal is the sum of each item's unit price × quantity at its assigned store, and the total is that subtotal plus the travel cost for the whole round trip. | 5 |
| **6.3.3** One ranked list | Given two-store plans are showing, when the shopper reads the list, then single stores and two-store plans are ordered together by total cost, lowest first, and a two-store plan can be marked "★ Best basket match". | 5 |
| **6.3.4** Estimated and missing prices in plans | Given a two-store plan uses estimated prices or is missing a price, when its card is shown, then it shows how many items have store prices, estimates or no price and labels its totals as estimated or partial. | 3 |
| **6.3.7** Two-store plan card | Given two-store plans are showing, when the shopper views a plan card, then it shows "Two stores", both store names, total travel distance, time and cost, basket subtotal and total, an "Open in Google Maps" link and a "View stores" button. | 5 |
| **6.3.8** Item prices by store | Given a plan card is shown, when the shopper presses "View item prices", then the pop-up lists the items under each store with their quantity, unit price and total. | 3 |
| **6.3.9** No plan with an empty stop | Given a pair of stores would leave one store with nothing to buy, when the shopper presses "Apply limits", then that pair is not offered as a two-store plan. | 3 |
| **6.3.10** See more options | Given two-store plans are showing and more than 6 options exist, when the shopper presses "See more options (+6)", then up to 6 more stores or plans are added. | 3 |

## US 6.4 Inspect a multi-store plan

Card [2527215611](https://monashie.leankit.com/card/2527215611) · size 10

As a household shopper, I want to see which items to purchase at each store and the proposed visit order, so that I can understand and follow the recommended plan.

**Implementation** — frontend: [`plan-detail.tsx`](../../frontend/components/plan-detail.tsx), [`plan-detail-edits.ts`](../../frontend/lib/plan-detail-edits.ts), [`store-tags.tsx`](../../frontend/components/store-tags.tsx); backend/data: —.

**Tests** — [`plan-detail.test.tsx`](../../frontend/components/plan-detail.test.tsx), [`plan-detail-edits.test.ts`](../../frontend/lib/plan-detail-edits.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **6.4.1** Plan details | Given a plan card is shown, when the shopper presses "View stores", then a plan page opens with "Store 1" and "Store 2" tabs, the trip's distance and time, an "Open in Google Maps" link and a basket summary with the subtotal, SARA credit, cash needed, travel cost and total. | 5 |
| **6.4.2** Items grouped by store | Given the plan page is open, when the shopper presses the "Store 1" or "Store 2" tab, then the list shows only the items to buy at that store and the header switches to that store. | 3 |
| **6.4.3** Each store keeps its own labels | Given the plan page is open, when the shopper switches between store tabs, then each store shows its own SARA tag and its own estimated-price labels, and the SARA store filter applies to both stores. | 3 |
| **6.4.4** Settings kept on return | Given the plan page is open, when the shopper presses "← Back to plans", then the list reopens with the same basket, travel preferences, "Include multi-store plans" setting, limit type and presets. | 3 |
| **6.4.6** Presets still highlighted | Given the shopper returned from a plan page, when they open "Store plans", then the previously chosen distance and time presets are still highlighted. | 3 |
| **6.4.7** Edit a plan's items | Given the plan page is open, when the shopper changes a quantity, presses "Swap & save" or "Select pack", or presses "Undo swap" on an item, then that item, the store subtotal, plan total and estimated savings update immediately in the same way as on a single store's details (Epic 3). | 8 |
| **6.4.8** Fuel cost for the whole journey | Given the shopper travels by car or motorcycle, when they view the travel costs on the plan page, then the expected fuel cost covers the whole journey. | 3 |
| **6.4.9** Save a two-store plan | Given the plan page is open, when the shopper presses "Save plan" (or "Update plan" and confirms if a checklist exists), then a checklist covering both stores is created and the checklist screen opens. | 8 |

## US 6.5 Shop and record a two-store plan

Card [2529697597](https://monashie.leankit.com/card/2529697597) · size 8

As a household shopper, I want my checklist, export and history to show which store each item is from, so that I can follow and record a two-store trip.

**Implementation** — frontend: [`shopping-checklist.ts`](../../frontend/lib/shopping-checklist.ts) (createPlanShoppingChecklist), [`trip-history.ts`](../../frontend/lib/trip-history.ts), [`checklist-export.ts`](../../frontend/lib/checklist-export.ts); backend/data: —.

**Tests** — [`plan-shopping-checklist.test.ts`](../../frontend/lib/plan-shopping-checklist.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **6.5.1** Two-store checklist header | Given the shopper saved a two-store plan, when the checklist opens, then it shows both stores with their SARA status and an "Open in Google Maps" link for the route through both. | 3 |
| **6.5.2** Store on each checklist line | Given a two-store checklist is open, when the shopper views an item, then the item shows the name of the store it should be bought at. | 3 |
| **6.5.3** Filter the checklist by store | Given a two-store checklist is open, when the shopper chooses a store in the store filter, then only that store's items are shown. | 3 |
| **6.5.4** Two-store travel costs | Given a two-store checklist is open, when the shopper views "Travel and total cost", then the fuel estimate covers the whole journey and the toll amount entered applies to the whole trip. | 3 |
| **6.5.5** Two-store export | Given the shopper exports a two-store checklist, when they open the file, then each item shows which store it is from. | 3 |
| **6.5.6** Two-store trip in history | Given the shopper recorded a two-store trip, when they open Shopping history, then the trip is labelled "Multi-store trip" and its purchases are grouped by store. | 5 |
