# Iteration 3 acceptance test evidence

Screenshots and recordings for the manual acceptance cases in the Iteration 3 acceptance test document (Epics 4, 6 and 7, the 13 Oct 2026 feedback changes, and a regression pass over earlier epics). `results.json` lists every check made in each case.

**Environment.** Local production build (next build + next start) and FastAPI backend from the iteration3 branch with the 13 Oct 2026 feedback changes, local PostgreSQL. Trip: Kota Bharu, Car, 10 km, SARA stores (default). Google Routes not enabled, so routing is straight-line. Run on 13 Oct 2026 with scripted Chrome (Playwright); each case records its checks and screenshots. AT-4.02 to AT-4.04 reuse the 12 Oct run: on 13 Oct the local forecast file was older than 28 days, so forecasts were correctly withdrawn.

## Epic 4: Price trends and planned purchases

Recording: [videos/epic4-price-trends-and-planned-items.webm](videos/epic4-price-trends-and-planned-items.webm)

| ID | Scenario | ACs | Expected | Result | Evidence |
|---|---|---|---|---|---|
| AT-4.01 | **Nothing planned**<br>Open Home with no planned items. | 4.5.5 | No "Planned this week" box is shown. | Pass | [home-nothing-planned](screenshots/AT-4.01-home-nothing-planned.png) |
| AT-4.02 | **Open price trends (defaults)**<br>Open Berangan Bananas, press See price trends (slowed network). Evidence from the 12 Oct run (local forecasts expired on 13 Oct). | 4.1.1, 4.1.2, 4.1.11, 4.1.12, 4.2.1, 4.2.3, 4.2.11, 4.2.12 | Loading message, then a panel beside the item showing National basis, update date, Historical/Projected legend, 1y and 12w selected, no rise/drop banner. | Pass | [loading](screenshots/AT-4.02-loading.png)<br>[panel-default](screenshots/AT-4.02-panel-default.png) |
| AT-4.03 | **Change history period and forecast length**<br>Select 3m + 4w, then All + 12w. Evidence from the 12 Oct run. | 4.1.3, 4.2.2 | Chart redraws and the chosen buttons are highlighted. | Pass | [3m-4w](screenshots/AT-4.03-3m-4w.png)<br>[all-12w](screenshots/AT-4.03-all-12w.png) |
| AT-4.04 | **Hover values**<br>Hover a recorded week, then a projected week. Evidence from the 12 Oct run. | 4.1.4, 4.2.8 | Tooltip shows week and price, labelled Historical or Projected. | Pass | [hover-historical](screenshots/AT-4.04-hover-historical.png)<br>[hover-projected](screenshots/AT-4.04-hover-projected.png) |
| AT-4.05 | **Data details**<br>Open Data details. | 4.1.7, 4.2.4 | Source, weekly median, missing weeks, forecast generation date and the planning-estimate note are shown. | Pass | [data-details](screenshots/AT-4.05-data-details.png) |
| AT-4.06 | **Close price trends**<br>Press Close price trends. | 4.1.10 | Panel closes; item details stay open. | Pass | [closed](screenshots/AT-4.06-closed.png) |
| AT-4.07 | **History cannot load**<br>Block the history request, open price trends, then Retry with the network restored. | 4.1.8 | Error with Retry; Retry loads the chart. | Pass | [error-retry](screenshots/AT-4.07-error-retry.png)<br>[after-retry](screenshots/AT-4.07-after-retry.png) |
| AT-4.08 | **Forecast not available**<br>Open price trends for Cleaned Chicken - Standard. | 4.2.5 | History only, with a forecast-unavailable note; item controls still work. | Pass | [forecast-unavailable](screenshots/AT-4.08-forecast-unavailable.png) |
| AT-4.09 | **Invalid quantity**<br>Set quantity to 0. | 4.4.10 | Schedule purchase is disabled. | Pass | [invalid-quantity](screenshots/AT-4.09-invalid-quantity.png) |
| AT-4.10 | **Schedule window and cancel**<br>Press Schedule purchase, review, press Escape. | 4.4.2, 4.4.3, 4.4.11, 4.4.15 | Item, quantity and weeks This week to In 4 weeks with dates; This week selected; Escape closes without saving. | Pass | [schedule-window](screenshots/AT-4.10-schedule-window.png)<br>[cancelled](screenshots/AT-4.10-cancelled.png) |
| AT-4.11 | **Save and dismiss confirmation**<br>Save planned item, dismiss the message. | 4.4.4, 4.4.14 | "Purchase saved to planned items." appears and can be dismissed. | Pass | [saved-confirmation](screenshots/AT-4.11-saved-confirmation.png) |
| AT-4.12 | **Plan an item without a forecast**<br>Schedule Cleaned Chicken for In 3 weeks. | 4.4.5 | Item is saved. | Pass | [no-forecast-item-scheduled](screenshots/AT-4.12-no-forecast-item-scheduled.png) |
| AT-4.13 | **Planned items on Home**<br>Go to Home. | 4.4.1, 4.5.1, 4.5.2 | "Planned this week" lists only this week's item with dates; "Planned items" lists both with quantity and week. | Pass | [home-planned](screenshots/AT-4.13-home-planned.png) |
| AT-4.14 | **Planned items stay on the device**<br>Reload the page. | 4.4.12 | Both planned items remain. | Pass | [after-reload](screenshots/AT-4.14-after-reload.png) |
| AT-4.15 | **Change the planned week**<br>Change Berangan Bananas to Next week. | 4.4.6 | Item leaves the "Planned this week" box. | Pass | [week-changed](screenshots/AT-4.15-week-changed.png) |
| AT-4.16 | **Planned week in price trends**<br>Open the item's price trends, then Schedule purchase again. | 4.4.13, 4.4.6 | Planned week is marked on the chart; the window opens on the current planned week. | Pass | [planned-week-in-trends](screenshots/AT-4.16-planned-week-in-trends.png)<br>[reschedule-starts-on-current-week](screenshots/AT-4.16-reschedule-starts-on-current-week.png) |
| AT-4.17 | **No duplicates, plan a trip**<br>Return Home, tick the item, press Plan trip with selected items. | 4.4.8, 4.6.1, 4.6.2 | One entry per item; button enabled after ticking; Shop opens with the planned quantity in the basket. | Pass | [before-ticking](screenshots/AT-4.17-before-ticking.png)<br>[ticked](screenshots/AT-4.17-ticked.png)<br>[trip-planned](screenshots/AT-4.17-trip-planned.png) |
| AT-4.18 | **Remove a planned item**<br>Remove Cleaned Chicken from planned items. | 4.4.7 | Item removed; basket unchanged. | Pass | [removed](screenshots/AT-4.18-removed.png) |
| AT-4.19 | **Nothing planned yet (Shop)**<br>On Shop with nothing planned, press Planned items. | 4.8.1, 4.8.5 | Button shows 0; the panel explains how to schedule an item. | Pass | [nothing-planned-panel](screenshots/AT-4.19-nothing-planned-panel.png) |
| AT-4.20 | **Planned items while shopping**<br>With two items planned, look at Shop, open Planned items, then go to Review your basket. | 4.8.1, 4.8.2 | Button shows 2; the panel lists each item with quantity and week; screen and basket unchanged; the button is also on Review your basket. | Pass | [shop-button](screenshots/AT-4.20-shop-button.png)<br>[panel-open](screenshots/AT-4.20-panel-open.png)<br>[basket-button](screenshots/AT-4.20-basket-button.png) |
| AT-4.21 | **Add a planned item to the basket**<br>In the panel, press Add to basket on Cleaned Chicken. | 4.8.3 | Basket +1 (planned quantity); confirmation shown; the item stays in Planned items. | Pass | [added-from-panel](screenshots/AT-4.21-added-from-panel.png) |
| AT-4.22 | **Details and forecast from Planned items**<br>Press Berangan Bananas' name in the panel, then close the details. | 4.9.1, 4.9.3 | Details open with Price trends already open and the planned week (the forecast line shows where one is available; the local forecast had expired); no Add to basket; closing returns to the unchanged panel. | Pass | [details-with-forecast](screenshots/AT-4.22-details-with-forecast.png)<br>[after-close](screenshots/AT-4.22-after-close.png) |
| AT-4.23 | **Manual planned items**<br>Schedule the manual checklist item Candles, then open Planned items on Shop. | 4.8.4, 4.9.2 | Candles is listed; its name cannot be pressed; the panel offers no Add to basket for it. | Pass | [manual-planned-item](screenshots/AT-4.23-manual-planned-item.png)<br>[panel-manual-item](screenshots/AT-4.23-panel-manual-item.png) |

