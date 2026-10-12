# Epic 4, 6 and 7 iteration backlog

Snapshot: 7 October 2026. Planned dates: 6-13 October 2026. Lane: TO DO THIS ITERATION.

113 cards: 3 EPIC, 14 User story, and 96 AC. Each acceptance card has one explicit Given / When / Then scenario. Epic 4 now includes Planned shopping, item-level intended buy weeks, this-week trip planning and purchase reconciliation. The former price-freshness/community-signals Epic 6 remains discontinued and removed.

See [project context](project-context.md) for current implementation, agreed feature behaviour, and open decisions.

## 4.0 - Price History, Forecasting and Planned Shopping

Header: EPIC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527214818).

As a household shopper, I want to use item price history and forecasts to schedule the intended buy week for my planned items and turn the items due this week into a shopping trip, so that I can plan when to buy essentials and estimate the budget I may need.

Retain item-level historical graphs and 4-, 8-, and 12-week forecasts. Extend the existing Next trip saved-items list and rename it Planned shopping; do not create another saved-items list or a separate future-purchases checklist. Every planned item has a quantity and intended buy week, defaulting to This week. Items planned for this week is a filtered container over that same list, with selection and Plan shopping trip using those items. Upcoming and overdue items remain in the same list. The active trip checklist retains its role in tracking purchases after basket building and store selection. Forecast estimates support planning only; current price observations are used for store comparison and shopper-recorded prices for spending. Draft price basis: regional weekly median for the exact catalogue item/package; geographic scope and model remain to be confirmed. Evaluate forecasts using chronological holdout data against a baseline. Device-held planned records and existing saved/manual items must be preserved. No reminders, notifications, automatic purchasing, separate calendar app, or blanket app implementation is included in this backlog update.

### 4.1 - View item price history

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527214995).

As a household shopper, I want to see a price-history graph when I open an item in the Shop catalogue, so that I can understand how its price has changed over time.

#### 4.1.1 - Display historical graph [US 4.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215204).

Given the shopper has opened an item with historical prices,
When the price-history section loads,
Then a chronological graph displays dates on the horizontal axis and price in RM per catalogue package or unit on the vertical axis.

#### 4.1.2 - Identify the price series [US 4.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216679).

Given historical data exists for the opened item,
When the price graph is displayed,
Then the section identifies the item, package basis, geographic scope, aggregation method, source, and latest observation date.

#### 4.1.3 - Select historical period [US 4.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217076).

Given historical data is available,
When the shopper selects 3 months, 6 months, 1 year, or All available,
Then the graph shows that period and highlights its button; All available includes records from 2022 onward where available for that item.

#### 4.1.4 - Inspect historical values [US 4.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216681).

Given historical points are displayed,
When the shopper taps or hovers over a historical point,
Then its period and price are displayed.

#### 4.1.5 - Handle gaps in price history [US 4.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215419).

Given historical observations contain missing periods,
When the price-history graph is displayed,
Then missing periods remain identifiable and are not shown as zero or invented observations.

#### 4.1.6 - Handle unavailable price history [US 4.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253618).

Given no history exists for the selected item and period,
When the history request completes,
Then an explanatory message is displayed and the item's quantity and Add controls remain usable.

### 4.2 - View projected item prices

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215468).

As a household shopper, I want to view estimated item prices for the next 4 to 12 weeks, so that I can consider possible future price changes when planning purchases.

#### 4.2.1 - Display forecast [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215470).

Given an eligible historical series and a forecast are available,
When the graph loads,
Then projected weekly prices appear after the latest historical period.

#### 4.2.2 - Select forecast horizon [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217081).

Given projections are available,
When the shopper selects 4, 8, or 12 weeks,
Then the graph displays that horizon and highlights its button without changing the historical-period selection.

#### 4.2.3 - Distinguish observed and projected prices [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217083).

