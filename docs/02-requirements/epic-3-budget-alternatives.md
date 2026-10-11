# Epic 3 — Smart budget alternatives

> Mirrors the LeanKit board after the 11 October 2026 US/AC revision. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2495221757](https://monashie.leankit.com/card/2495221757) |
| Size | 8 |
| Planned window | 2026-08-26 → 2026-09-01 |
| Assigned | Zhihao Zhao, Chenglong Meng, Shunnosuke Takei |
| Stories / ACs | 3 / 21 |

As a household shopper with limited disposable income, I want the system to suggest cheaper alternatives or smaller pack sizes for items in my basket, so that I can still afford essentials without overspending and keep money aside for savings or emergencies.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [3.1](#us-31-identify-cheaper-equivalents) | Identify Cheaper Equivalents | REFINED | 5 | 6 | Shunnosuke Takei |
| [3.2](#us-32-compare-pack-size-value) | Compare Pack-Size Value | REFINED | 5 | 6 | Zhihao Zhao |
| [3.3](#us-33-apply-an-alternative) | Apply an Alternative | REFINED | 8 | 9 | Shunnosuke Takei |

## US 3.1 Identify Cheaper Equivalents

Card [2510515108](https://monashie.leankit.com/card/2510515108) · size 5 · REFINED

As a household shopper comparing my basket at one selected store, I want to see cheaper close equivalents for basket items, so I can reduce my upfront cost without changing stores.

**Implementation** — frontend: [`recommendation-basket-row.tsx`](../../frontend/components/recommendation-basket-row.tsx), [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (RecommendationOverview); backend/data: [`alternatives.py`](../../backend/smartcart/alternatives.py).

**Tests** — [`test_alternatives.py`](../../backend/tests/test_alternatives.py), [`recommendation-basket-row.test.tsx`](../../frontend/components/recommendation-basket-row.test.tsx), [`test_seed_demo_alternatives.py`](../../database/tests/test_seed_demo_alternatives.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **3.1.1** Valid cheaper equivalent | Given an item on the store details page has a cheaper similar item at the same store, when the shopper presses the item's ⌄ button, then an options panel shows the cheaper item. | 8 |
| **3.1.2** Cheaper equivalent details | Given the options panel shows a cheaper item, when the shopper reads it, then it shows the item's details, price, the saving and a "Swap & save" button. | 3 |
| **3.1.3** No cheaper equivalent | Given an item has no cheaper item and no other pack size, when the store details page opens, then that item has no ⌄ button. | 3 |
| **3.1.4** Alternatives cannot load | Given the store details page is open, when cheaper alternatives cannot be loaded, then a message says they are unavailable and the basket is unchanged. | 1 |
| **3.1.5** Loading alternatives | Given the store details page has just opened, when alternatives are still loading, then a loading message is shown and "Save plan" is disabled. | 1 |
| **3.1.6** No swaps against estimated prices | Given an item's price at the store is only an estimate, when the store details page opens, then no cheaper item or pack size is suggested for it. | 3 |

## US 3.2 Compare Pack-Size Value

Card [2510516021](https://monashie.leankit.com/card/2510516021) · size 5 · REFINED

As a household shopper comparing one basket item at a selected store, I want to compare compatible pack sizes by upfront price and unit value, so I can choose what suits my available cash and longer-term value.

**Implementation** — frontend: [`recommendation-basket-row.tsx`](../../frontend/components/recommendation-basket-row.tsx); backend/data: [`pack_ratios.py`](../../backend/smartcart/pack_ratios.py), [`migrate_pack_quantities.py`](../../database/migrate_pack_quantities.py).

**Tests** — [`test_pack_ratios.py`](../../backend/tests/test_pack_ratios.py), [`test_migrate_pack_quantities.py`](../../database/tests/test_migrate_pack_quantities.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **3.2.1** Compare compatible pack sizes | Given the store sells at least two priced pack sizes of the same product, when the shopper opens the item's options and presses "Compare [N] pack sizes", then all pack sizes are listed, best price per kg or litre first. | 5 |
| **3.2.2** Pack comparison fields | Given the pack sizes are listed, when the shopper reads an option, then it shows the pack's details, price and price per kg or litre, with the pack in the basket marked "Selected". | 3 |
| **3.2.3** Best unit value | Given the shopper presses "Compare [N] pack sizes", when the pack sizes are listed, then the pack with the lowest price per kg or litre is marked "Best unit value". | 5 |
| **3.2.5** Upfront trade-off | Given the pack sizes are listed, when the shopper reads a pack other than "Selected", then it shows whether that pack costs more, less or the same now for the chosen quantity. | 3 |
| **3.2.6** No pack comparison | Given the store sells only one priced pack size of an item, when the shopper opens that item's options, then no pack comparison is shown. | 1 |
| **3.2.7** Best value in the collapsed heading | Given an item's options panel is open, when the shopper reads the "Compare [N] pack sizes" heading, then it names the best-value pack or says the current pack is already the best value. | 1 |

## US 3.3 Apply an Alternative

Card [2510515458](https://monashie.leankit.com/card/2510515458) · size 8 · REFINED

As a household shopper, I want to apply a cheaper equivalent or pack-size choice to my basket, so my basket reflects my preferred cost option.

**Implementation** — frontend: [`basket-state.ts`](../../frontend/lib/basket-state.ts) (replacement), [`recommendation-detail.ts`](../../frontend/lib/recommendation-detail.ts), [`recommendation-basket-row.tsx`](../../frontend/components/recommendation-basket-row.tsx); backend/data: —.

**Tests** — [`basket-state.test.ts`](../../frontend/lib/basket-state.test.ts), [`recommendation-detail.test.ts`](../../frontend/lib/recommendation-detail.test.ts), [`basket-lines.test.ts`](../../frontend/lib/basket-lines.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **3.3.1** Apply immediately | Given a cheaper item or another pack size is shown, when the shopper presses "Swap & save" or "Select pack", then that item replaces the original in the basket and on the store details page immediately. | 5 |
| **3.3.2** Keep quantity and other lines | Given a basket item has quantity Q, when the shopper swaps it, then the replacement keeps quantity Q and every other basket item is unchanged. | 3 |
| **3.3.3** Totals update without reloading | Given the shopper has just swapped an item, when the store details page updates, then the item and all totals update without reloading the page. | 1 |
| **3.3.4** Show a swapped item | Given an item has been swapped, when the shopper views it on the store details page, then it is labelled "Swapped" or "Pack changed" with the original item's name, and its options panel shows the cost change and an "Undo swap" button. | 1 |
| **3.3.5** Undo a swap | Given an item has been swapped, when the shopper presses "Undo swap" on the store details page or on the "Review your basket" screen, then the original item and quantity return and the totals go back to their earlier values. | 5 |
| **3.3.6** Prevent duplicate basket items | Given a suggested item is already in the basket, when the shopper views the suggestion, then its button reads "Already in basket" and cannot be pressed. | 1 |
| **3.3.7** Truthful SARA status | Given a suggested item's SARA status differs from the original item, when the suggestion is shown, then it shows its own SARA label, not the original item's. | 3 |
| **3.3.8** Swapped item in basket review | Given an item was swapped on the store details page, when the shopper opens "Review your basket", then the line is labelled "Swapped" or "Pack changed" with the original item's name and an "Undo swap" button. | 1 |
| **3.3.9** Cost change unavailable | Given an item has been swapped but a comparison price is missing, when the shopper opens its options panel, then it says the cost change is unavailable. | 1 |