## Epic 6: Multi-store plans

Recording: [videos/epic6-store-plans.webm](videos/epic6-store-plans.webm)

| ID | Scenario | ACs | Expected | Result | Evidence |
|---|---|---|---|---|---|
| AT-6.01 | **Off by default**<br>On Recommendations, open Store plans. | 6.1.1 | Switch is off; no limits shown. | Pass | [menu-default-off](screenshots/AT-6.01-menu-default-off.png) |
| AT-6.02 | **Turn on multi-store plans**<br>Turn on Include multi-store plans. | 6.1.2, 6.1.3, 6.1.4 | Limits appear with Distance / Travel time / Both, 2-15 km presets (no number box), Apply limits and the first-to-second-store note. | Pass | [limits-shown](screenshots/AT-6.02-limits-shown.png) |
| AT-6.03 | **Missing preset**<br>Press Apply limits with no preset. | 6.1.10 | "Select a distance limit before applying." | Pass | [missing-preset](screenshots/AT-6.03-missing-preset.png) |
| AT-6.04 | **Select a preset**<br>Select 5 km, then 10 km. | 6.1.5 | Only the latest preset is highlighted. | Pass | [preset-selected](screenshots/AT-6.04-preset-selected.png) |
| AT-6.05 | **Time and Both presets**<br>Press Travel time, pick 20 min, press Both. | 6.1.7, 6.1.8 | Time presets 10-45 min; Both shows both groups keeping 10 km and 20 min. | Pass | [time-presets](screenshots/AT-6.05-time-presets.png)<br>[both-presets](screenshots/AT-6.05-both-presets.png) |
| AT-6.06 | **Close the menu**<br>Press Escape, reopen, click outside. | 6.1.12 | Menu closes both ways; settings kept. | Pass | [menu-closed](screenshots/AT-6.06-menu-closed.png) |
| AT-6.07 | **Approximate routes still give plans**<br>Press Apply limits (Both, 10 km, 20 min) in the local build (straight-line routing), then See more options. | 6.1.9, 6.2.10, 6.3.3 | Store plans shows limits are active; two-store plans are listed in the same ranked list as single stores, with the approximate-routes note; basket unchanged. | Pass | [plans-with-approximate-routes](screenshots/AT-6.07-plans-with-approximate-routes.png) |
| AT-6.09 | **Two-store plan card**<br>Read the first two-store plan card. | 6.3.7 | "Two stores", both store names in one header row, distance, time, travel cost, subtotal and total, Open in Google Maps and View stores. | Pass | [plan-card](screenshots/AT-6.09-plan-card.png) |
| AT-6.10 | **Plan page and reopening it**<br>Press View stores, Back to plans, then Store details in the steps bar. | 6.4.1, 2.4.10, 0.1.13 | Plan page with Store 1 and Store 2 tabs and a basket summary (estimated lines show their range); the steps bar reopens the same plan. | Pass | [plan-page](screenshots/AT-6.10-plan-page.png)<br>[reopened-from-steps-bar](screenshots/AT-6.10-reopened-from-steps-bar.png) |
| AT-6.11 | **Save a two-store plan**<br>On the plan page press Save plan. | 6.4.9, 6.5.1, 6.5.2 | The checklist covers both stores with their SARA status and a route link; each line names its store. | Pass | [two-store-checklist](screenshots/AT-6.11-two-store-checklist.png) |
| AT-6.08 | **Turn off multi-store plans**<br>Return to Recommendations and turn the switch off. | 6.1.6 | Limits hide; two-store plans are removed; single stores stay. | Pass | [turned-off](screenshots/AT-6.08-turned-off.png) |