Given both historical observations and projections are available,
When the graph displays both series,
Then different line styles, a legend, and a labelled forecast boundary distinguish them.

#### 4.2.4 - Explain forecast meaning [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215431).

Given a forecast is available,
When the forecast is displayed,
Then its generation date and last historical period are identified, and an explanation states that projected prices are estimates rather than guaranteed future store prices.

#### 4.2.5 - Handle insufficient forecast history [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216980).

Given the item's historical series contains insufficient observations for forecasting,
When forecast eligibility is evaluated,
Then the card explains why projections are unavailable, preserves available history, and keeps normal item controls usable.

#### 4.2.6 - Handle forecast quality or freshness rejection [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527252896).

Given the historical series fails the configured quality or freshness requirements,
When forecast eligibility is evaluated,
Then the card explains the eligibility failure, omits projections, preserves available history, and keeps normal item controls usable.

#### 4.2.7 - Handle forecast generation failure [US 4.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527252365).

Given the historical series is eligible for forecasting,
When forecast generation fails,
Then the card explains that projections are unavailable, preserves available history, and keeps normal item controls usable.

### 4.3 - Understand projected purchase cost

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215603).

As a household shopper, I want to see projected unit prices and the estimated cost for my intended quantity and buy week, so that I can understand the possible budget impact before scheduling a purchase.

#### 4.3.1 - Inspect projected values [US 4.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216683).

Given projected points are displayed,
When the shopper taps or hovers over a projected point,
Then its week and estimated price are shown and explicitly labelled Projected.

#### 4.3.2 - Display projected purchase cost and RM change [US 4.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215433).

Given a forecast and a valid latest historical comparison value exist for the same item and package basis,
When the shopper views the forecast summary for a selected future week and valid quantity,
Then the summary shows the projected unit price, projected item cost as unit price multiplied by quantity, the comparable historical-reference item cost, and their estimated RM difference; these values are clearly labelled estimates rather than a guaranteed store quote or recorded saving.

#### 4.3.3 - Keep purchasing calculations separate [US 4.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216982).

Given the opened item has projected prices,
When the shopper adds the item to their basket,
Then projected prices do not replace observed prices used for current basket totals, store rankings, or recorded spending.

#### 4.3.4 - Display percentage change only with a positive baseline [US 4.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527252373).

Given a forecast summary includes a latest historical comparison value,
When the summary evaluates percentage change,
Then a percentage is displayed only for a positive comparison value; a non-positive comparison value produces no fabricated percentage.

#### 4.3.5 - Update cost insight for purchase choices [US 4.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836894).

Given a forecast-based cost insight is displayed for an item,
When the shopper changes the selected quantity or future week,
Then the projected item cost and comparison difference update using the new selection without a page reload.

### 4.4 - Schedule items in Planned shopping

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836607).

As a household shopper, I want every item saved in Planned shopping to have a quantity and intended buy week, so that my existing saved-items list becomes one coherent purchase schedule.

#### 4.4.1 - Use the existing planned-items list [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836491).

Given the shopper opens the existing Next trip saved-items area,
When the updated planning interface is displayed,
Then that area is named Planned shopping and exposes the existing saved items as the same canonical list; no separate future-purchases or forecast checklist is created.

#### 4.4.2 - Choose a buy week from an item card [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836351).

Given the shopper opens a supported catalogue item,
When the shopper selects Add to planned shopping,
Then the item can be saved with a chosen valid quantity and intended buy week, independently of the existing Add to basket action.

#### 4.4.3 - Default new planned items to this week [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836353).

Given an item is being added to Planned shopping through a catalogue action or the existing save-for-later action,
When the intended buy week selector is first displayed,
Then This week is preselected and the shopper can choose a later buy week before saving.

#### 4.4.4 - Persist the planned purchase on this device [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836493).

Given an item has a valid quantity and intended buy week,
When the shopper saves it to Planned shopping,
Then its identity, quantity and intended week are stored on the device and remain available after reload, without changing the active basket, active trip checklist, or recorded spending.

