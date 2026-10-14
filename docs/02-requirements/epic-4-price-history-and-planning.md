# Epic 4 — Price history, forecasting and planned items

> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2527214818](https://monashie.leankit.com/card/2527214818) |
| Size | 10 |
| Planned window | 2026-10-06 → 2026-10-13 |
| Assigned | Shunnosuke Takei |
| Stories / ACs | 7 / 56 |

As a household shopper, I want to see how an item's price has changed and is forecast to change, schedule items for the week I plan to buy them, reach my planned items while I shop, and start a trip from them, so that I can decide when to buy essentials and plan my shopping ahead.

History 3m/6m/1y/All; forecasts 4/8/12 weeks for qualifying items only; "Planned items" list with one week per item (this week + next 4 weeks); "Planned this week" on Home; a "Planned items" panel on Shop and basket; item details with the forecast from any planned item; selected planned items start a trip. No weekly budgets, overdue grouping, "In current trip" status or partial-quantity reconciliation.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [4.1](#us-41-view-item-price-history) | View item price history | — | 8 | 11 | Shunnosuke Takei |
| [4.2](#us-42-view-projected-item-prices) | View projected item prices | — | 10 | 10 | Shunnosuke Takei |
| [4.4](#us-44-schedule-items-in-planned-items) | Schedule items in Planned items | — | 10 | 15 | Shunnosuke Takei |
| [4.5](#us-45-see-what-is-planned-for-this-week) | See what is planned for this week | — | 5 | 5 | Shunnosuke Takei |
| [4.6](#us-46-plan-a-shopping-trip-from-planned-items) | Plan a shopping trip from planned items | — | 8 | 7 | Shunnosuke Takei |
| [4.8](#us-48-use-planned-items-while-building-a-basket) | Use planned items while building a basket | — | 8 | 5 | Shunnosuke Takei |
| [4.9](#us-49-check-a-planned-items-details-and-forecast) | Check a planned item's details and forecast | — | 5 | 3 | Shunnosuke Takei |

## US 4.1 View item price history

Card [2527214995](https://monashie.leankit.com/card/2527214995) · size 8

As a household shopper, I want to open a price-trends chart from an item's details, so that I can understand how its price has changed over time.

**Implementation** — frontend: [`price-history.tsx`](../../frontend/components/price-history.tsx), [`price-series-chart.tsx`](../../frontend/components/price-series-chart.tsx), [`price-history.ts`](../../frontend/lib/price-history.ts); backend/data: [`price_history.py`](../../backend/smartcart/price_history.py), [`refresh.py`](../../forecasting/refresh.py), [`store.py`](../../forecasting/store.py).

**Tests** — [`test_price_history.py`](../../backend/tests/test_price_history.py), [`test_forecast_postgres.py`](../../backend/tests/test_forecast_postgres.py), [`price-history.test.ts`](../../frontend/lib/price-history.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.1.1** Open price trends | Given the item details window is open, when the shopper presses the price-trends button, then a "Price trends" panel opens beside the details with a weekly price chart. | 5 |
| **4.1.2** Identify the price series | Given the "Price trends" panel has loaded, when the shopper reads it, then it shows the price basis (national, per unit), when it was last updated, and a note that national prices may differ from store prices. | 3 |
| **4.1.3** Select history period | Given the "Price trends" panel is open, when the shopper presses "3m", "6m", "1y" or "All", then the chart shows that period and the button is highlighted. | 3 |
| **4.1.4** Inspect historical values | Given the chart is showing, when the shopper taps or hovers over the price line, then the week and price are shown. | 3 |
| **4.1.5** Gaps in history | Given some weeks have no recorded price, when the chart is shown, then those weeks have no value plotted and are not shown as zero. | 3 |
| **4.1.6** No history for the period | Given the item has no recorded prices in the chosen period, when the shopper selects that period, then a message says there is no history for it and the item controls still work. | 1 |
| **4.1.7** Data details | Given the "Price trends" panel has loaded, when the shopper expands "Data details", then it explains where the prices come from, how they are combined, how many weeks are missing, and when the data and forecast were produced. | 3 |
| **4.1.8** History cannot load | Given the shopper opens "Price trends", when the history cannot be loaded, then an error message is shown with a "Retry" button that tries again. | 1 |
| **4.1.10** Close price trends | Given the "Price trends" panel is open, when the shopper presses its "×" button or the price-trends button again, then the panel closes and the item details stay open. | 1 |
| **4.1.11** Default history period | Given the shopper presses the price-trends button, when the "Price trends" panel opens, then "1y" is selected. | 1 |
| **4.1.12** Loading history | Given the shopper presses the price-trends button, when the history is still loading, then a loading message is shown. | 1 |

## US 4.2 View projected item prices

Card [2527215468](https://monashie.leankit.com/card/2527215468) · size 10

As a household shopper, I want to see estimated prices for the next 4 to 12 weeks and be told when a big rise or drop is expected, so that I can consider buying earlier or later.

**Implementation** — frontend: [`price-history.ts`](../../frontend/lib/price-history.ts) (forecastForDisplay, fourWeekForecastSignal), [`price-history.tsx`](../../frontend/components/price-history.tsx); backend/data: [`forecast_rules.py`](../../backend/smartcart/forecast_rules.py), [`price_history.py`](../../backend/smartcart/price_history.py), [`model.py`](../../forecasting/model.py), [`refresh.py`](../../forecasting/refresh.py).

**Tests** — [`test_price_history.py`](../../backend/tests/test_price_history.py), [`test_forecast_postgres.py`](../../backend/tests/test_forecast_postgres.py), [`test_refresh.py`](../../forecasting/tests/test_refresh.py), [`price-history.test.ts`](../../frontend/lib/price-history.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.2.1** Display forecast | Given the item has a forecast, when the "Price trends" chart loads, then projected weekly prices continue after the last recorded week. | 10 |
| **4.2.2** Select forecast horizon | Given the item has a forecast, when the shopper presses "4w", "8w" or "12w", then the chart shows that many projected weeks and the button is highlighted, without changing the history period. | 3 |
| **4.2.3** Tell recorded and projected prices apart | Given the chart shows recorded and projected prices, when the shopper looks at it, then the two are drawn in different styles, named "Historical" and "Projected" in a legend, with the start of the forecast marked. | 3 |
| **4.2.4** Explain what a forecast means | Given the item has a forecast, when the shopper expands "Data details", then it says forecasts are planning estimates and shows when the forecast was made. | 1 |
| **4.2.5** Forecast not available | Given the item lacks enough reliable data for a forecast, when the "Price trends" panel loads, then only history is shown with a note that the forecast is unavailable, and the item controls still work. | 5 |
| **4.2.8** Inspect projected values | Given the chart shows projected prices, when the shopper taps or hovers over the projected line, then the week and price are shown, labelled "Projected". | 3 |
| **4.2.9** Forecasts never change basket prices | Given an item has a forecast, when the shopper adds it to the basket and compares stores, then store totals use current store prices and the forecast is not used. | 3 |
| **4.2.10** Big price change alert | Given the forecast for the next 4 weeks is more than 10% above or below the latest price, when the "Price trends" panel loads, then a banner shows a "Price rise forecast" or "Price drop forecast" with the percentage. | 5 |
| **4.2.11** No alert for small changes | Given the forecast for the next 4 weeks is within 10% of the latest price, when the "Price trends" panel loads, then no rise or drop banner is shown. | 1 |
| **4.2.12** Default and unavailable forecast lengths | Given the item has a forecast, when the "Price trends" panel opens, then "12w" is selected and any length longer than the available forecast is disabled. | 1 |

## US 4.4 Schedule items in Planned items

Card [2527836607](https://monashie.leankit.com/card/2527836607) · size 10

As a household shopper, I want to schedule an item for the week I plan to buy it, so that I have one list of planned purchases to work from.

**Implementation** — frontend: [`next-trip.ts`](../../frontend/lib/next-trip.ts), [`planned-week.ts`](../../frontend/lib/planned-week.ts), [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (schedule dialog); backend/data: —.

**Tests** — [`next-trip.test.ts`](../../frontend/lib/next-trip.test.ts), [`planned-week.test.ts`](../../frontend/lib/planned-week.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.4.1** Planned items list | Given the shopper has scheduled at least one item, when they open Home, then a "Planned items" list shows each planned item with its quantity and planned week. | 3 |
| **4.4.2** Schedule from item details | Given the item details window has a valid quantity, when the shopper presses the bookmark "Schedule purchase" button, then a "Schedule purchase" window opens with the item and a choice of weeks. | 5 |
| **4.4.3** Week options and default | Given the "Schedule purchase" window opens for an item not yet planned, when the shopper views the week options, then "This week" to "In 4 weeks" are offered with their dates and "This week" is selected. | 3 |
| **4.4.4** Save a planned purchase | Given the "Schedule purchase" window is open, when the shopper chooses a week and presses "Save planned item", then the window closes, a confirmation appears, and the item is added to Planned items with that quantity and week. | 3 |
| **4.4.5** Plan items without a forecast | Given an item has no price forecast, when the shopper presses "Schedule purchase", then the item can be scheduled in exactly the same way as a forecast item. | 3 |
| **4.4.6** Change the planned week | Given an item is in Planned items on Home, when the shopper taps its week, chooses another week and presses "Save planned item", then the item shows the new week. | 3 |
| **4.4.7** Remove a planned item | Given an item is in Planned items, when the shopper presses its bin button, then the item is removed straight away and the basket is unchanged. | 3 |
| **4.4.8** No duplicate planned items | Given an item is already planned, when the shopper schedules it again, then the window starts on its current week and saving updates the existing item instead of adding another. | 3 |
| **4.4.9** Items saved before weeks existed | Given an item was saved before planned weeks existed, when the shopper opens Planned items, then it is still listed and shows "Week not set" until a week is chosen. | 3 |
| **4.4.10** Invalid quantity blocks scheduling | Given the quantity in the item details window is invalid, when the shopper looks at the "Schedule purchase" button, then it is disabled. | 1 |
| **4.4.11** Cancel scheduling | Given the "Schedule purchase" window is open, when the shopper presses "Cancel", "×" or Escape, then the window closes and Planned items is unchanged. | 1 |
| **4.4.12** Planned items stay on the device | Given the shopper has planned items, when they close and reopen SmartCart on the same device, then every planned item is still listed with its quantity and week. | 3 |
| **4.4.13** Planned week in price trends | Given an item is in Planned items, when the shopper opens its "Price trends" panel, then the panel shows the item's planned week. | 3 |
| **4.4.14** Dismiss the saved message | Given the confirmation message is showing, when the shopper presses its "×", then it disappears. | 1 |
| **4.4.15** Only near weeks can be chosen | Given the "Schedule purchase" window is open, when the shopper looks at the week options, then only this week and the next four weeks can be chosen. | 3 |

## US 4.5 See what is planned for this week

Card [2527836897](https://monashie.leankit.com/card/2527836897) · size 5

As a household shopper, I want Home to show the items I planned to buy this week, so that I can see what needs buying now.

**Implementation** — frontend: [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx) (NextTripList), [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (Home), [`planned-week.ts`](../../frontend/lib/planned-week.ts); backend/data: —.

**Tests** — [`planned-week.test.ts`](../../frontend/lib/planned-week.test.ts), [`next-trip.test.ts`](../../frontend/lib/next-trip.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.5.1** Planned this week on Home | Given items are planned for the current week, when the shopper opens Home, then a "Planned this week" box at the top lists them with the week's dates. | 5 |
| **4.5.2** Later weeks in the full list | Given items are planned for later weeks, when the shopper views Planned items, then each shows its own week and none appear in "Planned this week". | 3 |
| **4.5.3** Past weeks stay visible | Given an item's planned week has passed, when the shopper views Planned items, then it still shows its original week and is not moved automatically. | 3 |
| **4.5.5** Nothing planned this week | Given nothing is planned for the current week, when the shopper opens Home, then no "Planned this week" box is shown. | 1 |
| **4.5.6** New week begins | Given a new week starts while SmartCart is open, when the shopper returns to the app, then "Planned this week" shows the new week's items. | 3 |

## US 4.6 Plan a shopping trip from planned items

Card [2527836359](https://monashie.leankit.com/card/2527836359) · size 8

As a household shopper, I want to select planned items and start a shopping trip with them, so that my plan turns into a basket I can compare across stores.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (planWithSavedItems), [`next-trip.ts`](../../frontend/lib/next-trip.ts); backend/data: —.

**Tests** — [`next-trip.test.ts`](../../frontend/lib/next-trip.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.6.1** Select and plan a trip | Given a starting location is chosen and planned items are shown, when the shopper ticks items and presses "Plan trip with selected items", then the ticked items are added to the basket with their planned quantities and the Shop screen opens. | 5 |
| **4.6.2** Button appears after selecting | Given no planned item is ticked, when the shopper views "Planned this week" or Planned items, then "Plan trip with selected items" cannot be pressed. | 1 |
| **4.6.3** Merge with the current basket | Given the basket already has items, when the shopper presses "Plan trip with selected items", then existing items are kept and an item in both keeps one line with the larger quantity. | 3 |
| **4.6.4** Current prices for planned items | Given planned items were added to the basket, when the shopper compares stores, then each store uses its current prices for those items, not forecast prices. | 3 |
| **4.6.6** Leaving the trip keeps the plan | Given the shopper pressed "Plan trip with selected items" but has not saved a plan, when they leave the trip or start a new one, then those items stay in Planned items unchanged. | 3 |
| **4.6.7** Manual planned items | Given the shopper ticks a manually added planned item, when they press "Plan trip with selected items", then that item is not added to the basket or the store comparison and stays in Planned items. | 3 |
| **4.6.8** Plan a trip before choosing a location | Given no starting location is chosen yet, when the shopper ticks planned items and presses "Plan trip with selected items", then the ticked items are added to the basket and the Travel screen opens. | 3 |

## US 4.8 Use planned items while building a basket

Card [2530713910](https://monashie.leankit.com/card/2530713910) · size 8

As a household shopper, I want to see my planned items while I browse and review my basket, so that I can add them without going back to Home.

**Implementation** — frontend: [`planned-items-panel.tsx`](../../frontend/components/planned-items-panel.tsx), [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx) (NextTripList), [`next-trip.ts`](../../frontend/lib/next-trip.ts) (nextTripBasket); backend/data: —.

**Tests** — [`shopping-checklist.test.tsx`](../../frontend/components/shopping-checklist.test.tsx), [`next-trip.test.ts`](../../frontend/lib/next-trip.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.8.1** Planned items button | Given the shopper is on the Shop or "Review your basket" screen, when they look at the top of the screen, then a "Planned items" button shows how many items are planned. | 3 |
| **4.8.2** Open planned items while shopping | Given the shopper is on the Shop or "Review your basket" screen, when they press "Planned items", then a panel lists each planned item with its quantity and week, and the screen and basket stay as they were. | 3 |
| **4.8.3** Add a planned item to the basket | Given the "Planned items" panel is open, when the shopper presses "Add to basket" on an item, then it is added with its planned quantity (an item already in the basket keeps one line with the larger quantity), a confirmation appears and the item stays in Planned items. | 3 |
| **4.8.4** Manual planned items while shopping | Given a manually added item is in Planned items, when the "Planned items" panel shows it, then it has no "Add to basket" button. | 1 |
| **4.8.5** Nothing planned yet | Given the shopper has no planned items, when they press "Planned items", then the panel explains how to schedule an item. | 1 |

## US 4.9 Check a planned item's details and forecast

Card [2530713447](https://monashie.leankit.com/card/2530713447) · size 5

As a household shopper, I want to open a planned item's details and price forecast from my list, so that I can decide whether to keep its planned week.

**Implementation** — frontend: [`item-details-dialog.tsx`](../../frontend/components/item-details-dialog.tsx), [`catalogue-item-dialog.tsx`](../../frontend/components/catalogue-item-dialog.tsx), [`price-history.tsx`](../../frontend/components/price-history.tsx); backend/data: [`api.py`](../../backend/smartcart/api.py) (/items/lookup), [`catalogue.py`](../../backend/smartcart/catalogue.py) (get_catalogue_items).

**Tests** — [`shopping-checklist.test.tsx`](../../frontend/components/shopping-checklist.test.tsx), [`catalogue-item-dialog.test.tsx`](../../frontend/components/catalogue-item-dialog.test.tsx), [`test_estimate_ranges.py`](../../backend/tests/test_estimate_ranges.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **4.9.1** Open details from Planned items | Given a catalogue item is in Planned items (on Home, Checklist or the "Planned items" panel), when the shopper presses its name, then the item details window opens with the "Price trends" panel already open, showing the forecast and the planned week. | 5 |
| **4.9.2** No details for manual planned items | Given a manually added item is in Planned items, when the shopper looks at its name, then it cannot be pressed. | 1 |
| **4.9.3** Closing details keeps the list | Given the item details window was opened from Planned items, when the shopper closes it, then they return to the same screen and Planned items is unchanged. | 1 |