## Feedback changes (13 Oct 2026): SARA filter, price ranges, item details

Recording: [videos/feedback-changes-13oct.webm](videos/feedback-changes-13oct.webm)

| ID | Scenario | ACs | Expected | Result | Evidence |
|---|---|---|---|---|---|
| AT-F.01 | **Travel screen defaults**<br>Start a trip with no remembered preferences. | 2.1.13, 2.1.21, 2.1.22, 2.2.6 | Modes in the order Car, Motorcycle, Public transport, Walking with Car selected; SARA stores selected with a note that only verified partners are shown. | Pass | [travel-defaults](screenshots/AT-F.01-travel-defaults.png) |
| AT-F.02 | **SARA filter shows verified stores only**<br>Compare stores with the default SARA filter. | 2.2.5 | Every store card is a Verified SARA partner; the page says the SARA filter is on. | Pass | [verified-only](screenshots/AT-F.02-verified-only.png) |
| AT-F.03 | **No SARA store in reach**<br>Load Recommendations with an empty store list (simulated), then press Show all stores. | 2.3.21 | A message says no verified SARA partner is within the limit, with Show all stores; pressing it lists every reachable store, including non-SARA ones. | Pass | [no-sara-store](screenshots/AT-F.03-no-sara-store.png)<br>[all-stores](screenshots/AT-F.03-all-stores.png) |
| AT-F.04 | **Estimated price range in the catalogue**<br>Search "kuih" and open an item priced from the national estimate. | 2.5.5, 2.5.6 | Card shows "RMa – RMb (estimated)"; details say the range is estimated from prices across stores nationally. | Pass | [card-estimated-range](screenshots/AT-F.04-card-estimated-range.png)<br>[details-estimated-range](screenshots/AT-F.04-details-estimated-range.png) |
| AT-F.05 | **Estimated price range on store details**<br>Add that item, compare and open the top store. | 2.4.10 | The line says "Estimated from a range of RMa – RMb"; no "showing estimate" wording. | Pass | [store-details-range](screenshots/AT-F.05-store-details-range.png) |
| AT-F.06 | **Item details from the checklist**<br>Save the plan, press Berangan Bananas' name on the checklist, then close. | 5.9.1, 5.9.2 | Details open with nutrition and the price-trends button and no Add to basket; the checklist is unchanged after closing. | Pass | [checklist-item-details](screenshots/AT-F.06-checklist-item-details.png)<br>[checklist-after-close](screenshots/AT-F.06-checklist-after-close.png) |
| AT-F.07 | **Manual checklist items**<br>Add the manual item Candles. | 5.9.3 | The item is marked Manual item and its name cannot be pressed. | Pass | [manual-item-no-details](screenshots/AT-F.07-manual-item-no-details.png) |