#### 4.4.5 - Allow planning without a usable forecast [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835967).

Given a planned item has no usable forecast for its intended week, including a manual item or a week outside the forecast horizon,
When the shopper saves or views the item,
Then the item can still be scheduled and its forecast cost is labelled unavailable rather than zero or a fabricated estimate.

#### 4.4.6 - Edit quantity or intended week [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836058).

Given an outstanding planned item exists,
When the shopper saves a changed valid quantity or intended buy week,
Then the same planned record is updated, its applicable week grouping and available estimate are refreshed, and unrelated planned items or confirmed trip quantities remain unchanged.

#### 4.4.7 - Remove a planned item [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836398).

Given an outstanding planned item exists,
When the shopper selects Remove from planned shopping,
Then that item is removed from the planned list and its week container without removing items from an already confirmed trip checklist or changing trip history.

#### 4.4.8 - Avoid duplicate saved records [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836060).

Given the same item identity is already present in Planned shopping,
When the shopper saves it again with a selected quantity and intended week,
Then the existing planned record is updated to those selected values instead of adding another copy; the update is confirmed to the shopper.

#### 4.4.9 - Preserve legacy saved items [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836400).

Given device storage contains Next trip items without an intended week,
When the updated Planned shopping feature loads them for the first time,
Then their identities, names, quantities and manual/catalogue distinctions are preserved, a This week intended week is assigned and saved once, and no records are duplicated or discarded.

#### 4.4.10 - Validate planned item fields [US 4.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836795).

Given the planned item form has an invalid quantity or no valid current/future intended week,
When the shopper attempts to save it,
Then saving is prevented and the invalid field is explained without changing the existing planned list.

### 4.5 - Review this week's and upcoming planned items

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836897).

As a household shopper, I want a section showing items planned for this week alongside upcoming and overdue items in the same Planned shopping list, so that I can see what needs buying now and prepare for later purchases.

#### 4.5.1 - Display items planned for this week [US 4.5]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836355).

Given outstanding planned items have stored intended buy weeks,
When Planned shopping is displayed,
Then the Items planned for this week container shows the records whose intended week matches the current Monday-to-Sunday calendar week in Asia/Kuala_Lumpur, with names, quantities, intended week and planning status.

#### 4.5.2 - Group upcoming items by week [US 4.5]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835863).

Given outstanding planned items have intended weeks after the current week,
When Planned shopping is displayed,
Then those items appear below the current-week container grouped by their intended week in chronological order, as views of the same records rather than copies.

#### 4.5.3 - Keep overdue items visible [US 4.5]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836357).

Given an outstanding planned item's intended week is before the current week,
When Planned shopping is displayed,
Then the item is shown in an Overdue group with its original intended week and a Reschedule action; its date is not silently moved into the current week.

#### 4.5.4 - Show honest weekly estimated budgets [US 4.5]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836693).

Given a week group contains planned items with differing forecast coverage,
When its budget summary is displayed,
Then the summary shows the sum of available quantity-based item estimates with a coverage count; an incomplete amount is labelled Partial estimated item cost, unavailable values are not zero, and transport cost or recorded spending is not included.

#### 4.5.5 - Handle no items planned for this week [US 4.5]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836062).

Given no outstanding planned items belong to the current week,
When Planned shopping is displayed,
Then the current-week container shows No items planned for this week and its Plan shopping trip action is disabled, while upcoming and overdue groups remain available.

#### 4.5.6 - Update week groups as time advances [US 4.5]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835865).

Given planned items remain stored across a calendar-week boundary,
When the shopper opens or resumes Planned shopping in the new week,
Then current, upcoming and overdue groups are recalculated from the local week without changing the items' stored intended weeks.

### 4.6 - Plan a shopping trip with this week's items

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836359).

