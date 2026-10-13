# Epic 5 — Shopping checklist and trip tracking

> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2512848026](https://monashie.leankit.com/card/2512848026) |
| Size | 10 |
| Planned window | 2026-09-08 → 2026-09-18 |
| Assigned | Zhihao Zhao, Chenglong Meng, Shunnosuke Takei |
| Stories / ACs | 8 / 68 |

As a household shopper, I want to build checklists, record shopping trips, and keep track of items I did not buy, so that I can plan, review, and continue my shopping over time.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [5.1](#us-51-use-the-shopping-checklist) | Use the shopping checklist | MUST | 10 | 23 | Shunnosuke Takei |
| [5.2](#us-52-mark-shopping-outcomes) | Mark shopping outcomes | MUST | 5 | 4 | Shunnosuke Takei |
| [5.4](#us-54-record-a-shopping-trip) | Record a shopping trip | MUST | 5 | 6 | Zhihao Zhao |
| [5.5](#us-55-view-and-manage-my-trip-history) | View and manage my trip history | MUST | 8 | 10 | Zhihao Zhao |
| [5.6](#us-56-schedule-unbought-items-for-a-later-trip) | Schedule unbought items for a later trip | SHOULD | 8 | 10 | Shunnosuke Takei |
| [5.7](#us-57-export-a-shopping-checklist) | Export a shopping checklist | COULD | 8 | 8 | Zhihao Zhao |
| [5.8](#us-58-record-the-travel-costs-of-my-trip) | Record the travel costs of my trip | — | 5 | 4 | Shunnosuke Takei |
| [5.9](#us-59-check-a-checklist-items-details) | Check a checklist item's details | — | 5 | 3 | Shunnosuke Takei |

## US 5.1 Use the shopping checklist

Card [2512848121](https://monashie.leankit.com/card/2512848121) · size 10 · MUST

As a household shopper, I want to save a store plan as a checklist and manage its items, so that I can track my shopping in store.

**Implementation** — frontend: [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx), [`shopping-checklist.ts`](../../frontend/lib/shopping-checklist.ts); backend/data: —.

**Tests** — [`shopping-checklist.test.ts`](../../frontend/lib/shopping-checklist.test.ts), [`shopping-checklist.test.tsx`](../../frontend/components/shopping-checklist.test.tsx), [`checklist-snapshots.test.ts`](../../frontend/lib/checklist-snapshots.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.1.1** Create a checklist | Given the shopper is on a store details page with no active checklist, when they press "Save plan", then a checklist for that store is created from the current basket and the checklist screen opens. | 5 |
| **5.1.2** Checklist lines | Given the checklist is open, when the shopper views the items, then each item is listed once with a tick box, its details, quantity, price, total and status. | 3 |
| **5.1.3** Add a custom item | Given the checklist is open, when the shopper presses "Add item", enters a name, quantity and optional price, and presses "Save item", then the item is added to the checklist marked as a manual item. | 3 |
| **5.1.4** Edit an item | Given an item is on the checklist, when the shopper presses its edit (pencil) button, changes the name, quantity or price and presses "Save item", then the item and totals update. | 3 |
| **5.1.5** Revert an edited item | Given an item's name, quantity or price has been edited, when the shopper presses its revert button, then the item returns to the values it had when the checklist was created. | 3 |
| **5.1.6** Ask before replacing a checklist | Given an active checklist exists, when the shopper presses "Update plan" on a store details page, then a dialog warns that the current checklist and its progress will be replaced. | 3 |
| **5.1.7** Confirm replacing a checklist | Given the "Update plan" dialog is open, when the shopper presses "Update plan", then the new store plan replaces the active checklist and the checklist screen opens. | 3 |
| **5.1.8** Cancel replacing a checklist | Given the "Update plan" dialog is open, when the shopper presses "Cancel", then the dialog closes and the active checklist and its progress are unchanged. | 1 |
| **5.1.9** Item form validation | Given the add or edit form is open, when the shopper presses "Save item" with a missing name, an invalid quantity or an invalid price, then an error message explains the problem and nothing is saved. | 3 |
| **5.1.10** Edit form shows planned price and field reverts | Given the shopper presses the edit button on an item from the store plan, when the "Edit item" form opens, then it shows the item and its planned price. | 3 |
| **5.1.11** Delete an item | Given an item is on the checklist, when the shopper presses its bin button and confirms in the "Delete item" dialog, then the item is removed and the totals update. | 3 |
| **5.1.12** Delete the checklist | Given a checklist is open, when the shopper presses "Delete checklist" and confirms in the dialog, then the checklist and its manual items are removed from the device and Home opens. | 3 |
| **5.1.13** Filter by status | Given the checklist is open, when the shopper presses "All items", "Bought" or "Not bought", then only matching items are shown, with item counts on each button. | 3 |
| **5.1.14** Checklist header | Given the shopper has saved a plan, when the checklist opens, then its header shows the store's name, address, SARA status and an "Open in Google Maps" link. | 3 |
| **5.1.15** Progress and total | Given the checklist has items, when the shopper views it, then a progress bar shows how many items are bought and the checklist total is shown, noting any items without a price. | 3 |
| **5.1.16** No active checklist | Given no checklist exists, when the shopper opens Checklist, then a message says there is no active checklist, with a "Start or resume shopping trip" button that opens the trip. | 1 |
| **5.1.17** Checklist stays on the device | Given the shopper has an active checklist, when they close and reopen SmartCart on the same device, then the checklist, its ticks and edits are still there. | 3 |
| **5.1.19** Revert disabled when unedited | Given an item has not been edited, when the shopper looks at its row actions, then its revert button is disabled. | 1 |
| **5.1.20** Revert one field | Given the "Edit item" form is open and a field has been changed, when the shopper presses the revert button beside that field, then only that field returns to its original value. | 3 |
| **5.1.21** Cancel adding or editing | Given the "Add item" or "Edit item" form is open, when the shopper presses "Cancel", "×" or Escape, then the form closes and the checklist is unchanged. | 1 |
| **5.1.22** Cancel deleting an item | Given the "Delete item" dialog is open, when the shopper presses its cancel (×) button, then the item stays on the checklist. | 1 |
| **5.1.23** Cancel deleting the checklist | Given the "Delete checklist" dialog is open, when the shopper presses its cancel (×) button, then the checklist is unchanged. | 1 |
| **5.1.24** Checklist map link | Given the checklist is open, when the shopper presses "Open in Google Maps", then Google Maps opens with the route to the store (or the store's location if no starting point was saved). | 3 |

## US 5.2 Mark shopping outcomes

Card [2512848124](https://monashie.leankit.com/card/2512848124) · size 5 · MUST

As a household shopper, I want to mark each item as bought or not bought, so that my checklist and trip record show what happened during my shop.

**Implementation** — frontend: [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx), [`shopping-checklist.ts`](../../frontend/lib/shopping-checklist.ts); backend/data: —.

**Tests** — [`shopping-checklist.test.ts`](../../frontend/lib/shopping-checklist.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.2.1** Tick an item as bought | Given an item shows "Not bought", when the shopper ticks its box, then its status changes to "Bought" and the progress count goes up, with the quantity unchanged. | 3 |
| **5.2.2** Untick a bought item | Given an item shows "Bought", when the shopper unticks its box, then its status changes back to "Not bought" and the progress count goes down. | 3 |
| **5.2.3** Empty checklist | Given the checklist has no items, when the shopper views it, then a message says it is empty and "Record shopping trip" and "Export checklist" are disabled. | 1 |
| **5.2.4** Record with unbought items | Given some checklist items are still "Not bought", when the shopper records the trip, then the record is saved and those items are kept in it as not bought. | 3 |

## US 5.4 Record a shopping trip

Card [2512848245](https://monashie.leankit.com/card/2512848245) · size 5 · MUST

As a household shopper, I want to save my shopping checklist as a trip record, so that I can review what I bought, what I did not buy, and what I spent.

**Implementation** — frontend: [`trip-history.ts`](../../frontend/lib/trip-history.ts), [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx); backend/data: —.

**Tests** — [`trip-history.test.ts`](../../frontend/lib/trip-history.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.4.1** Save a trip record | Given the checklist has items, when the shopper presses "Record shopping trip" and confirms, then the trip, with each item's status, prices and travel costs, is saved and the Shopping history screen opens. | 5 |
| **5.4.2** Bought total | Given a trip has been recorded, when the shopper views it in Shopping history, then its item spending adds up only the bought items, using the shopper's edited price where one was entered. | 3 |
| **5.4.3** Confirmation message | Given the checklist has items, when the shopper presses "Record shopping trip", then a dialog asks them to confirm and reminds them to schedule any unbought items first. | 3 |
| **5.4.4** Cancel recording | Given the record confirmation dialog is open, when the shopper presses "Cancel", then nothing is saved and the checklist stays open. | 1 |
| **5.4.5** Trip ends after recording | Given the shopper has just recorded a trip, when they return to Home, then the basket and starting location are cleared and a new trip can be started, while the checklist stays available. | 3 |
| **5.4.6** Recording the same checklist again | Given the checklist was already recorded, when the shopper presses "Record shopping trip" again, then the dialog warns it was already recorded and asks whether to save another record. | 3 |

## US 5.5 View and manage my trip history

Card [2512848526](https://monashie.leankit.com/card/2512848526) · size 8 · MUST

As a household shopper, I want to review my recorded trips in one place, so that I can understand my spending over time.

**Implementation** — frontend: [`shopping-history.tsx`](../../frontend/components/shopping-history.tsx), [`trip-history.ts`](../../frontend/lib/trip-history.ts); backend/data: —.

**Tests** — [`shopping-history.test.tsx`](../../frontend/components/shopping-history.test.tsx), [`trip-history.test.ts`](../../frontend/lib/trip-history.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.5.1** Trip history list | Given the shopper has recorded trips, when they open Shopping history, then trips are listed newest first, each with its date, store, number of items bought and item spending total. | 5 |
| **5.5.2** Empty history | Given the shopper has not recorded a trip, when they open Shopping history, then a message says no trips are recorded yet and explains how to record one. | 1 |
| **5.5.3** View purchases and costs | Given a trip is listed, when the shopper presses "View purchases & costs", then the trip expands to list each bought item with its quantity, price and total. | 5 |
| **5.5.4** Trip costs | Given a trip is expanded, when the shopper reads "Trip costs", then it shows the items total, SARA credit, cash needed, travel costs and the combined total, with notes that SARA and travel amounts are estimates. | 5 |
| **5.5.5** Partial spending | Given some bought items in a trip have no price, when the trip is shown, then its total is labelled as partial with a note that unpriced items are excluded. | 3 |
| **5.5.6** Delete a trip | Given a trip is listed, when the shopper presses "Delete trip" and confirms, then the trip is removed from the list. | 3 |
| **5.5.7** Payment breakdown unavailable | Given a trip has no priced bought items, when the shopper expands it, then SARA credit and cash needed show "—" with a note explaining why. | 3 |
| **5.5.8** Approximate route note | Given a trip was planned with approximate routes, when the shopper expands it, then a note says its travel used an approximate route. | 1 |
| **5.5.9** No bought items | Given a trip has no bought items for one of its stores, when the shopper expands it, then that store's section says nothing was bought there. | 1 |
| **5.5.10** Cancel deleting a trip | Given the delete-trip confirmation is showing, when the shopper presses Cancel, then the trip stays in the list. | 1 |

## US 5.6 Schedule unbought items for a later trip

Card [2518663727](https://monashie.leankit.com/card/2518663727) · size 8 · SHOULD

As a household shopper, I want to schedule items I did not buy into my Planned items and bring planned items into my checklist, so that nothing I still need is forgotten.

**Implementation** — frontend: [`next-trip.ts`](../../frontend/lib/next-trip.ts), [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx); backend/data: —.

**Tests** — [`next-trip.test.ts`](../../frontend/lib/next-trip.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.6.1** Schedule an unbought item | Given a checklist item is "Not bought", when the shopper presses its bookmark, chooses a week and presses "Save planned item", then the item is added to Planned items and its status shows "Planned purchase". | 3 |
| **5.6.2** No bookmark on bought items | Given a checklist item is "Bought", when the shopper opens its row actions, then no bookmark (schedule) button is offered. | 3 |
| **5.6.4** Add a planned item to the checklist | Given the checklist is open, when the shopper presses "+" ("Add to checklist") on a planned item, then the item is added to the checklist with its planned quantity and removed from Planned items. | 5 |
| **5.6.5** Current prices only | Given the shopper adds a planned item to the checklist, when the item appears, then it shows the checklist store's current price, or "—" if that store has none. | 3 |
| **5.6.6** Unschedule from the checklist | Given a checklist row shows "Planned purchase", when the shopper presses its bookmark again ("Remove from planned items"), then the item is removed from Planned items and the row shows "Not bought". | 3 |
| **5.6.7** Buying a planned item clears it | Given a checklist item is also in Planned items, when the shopper ticks it as bought, then it is removed from Planned items. | 3 |
| **5.6.8** Planned items move into the new checklist | Given the shopper started the trip with "Plan trip with selected items", when they press "Save plan", then the selected items still in the basket and any selected manual items are added to the checklist and removed from Planned items. | 5 |
| **5.6.9** Planned items on the checklist screens | Given the shopper has planned items, when they open Checklist, then the Planned items list is shown below it with tick boxes and "Plan trip with selected items". | 3 |
| **5.6.10** No automatic carry-over | Given a checklist has "Not bought" items that were not scheduled, when the shopper records the trip, then those items are not added to Planned items. | 3 |
| **5.6.11** Nothing planned on the empty checklist | Given the shopper has no planned items and no active checklist, when they open Checklist, then the Planned items list explains how to schedule an item. | 3 |

## US 5.7 Export a shopping checklist

Card [2512848248](https://monashie.leankit.com/card/2512848248) · size 8 · COULD

As a household shopper, I want to download my checklist as an image or PDF, so that I can keep a copy on my phone or use it while shopping.

**Implementation** — frontend: [`checklist-export.ts`](../../frontend/lib/checklist-export.ts), [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx); backend/data: —.

**Tests** — [`checklist-export.test.ts`](../../frontend/lib/checklist-export.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.7.1** Export options | Given the checklist has items, when the shopper presses "Export checklist", then an "Export checklist" window opens with image, PDF and cancel buttons. | 1 |
| **5.7.2** Export contents | Given the shopper downloads the checklist, when they open the file, then it shows the store, date and every item with its pack size, quantity, status and price, with manual items marked. | 3 |
| **5.7.3** Current state and privacy | Given the shopper has just changed the checklist, when they export it, then the file shows the latest changes and contains no starting location or other hidden details. | 3 |
| **5.7.4** Readable export | Given the shopper exports the checklist, when they open the file, then long item names are shown in full and the text is in the app's current language. | 3 |
| **5.7.5** Export fails | Given the "Export checklist" window is open, when a download fails, then an error message appears in the window and the checklist is unchanged. | 1 |
| **5.7.6** Download as image | Given the "Export checklist" window is open, when the shopper presses the image button, then a picture of the checklist is downloaded and the window closes. | 5 |
| **5.7.7** Download as PDF | Given the "Export checklist" window is open, when the shopper presses the PDF button, then the browser's print window opens with the checklist, ready to save as PDF. | 5 |
| **5.7.8** Close export | Given the "Export checklist" window is open, when the shopper presses the cancel (×) button or Escape, then the window closes without downloading. | 1 |

## US 5.8 Record the travel costs of my trip

Card [2529697188](https://monashie.leankit.com/card/2529697188) · size 5

As a household shopper, I want to see my trip's travel costs and add the tolls I actually paid, so that my trip record shows the full cost of shopping.

**Implementation** — frontend: [`trip-travel-cost.ts`](../../frontend/lib/trip-travel-cost.ts), [`travel-cost-breakdown.tsx`](../../frontend/components/travel-cost-breakdown.tsx), [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx) (toll entry); backend/data: —.

**Tests** — [`travel-cost-breakdown.test.tsx`](../../frontend/lib/travel-cost-breakdown.test.tsx), [`checklist-snapshots.test.ts`](../../frontend/lib/checklist-snapshots.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.8.1** Travel and total cost panel | Given the checklist is open, when the shopper views "Travel and total cost", then it shows the travel estimate, a "Tolls" box and the trip total. | 3 |
| **5.8.2** Enter tolls | Given the checklist is open, when the shopper types a toll amount in the "Tolls" box, then the travel and trip totals include it. | 3 |
| **5.8.3** Invalid toll | Given the checklist is open, when the shopper types an invalid toll amount, then an error message appears and "Record shopping trip" is disabled. | 3 |
| **5.8.4** Tolls saved with the trip | Given the shopper entered tolls, when they press "Record shopping trip" and confirm, then that trip in Shopping history includes the recorded tolls. | 3 |

## US 5.9 Check a checklist item's details

Card [2530713452](https://monashie.leankit.com/card/2530713452) · size 5

As a household shopper, I want to open an item's details from my checklist, so that I can check its nutrition and price trends while shopping.

**Implementation** — frontend: [`item-details-dialog.tsx`](../../frontend/components/item-details-dialog.tsx), [`shopping-checklist.tsx`](../../frontend/components/shopping-checklist.tsx) (ChecklistRow); backend/data: [`api.py`](../../backend/smartcart/api.py) (/items/lookup).

**Tests** — [`shopping-checklist.test.tsx`](../../frontend/components/shopping-checklist.test.tsx), [`catalogue-item-dialog.test.tsx`](../../frontend/components/catalogue-item-dialog.test.tsx).

| AC | Criterion | Size |
| --- | --- | --- |
| **5.9.1** Open details from the checklist | Given an item from the store plan is on the checklist, when the shopper presses its name, then the item details window opens with the item's details, nutrition and the price-trends button. | 3 |
| **5.9.2** Checklist details do not change the checklist | Given the item details window was opened from the checklist, when the shopper closes it, then the checklist line, ticks and totals are unchanged and no "Add to basket" button was offered. | 1 |
| **5.9.3** No details for manual checklist items | Given a manually added item is on the checklist, when the shopper looks at its name, then it cannot be pressed. | 1 |