## Epic 7: Healthier alternatives and nutrition

Recording: [videos/epic7-healthier-alternatives.webm](videos/epic7-healthier-alternatives.webm)

| ID | Scenario | ACs | Expected | Result | Evidence |
|---|---|---|---|---|---|
| AT-7.01 | **Healthier alternatives shown**<br>Open Mister Potato Crisps. | 7.1.1, 7.1.2, 7.3.1 | Section lists alternatives with picture, name, reason and a separate "Why this alternative?" button. | Pass | [alternatives-section](screenshots/AT-7.01-alternatives-section.png) |
| AT-7.02 | **No alternatives**<br>Open Berangan Bananas. | 7.1.4 | No section; item controls work. | Pass | [no-alternatives](screenshots/AT-7.02-no-alternatives.png) |
| AT-7.03 | **Alternatives cannot load**<br>Block the alternatives request, open Desa milk. | 7.1.5 | Section hidden; Add to basket works. | Pass | [alternatives-load-failure](screenshots/AT-7.03-alternatives-load-failure.png) |
| AT-7.04 | **Explore and go back**<br>Set quantity 3, open an alternative, press Back. | 7.2.1, 7.2.2, 7.2.3 | Alternative opens in the same window, basket unchanged; Back restores the original with quantity 3. (Mapped alternatives have no further alternatives, so only one level is shown.) | Pass | [original-quantity-3](screenshots/AT-7.04-original-quantity-3.png)<br>[alternative-opened](screenshots/AT-7.04-alternative-opened.png)<br>[back-to-original](screenshots/AT-7.04-back-to-original.png) |
| AT-7.05 | **Same controls for alternatives**<br>On an alternative, open price trends. | 7.2.5 | Price trends and Schedule purchase are available. | Pass | [alternative-price-trends](screenshots/AT-7.05-alternative-price-trends.png) |
| AT-7.06 | **Add only the alternative**<br>Add the alternative, view basket. | 7.2.4 | Window closes; basket +1 with only the alternative. | Pass | [basket-only-alternative](screenshots/AT-7.06-basket-only-alternative.png) |
| AT-7.07 | **Why this alternative?**<br>Press Why this alternative? for Berangan Bananas. | 7.3.2, 7.3.3, 7.3.4, 7.3.6, 7.3.10 | Panel names both items, reason, per 100 g values with units, trade-off and the generic-reference note; item stays open. | Pass | [why-panel](screenshots/AT-7.07-why-panel.png) |
| AT-7.08 | **Usage and sources**<br>Open Usage & sources. | 7.3.5, 7.3.13, 7.3.16 | Sources, usage note and the missing-secondary-comparison note are shown. | Pass | [usage-and-sources](screenshots/AT-7.08-usage-and-sources.png) |
| AT-7.09 | **Switch and close insights**<br>Open the other alternative's Why, then Close insights. | 7.3.7, 7.3.8 | Panel switches, then closes; item stays open. | Pass | [switched-comparison](screenshots/AT-7.09-switched-comparison.png)<br>[closed-insights](screenshots/AT-7.09-closed-insights.png) |
| AT-7.10 | **One side panel at a time**<br>Open price trends, then Why, then price trends. | 7.3.14, 7.3.15 | Each panel replaces the other. | Pass | [why-replaces-trends](screenshots/AT-7.10-why-replaces-trends.png)<br>[trends-replaces-why](screenshots/AT-7.10-trends-replaces-why.png) |
| AT-7.11 | **Nutrition information**<br>Expand Nutrition information on Mister Potato Crisps. | 7.4.1, 7.4.2, 7.4.3 | Per 100 g values, generic-food note and source link. | Pass | [nutrition-information](screenshots/AT-7.11-nutrition-information.png) |
| AT-7.12 | **No nutrition match**<br>Expand Nutrition information on a detergent. | 7.4.4 | "No reviewed nutrition match is available for this item." | Pass | [no-nutrition-match](screenshots/AT-7.12-no-nutrition-match.png) |
| AT-7.13 | **Nutrition loading and failure**<br>Slow then block the nutrition request. | 7.4.5, 7.4.6 | Loading message, then an unavailable message; item controls work. | Pass | [nutrition-loading](screenshots/AT-7.13-nutrition-loading.png)<br>[nutrition-error](screenshots/AT-7.13-nutrition-error.png) |
| AT-7.14 | **Missing value not shown as zero**<br>Why panel for Mutton (NZ) to Indian Mackerel. | 7.3.11 (partial) | Missing saturated fat is not shown as 0. | Pass | [unavailable-value](screenshots/AT-7.14-unavailable-value.png) |