As a household shopper, I want to select items planned for this week and use them to plan a shopping trip through the existing basket and store-selection flow, so that my purchase schedule leads to an actionable shopping checklist.

#### 4.6.1 - Plan with selected current-week items [US 4.6]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836799).

Given the current-week container has selectable outstanding items,
When the shopper selects at least one item and presses Plan shopping trip,
Then only the selected planned items and quantities enter the existing trip-planning flow; unselected, future-week and overdue records are not automatically included or removed.

#### 4.6.2 - Preserve the existing basket during planning [US 4.6]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835969).

Given the basket already contains items and selected planned catalogue items are ready to be used,
When Plan shopping trip prepares the basket,
Then unrelated basket lines are preserved, matching catalogue lines are merged using the existing saved-item quantity rule instead of duplicated, and the shopper can review the resulting quantities before comparing stores.

#### 4.6.3 - Compare stores with current pricing [US 4.6]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836495).

Given selected planned catalogue items have entered trip planning,
When the shopper requests store recommendations,
Then the existing location and travel preferences are required and the recommendation calculation uses current pricing under the existing source rules rather than saved forecasts; the selected items retain their planned-record linkage.

#### 4.6.4 - Mark confirmed items as in the current trip [US 4.6]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835867).

Given the shopper has selected planned items and reviewed a store recommendation,
When the shopper confirms the trip through the existing checklist-confirmation flow,
Then the selected records are linked to that active trip and shown as In current trip in Planned shopping, without being marked bought or copied into a second future checklist; they cannot be selected again to duplicate their inclusion in that active trip.

#### 4.6.5 - Preserve plans after abandoning trip planning [US 4.6]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836363).

Given selected planned items have entered basket building but the trip has not been confirmed,
When the shopper abandons or cancels that trip-planning flow,
Then their planned records, quantities and intended weeks remain available and are not marked fulfilled.

#### 4.6.6 - Carry manual planned items honestly [US 4.6]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835971).

Given selected planned items include manual items without catalogue identifiers,
When the trip is prepared and confirmed through the existing shopping flow,
Then manual items remain linked and are carried as manual checklist lines rather than silently dropped or assigned catalogue forecasts; they are clearly excluded from catalogue-based price comparisons.

### 4.7 - Reconcile planned items with actual purchases

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836611).

As a household shopper, I want Planned shopping to reflect which linked items I actually bought and retain anything still needed, so that my purchase schedule stays accurate after a shopping trip.

#### 4.7.1 - Fulfil a fully purchased planned item [US 4.7]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836064).

Given a linked planned item's full outstanding quantity is marked bought in the active checklist,
When the shopper records that trip,
Then that quantity is fulfilled and the item is removed from outstanding Planned shopping, while its actual purchase remains in the trip record.

#### 4.7.2 - Retain an unpurchased remainder [US 4.7]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836613).

Given a linked planned item has only part of its outstanding quantity marked bought,
When the shopper records that trip,
Then only the bought quantity is fulfilled and the remaining quantity is released from the completed trip and stays in Planned shopping with its intended week and an option to reschedule.

#### 4.7.3 - Keep unbought planned items [US 4.7]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527836615).

Given a linked planned item is not bought during the trip,
When the shopper records that trip,
Then its quantity and intended week remain in Planned shopping, it is released from the completed trip, and the shopper can reschedule it without creating a duplicate saved item.

#### 4.7.4 - Avoid repeated fulfilment of one trip record [US 4.7]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835869).

Given a recorded trip's purchase quantities have already been reconciled with Planned shopping,
When the same trip record is processed again,
Then those quantities are not deducted a second time and outstanding planned quantities remain correct.

#### 4.7.5 - Save new unbought items in the same planned list [US 4.7]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527835973).

Given an unbought checklist item is not already linked to a planned record,
When the shopper uses the existing save-for-later action or records the trip with that item unbought,
Then the item is saved into Planned shopping with an editable intended week defaulting to This week, rather than a separate Next trip list.

## 6.0 - Multi-Store Basket Recommendations

Header: EPIC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216862).

As a household shopper, I want to optionally compare shopping plans across multiple stores, including their travel costs and limits, so that I can decide whether splitting my basket offers worthwhile savings.

Initial scope: maximum two stores. The original travel preferences govern origin to first store; the expandable Second-store travel limits menu governs first store to second store using time, distance, or both. Combined cost includes the complete return route. Epic 6 now refers to Multi-Store Basket Recommendations. The previous Price Freshness, Community Prices, and Availability Signals epic was discontinued and its 22 board cards were removed on 6 October 2026. Integrating split-store assignments into Epic 5 checklists and trip history requires a separate integration story. If public transport routing or fare data cannot support inter-store journeys, show multi-store mode as unavailable for that mode.

### 6.1 - Enable and configure multi-store recommendations

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215479).

As a household shopper, I want to enable multi-store recommendations and choose preset limits for travelling to a second store using the same travel-limit menu as the initial location selection, so that I can compare split-basket plans that suit my travel preferences.

#### 6.1.1 - Disabled by default [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216687).

Given the shopper starts a new recommendation session,
When the recommendation page opens,
Then Include multi-store plans is disabled and the second-store travel menu is collapsed.

#### 6.1.2 - Expand configuration [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217255).

Given multi-store mode is disabled,
When the shopper enables it,
Then the Second-store travel limits menu expands on the recommendation page.

#### 6.1.3 - Choose distance presets [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215481).

Given the Second-store travel limits menu is expanded,
When the shopper selects Distance,
Then the menu displays the same distance preset buttons as initial location selection, currently 2, 5, 10, and 15 km, with no time group or manual numeric input; both menus use the same configured distance options.

#### 6.1.4 - Explain the travel leg [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216865).

Given multi-store mode is enabled,
When the second-store travel menu is displayed,
Then explanatory text states that its limits apply to travel from the first store to the second store using the selected transport mode.

#### 6.1.5 - Select and highlight a travel preset [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215209).

Given the second-store travel menu is expanded,
When the shopper selects a preset button,
Then that preset becomes the selected maximum and is visibly highlighted, with exactly one selected preset in each active group; limits are chosen using buttons rather than manually entered values.

#### 6.1.6 - Disable multi-store mode [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215483).

Given multi-store mode is enabled,
When the shopper disables it,
Then the menu collapses, two-store plans are removed, and existing single-store recommendations remain available without changing the basket.

#### 6.1.7 - Choose time presets [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253342).

Given the Second-store travel limits menu is expanded,
When the shopper selects Time,
Then the menu displays the same time preset buttons as initial location selection, currently 10, 20, 30, and 45 minutes, with no distance group or manual numeric input; both menus use the same configured time options.

#### 6.1.8 - Choose both preset groups [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253633).

Given the Second-store travel limits menu is expanded,
When the shopper selects Both,
Then both distance and time preset groups are displayed using the same configured options as initial location selection, with no manual numeric input.

#### 6.1.9 - Apply valid second-store presets [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253345).

Given a supported preset is selected for every active group, with one distance preset for Distance, one time preset for Time, or one of each for Both,
When the shopper selects Apply limits,
Then recommendations are recalculated using those presets to include eligible single-store and two-store plans.

#### 6.1.10 - Reject unsupported or missing presets [US 6.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253531).

Given a required preset is missing or unsupported for the selected constraint type,
When the shopper attempts to apply the second-store limits,
Then submission is prevented and an explanation identifies the invalid or missing selection.

### 6.2 - Apply second-store travel constraints

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217087).

As a household shopper, I want the journey between recommended stores to meet my selected time and distance limits, so that splitting my basket does not require more travel between stores than I am willing to make.

#### 6.2.1 - Apply existing first-store limits [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216570).