## Regression: earlier epics

Recording: [videos/regression-core-flow.webm](videos/regression-core-flow.webm)

| ID | Scenario | ACs | Expected | Result | Evidence |
|---|---|---|---|---|---|
| REG-00 | **Home and language switch**<br>Open Home, switch to BM and back. | Epic 1 | Home loads; labels change language. | Pass | [home](screenshots/REG-00-home.png)<br>[home-bm](screenshots/REG-00-home-bm.png) |
| REG-01 | **Recommendations**<br>Compare Stores with a 3-item basket. | Epic 2 | Stores ranked by basket + transport; median and missing prices disclosed. | Pass | [recommendations](screenshots/REG-01-recommendations.png) |
| REG-02 | **Store details**<br>View the top store. | Epic 2 | Store details open. | Pass | [store-details](screenshots/REG-02-store-details.png) |
| REG-03 | **Basket**<br>View basket. | Epic 1 | Items with quantity controls. | Pass | [basket](screenshots/REG-03-basket.png) |
| REG-04 | **Checklist**<br>Save plan from store details. | Epic 3 | Checklist for the chosen store. | Pass | [checklist](screenshots/REG-04-checklist.png) |
| REG-05 | **Record a trip**<br>Tick all items, Record shopping trip. | Epic 3 | Items marked bought; trip recorded. | Pass | [items-ticked](screenshots/REG-05-items-ticked.png)<br>[record-confirm](screenshots/REG-05-record-confirm.png)<br>[recorded](screenshots/REG-05-recorded.png) |
| REG-06 | **History**<br>Open History. | Epic 3 | The recorded trip is listed. | Pass | [history](screenshots/REG-06-history.png) |
| REG-07 | **Reports**<br>Open Reports. | Epic 5 | Reports page loads (no report generated, to avoid sending data to Cerebras). | Pass | [reports](screenshots/REG-07-reports.png) |

## ACs not shown in these recordings