Given a two-store plan is being evaluated,
When its origin-to-first-store leg is checked,
Then the first store must meet the existing travel preferences; the second store is evaluated through the second-store limits rather than independently against the origin-to-store limit.

#### 6.2.2 - Apply time limit [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216984).

Given Time is selected for second-store travel,
When a two-store plan's inter-store route is checked,
Then the plan is eligible only if the estimated inter-store travel time is less than or equal to the selected maximum minutes.

#### 6.2.3 - Apply distance limit [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217257).

Given Distance is selected for second-store travel,
When a two-store plan's inter-store route is checked,
Then the plan is eligible only if the routed inter-store distance is less than or equal to the selected maximum km.

#### 6.2.4 - Apply both limits [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215019).

Given Both is selected for second-store travel,
When a two-store plan's inter-store route is checked,
Then the plan is eligible only if both the selected time and distance limits are satisfied; satisfying one limit alone is insufficient.

#### 6.2.5 - Evaluate visit order [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217259).

Given two stores form a candidate plan,
When routing is evaluated,
Then both visit orders are checked against the first-store and second-store constraints, and the eligible order with the lowest estimated complete-route transport cost is selected.

#### 6.2.6 - Include the return journey [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215485).

Given a two-store plan meets the applicable first-store and second-store constraints,
When its transport estimate is calculated,
Then the estimate covers origin to first store to second store to origin, and the overview explains that the second-store limits apply only to the inter-store leg.

#### 6.2.7 - Handle unavailable routes [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215487).

Given a candidate two-store plan requires routing in the selected transport mode,
When a required route leg cannot be estimated,
Then the affected plan is excluded from combined-cost ranking and no fabricated travel estimate is shown.

#### 6.2.8 - Handle no matching plans [US 6.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215609).

Given no two-store plan meets the selected constraints,
When the recommendation request completes,
Then eligible single-store recommendations remain visible with No multi-store plans match your second-store travel limits and an action to edit those limits.

### 6.3 - Compare plans by combined cost

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217090).

As a household shopper, I want single-store and multi-store plans compared using basket cost plus estimated transport cost, so that I can identify the lowest estimated total cost.

#### 6.3.1 - Allocate basket items [US 6.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217092).

Given a candidate two-store plan has official item prices,
When basket lines are allocated to its stores,
Then each line's full requested quantity is assigned to one participating store with a valid positive official price; the line's quantity is not split across stores.

#### 6.3.2 - Calculate combined cost [US 6.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216572).

Given a plan has complete pricing,
When its cost is calculated,
Then the basket subtotal equals the sum of assigned unit prices multiplied by quantities, and the combined total equals that subtotal plus estimated transport cost for the complete return route.

#### 6.3.3 - Rank mixed plans [US 6.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217261).

Given complete single-store and two-store plans meet their applicable travel constraints,
When recommendations are ranked,
Then plans are ordered by basket subtotal plus estimated complete-route transport cost, with ties resolved by fewer stores, shorter total travel time, shorter total route distance, then stable store identifiers.

#### 6.3.4 - Keep incomplete plans separate [US 6.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217094).

Given a plan lacks a valid price for at least one requested basket line,
When recommendations are displayed,
Then the plan appears under Incomplete baskets with price coverage and a Partial total and is not presented as the cheapest complete basket.

#### 6.3.5 - Compare savings against an eligible single-store plan [US 6.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217096).

Given an eligible complete two-store plan and at least one eligible complete single-store plan exist,
When comparison savings are displayed,
Then the saving compares their combined totals using the lowest-cost eligible single-store plan as the baseline.

#### 6.3.6 - Handle missing single-store savings baseline [US 6.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527252396).

Given a two-store plan exists but no eligible complete single-store baseline exists,
When the plan's savings comparison is displayed,
Then no numeric saving against a single-store plan is shown.

### 6.4 - Inspect a multi-store plan

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215611).

As a household shopper, I want to see which items to purchase at each store and the proposed visit order, so that I can understand and follow the recommended plan.

#### 6.4.1 - Show route and constraint details [US 6.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215211).

Given a two-store recommendation is available,
When the shopper opens its overview,
Then the overview displays visit order, participating stores and available addresses, inter-store distance and time, selected second-store limits, total return-route distance and time, basket subtotal, transport estimate, and combined total.

#### 6.4.2 - Group purchases by store [US 6.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216870).

Given the shopper has selected a two-store plan,
When its item-price overview is displayed,
Then basket lines are grouped by assigned store and show item name, package size, quantity, unit price, line total, and price observation date.

#### 6.4.3 - Preserve source and eligibility labels [US 6.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215213).

Given a plan contains store prices and SARA statuses,
When its store information is displayed,
Then each store retains the existing freshness, source, and verification labels, one store's status is not applied to the whole plan, and active store filters apply to every participating store.

#### 6.4.4 - Preserve configuration on return [US 6.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215215).

Given the shopper is viewing a multi-store overview,
When the shopper returns to recommendations,
Then the basket, original travel preferences, multi-store setting, second-store constraint type and selected presets, and selected results tab are preserved.

#### 6.4.5 - Handle no eligible two-store plans [US 6.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216574).

Given no two-store plan meets the active rules,
When the recommendation results are displayed,
Then eligible single-store plans remain visible with an explanatory message and an action to edit the second-store travel limits.

#### 6.4.6 - Restore highlighted presets on reopening [US 6.4]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253637).

Given the shopper has returned to recommendations with preserved second-store presets,
When the second-store travel menu is reopened,
Then the preserved distance and time preset buttons remain visibly selected in the active groups.

## 7.0 - Healthier Alternatives and Nutrition Insights

Header: EPIC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217263).

As a household shopper, I want to explore curated healthier alternatives and understand their nutritional differences, so that I can make an informed choice when adding items to my basket.

Alternatives are manually mapped within the fixed catalogue. Each item is mapped to a nutrition dataset. Why this alternative? opens an inline comparison below the alternatives section; selecting the main alternative card opens that item's details. Supporting content task: maintain reviewed original/alternative catalogue IDs, nutrition entries, comparable measurement basis, supporting nutrient differences and explanations. A nutritional recommendation does not imply a lower price.

### 7.1 - View healthier alternatives

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217098).

As a household shopper, I want to see curated healthier alternatives below an item's details, so that I can consider suitable alternatives while browsing the catalogue.

#### 7.1.1 - Display mapped alternatives [US 7.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216692).

Given the opened item has approved alternative mappings,
When its details load,
Then a Healthier alternatives section displays those items as small cards below the item details.

#### 7.1.2 - Identify each alternative [US 7.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215489).

Given a supported alternative exists for the opened item,
When its alternative card is displayed,
Then the card shows the catalogue item name, package size, and a short supported comparison reason such as a difference in a specified nutrient.

#### 7.1.3 - Restrict suggestions to supported mappings [US 7.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217100).

Given manual alternative mappings are available,
When the system retrieves alternatives for the opened item,
Then only active catalogue items with approved mappings and a supported nutritional comparison are displayed.

#### 7.1.4 - Handle no healthier alternatives [US 7.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216875).

Given no supported alternative exists for the opened item,
When the alternatives request completes successfully,
Then the section shows No healthier alternatives available for this item, and normal item details and Add controls remain usable.

#### 7.1.5 - Handle alternatives loading failure [US 7.1]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527254222).

Given the shopper has opened an item,
When retrieving healthier alternatives fails,
Then the alternatives section shows an unavailable message while normal item details and Add controls remain usable.

### 7.2 - Explore and add an alternative

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215614).

As a household shopper, I want to open a suggested alternative and return to the original item, so that I can compare options before choosing what to add.

#### 7.2.1 - Open alternative details [US 7.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215616).