| ACs | Reason | Status |
|---|---|---|
| 4.1.5, 4.1.6 | Gaps / no history for the period | Automated tests only |
| 4.2.9 | Forecasts never change basket prices | Automated tests only |
| 4.2.10 | Big price change alert (no item in the forecast snapshot moves more than 10%) | Automated tests only |
| 4.4.9 | Items saved before weeks existed | Automated tests only |
| 4.5.3, 4.5.6 | Past weeks / new week begins (need the clock to move) | Automated tests only |
| 4.6.3, 4.6.4, 4.6.6, 4.6.7, 4.6.8 | Merging with the basket, current prices, leaving the trip, manual items, planning before a location | Automated tests only |
| 6.1.11, 6.3.1, 6.3.2, 6.3.4, 6.3.8-6.3.10, 6.4.2-6.4.8, 6.5.3-6.5.6 | Two-store details beyond those stepped through above (allocation, totals, tabs, edits, export, history) | Automated tests only |
| 7.1.3 | Only reviewed alternatives | Automated tests only |
| 7.3.9, 7.3.12 | The Why panel shows only the headline nutrient and trade-off rows, so "Unavailable"/"Non-comparable" labels never appear on screen. Covered by unit tests; AC wording may need review. | Not observable |
| 6.2.1-6.2.9 | Shown only with straight-line estimates: the capture build has no Routes key, so second-store limits were checked against estimated distances. Route-based limits are covered by automated tests; production returned real-route two-store plans on 13 Oct. | Partly shown |

## Automated tests by story

| Story | Tests |
|---|---|
| 4.1/4.2 | [test_price_history.py](../../../../backend/tests/test_price_history.py)<br>[price-history.test.ts](../../../../frontend/lib/price-history.test.ts) |
| 4.4-4.6 | [next-trip.test.ts](../../../../frontend/lib/next-trip.test.ts)<br>[planned-week.test.ts](../../../../frontend/lib/planned-week.test.ts) |
| 4.8, 4.9, 5.9 | [shopping-checklist.test.tsx](../../../../frontend/components/shopping-checklist.test.tsx)<br>[catalogue-item-dialog.test.tsx](../../../../frontend/components/catalogue-item-dialog.test.tsx)<br>[test_estimate_ranges.py](../../../../backend/tests/test_estimate_ranges.py) |
| 2.4.10, 2.5.5, 2.5.6 | [test_estimate_ranges.py](../../../../backend/tests/test_estimate_ranges.py)<br>[test_catalogue_prices.py](../../../../backend/tests/test_catalogue_prices.py)<br>[estimate-label.test.ts](../../../../frontend/lib/estimate-label.test.ts)<br>[plan-detail.test.tsx](../../../../frontend/components/plan-detail.test.tsx) |
| 6.1 | [multi-store-panel.test.tsx](../../../../frontend/components/multi-store-panel.test.tsx)<br>[multi-store.test.ts](../../../../frontend/lib/multi-store.test.ts)<br>[test_multi_store_api.py](../../../../backend/tests/test_multi_store_api.py) |
| 6.2 | [test_multi_store.py](../../../../backend/tests/test_multi_store.py)<br>[test_route_cache.py](../../../../backend/tests/test_route_cache.py) |
| 6.3 | [test_multi_store_pricing.py](../../../../backend/tests/test_multi_store_pricing.py)<br>[multi-store-options.test.ts](../../../../frontend/lib/multi-store-options.test.ts) |
| 6.4 | [plan-detail.test.tsx](../../../../frontend/components/plan-detail.test.tsx)<br>[plan-detail-edits.test.ts](../../../../frontend/lib/plan-detail-edits.test.ts) |
| 6.5 | [plan-shopping-checklist.test.ts](../../../../frontend/lib/plan-shopping-checklist.test.ts) |
| 7.1 | [test_healthier_alternatives.py](../../../../backend/tests/test_healthier_alternatives.py)<br>[test_nutrition.py](../../../../backend/tests/test_nutrition.py)<br>[healthier-alternatives.test.tsx](../../../../frontend/components/healthier-alternatives.test.tsx)<br>[nutrition.test.ts](../../../../frontend/lib/nutrition.test.ts) |
| 7.2 | [item-stack.test.ts](../../../../frontend/lib/item-stack.test.ts)<br>[catalogue-item-dialog.test.tsx](../../../../frontend/components/catalogue-item-dialog.test.tsx) |
| 7.3 | [test_nutrition_comparison.py](../../../../backend/tests/test_nutrition_comparison.py)<br>[healthier-alternatives.test.tsx](../../../../frontend/components/healthier-alternatives.test.tsx) |
| 7.4 | [test_item_nutrition.py](../../../../backend/tests/test_item_nutrition.py)<br>[item-nutrition.test.tsx](../../../../frontend/components/item-nutrition.test.tsx) |

See also the [traceability matrix](../../traceability-matrix.md) and [testing guide](../../../07-operations/testing.md).