Given a suggested alternative card is displayed,
When the shopper selects its main item area,
Then the alternative's details open with its own quantity and Add controls, and the basket remains unchanged.

#### 7.2.2 - Return to the previous item [US 7.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216988).

Given the shopper opened an alternative from a previous item,
When the shopper selects the visible Back to [previous item] button,
Then the previous item is restored with its unsubmitted quantity selection.

#### 7.2.3 - Support further exploration [US 7.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217103).

Given the shopper has explored further alternatives from the current item,
When the shopper uses Back,
Then the view returns one level through the visited items, allowing repeated Back actions to reach the original item.

#### 7.2.4 - Add only the selected item [US 7.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215619).

Given the currently displayed original or alternative item has a valid selected quantity,
When the shopper presses Add,
Then that item is added using the existing basket rules without automatically removing or replacing the original item.

#### 7.2.5 - Preserve existing controls [US 7.2]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216877).

Given the shopper is viewing an original or alternative item,
When the shopper uses its quantity and Add controls,
Then quantity validation, duplicate-item handling, and add confirmation follow the existing Epic 1 behaviour.

### 7.3 - Understand why an alternative is recommended

Header: User story. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216879).

As a household shopper, I want to inspect the nutritional differences between an item and its recommended alternative, so that I can understand the recommendation before deciding what to add.

#### 7.3.1 - Provide a separate insights action [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217105).

Given a supported healthier alternative is available,
When its small item card is displayed,
Then a visible Why this alternative? button appears separately from the main item-opening action.

#### 7.3.2 - Expand insights inline [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215218).

Given a healthier alternative card is displayed,
When the shopper selects Why this alternative?,
Then a nutrition comparison expands below the alternatives section without opening another item, changing the current quantity selection, or modifying the basket.

#### 7.3.3 - Identify both items [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215495).

Given nutrition insights are available for the selected suggestion,
When the comparison is displayed,
Then it identifies the original item and selected alternative and explains the specific nutritional differences supporting the recommendation.

#### 7.3.4 - Compare nutrients on the same basis [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527217265).

Given both items have comparable nutrient measurements,
When their nutrition comparison is displayed,
Then both use the same comparison basis, such as per 100 g or per 100 mL, with nutrient units clearly labelled.

#### 7.3.5 - Identify the nutrition evidence [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215220).

Given nutrition insights are available,
When the comparison is displayed,
Then it identifies the nutrition dataset and mapped food entries for both items.

#### 7.3.6 - Show nutritional trade-offs [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527215222).

Given another tracked nutrient presents a relevant trade-off for the suggested alternative,
When the nutrition comparison is displayed,
Then that difference is also displayed rather than implying that the alternative improves every nutritional measure.

#### 7.3.7 - Switch the comparison [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216881).

Given insights for one alternative are open,
When the shopper selects Why this alternative? on another suggestion,
Then the section updates to compare the original item with the newly selected alternative.

#### 7.3.8 - Close insights [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527216697).

Given nutrition insights are open,
When the shopper selects Close insights,
Then the section collapses while preserving the current item, quantity selection, and basket.

#### 7.3.9 - Handle incompatible nutrition measurements [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527254448).

Given the items' measurement bases or preparation states are incompatible and no documented conversion is available,
When their nutrition comparison is displayed,
Then the affected values are labelled non-comparable and are not presented as directly comparable.

#### 7.3.10 - Disclose generic nutrition mapping [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253578).

Given a nutrition mapping represents a generic food rather than the exact catalogue product,
When the insights are displayed,
Then the affected item's generic mapping is clearly disclosed.

#### 7.3.11 - Handle missing nutrition values [US 7.3]

Header: AC. [LeanKit card](https://monashie.leankit.com/board/2494576111?card=2527253944).

Given a required nutrient value is missing or non-comparable,
When the nutrition comparison is displayed,
Then the affected value is labelled unavailable and is not treated as zero or used to justify the recommendation.

