# Epic 7 — Healthier alternatives and nutrition insights

> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2527217263](https://monashie.leankit.com/card/2527217263) |
| Size | 8 |
| Planned window | 2026-10-06 → 2026-10-13 |
| Assigned | Zhihao Zhao |
| Stories / ACs | 4 / 32 |

As a household shopper, I want to see an item's nutrition information, explore curated healthier alternatives and understand their nutritional differences, so that I can make an informed choice when adding items to my basket.

"Why this alternative?" opens a side panel next to the item details, not an inline section.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [7.1](#us-71-view-healthier-alternatives) | View healthier alternatives | — | 5 | 5 | Zhihao Zhao |
| [7.2](#us-72-explore-and-add-an-alternative) | Explore and add an alternative | — | 5 | 5 | Zhihao Zhao |
| [7.3](#us-73-understand-why-an-alternative-is-recommended) | Understand why an alternative is recommended | — | 10 | 16 | Zhihao Zhao |
| [7.4](#us-74-view-an-items-nutrition-information) | View an item's nutrition information | — | 5 | 6 | Shunnosuke Takei |

## US 7.1 View healthier alternatives

Card [2527217098](https://monashie.leankit.com/card/2527217098) · size 5

As a household shopper, I want to see curated healthier alternatives below an item's details, so that I can consider suitable alternatives while browsing the catalogue.

**Implementation** — frontend: [`healthier-alternatives.tsx`](../../frontend/components/healthier-alternatives.tsx), [`nutrition.ts`](../../frontend/lib/nutrition.ts), [`api.ts`](../../frontend/lib/api.ts) (fetchHealthierAlternatives); backend/data: [`nutrition.py`](../../backend/smartcart/nutrition.py) (healthier_alternatives), [`mappings.json`](../../backend/data/nutrition/mappings.json).

**Tests** — [`test_healthier_alternatives.py`](../../backend/tests/test_healthier_alternatives.py), [`test_nutrition.py`](../../backend/tests/test_nutrition.py), [`healthier-alternatives.test.tsx`](../../frontend/components/healthier-alternatives.test.tsx), [`nutrition.test.ts`](../../frontend/lib/nutrition.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **7.1.1** Display mapped alternatives | Given an item has reviewed healthier alternatives, when the shopper opens its item details, then a "Healthier alternatives" section with small cards appears below the item details. | 5 |
| **7.1.2** Alternative card | Given the "Healthier alternatives" section is shown, when the shopper views a card, then it shows the alternative's picture, name and a short reason (for example "Lower sugar"). | 3 |
| **7.1.3** Only reviewed alternatives | Given the shopper opens an item's details, when alternatives are shown, then only catalogue items that the team reviewed as healthier for that item, with a supported nutrition comparison, are listed. | 8 |
| **7.1.4** No healthier alternatives | Given an item has no reviewed alternatives, when the shopper opens its details, then no "Healthier alternatives" section is shown and the item controls work normally. | 1 |
| **7.1.5** Alternatives cannot load | Given the shopper opens an item's details, when its alternatives cannot be loaded, then the "Healthier alternatives" section is not shown and the other item controls work normally. | 1 |

## US 7.2 Explore and add an alternative

Card [2527215614](https://monashie.leankit.com/card/2527215614) · size 5

As a household shopper, I want to open a suggested alternative and return to the original item, so that I can compare options before choosing what to add.

**Implementation** — frontend: [`catalogue-item-dialog.tsx`](../../frontend/components/catalogue-item-dialog.tsx), [`item-stack.ts`](../../frontend/lib/item-stack.ts); backend/data: —.

**Tests** — [`item-stack.test.ts`](../../frontend/lib/item-stack.test.ts), [`catalogue-item-dialog.test.tsx`](../../frontend/components/catalogue-item-dialog.test.tsx).

| AC | Criterion | Size |
| --- | --- | --- |
| **7.2.1** Open alternative details | Given a suggested alternative card is displayed, when the shopper selects its picture or name, then the alternative's details open in the same window with its own quantity selector and "Add to basket" button, and the basket remains unchanged. | 5 |
| **7.2.2** Return to the previous item | Given the shopper opened an alternative from a previous item, When the shopper selects the visible Back to [previous item] button, Then the previous item is restored with its unsubmitted quantity selection. | 3 |
| **7.2.3** Support further exploration | Given the shopper has explored further alternatives from the current item, When the shopper uses Back, Then the view returns one level through the visited items, allowing repeated Back actions to reach the original item. | 3 |
| **7.2.4** Add only the selected item | Given the item details window shows an original or alternative item with a valid quantity, when the shopper presses "Add to basket", then only that item is added using the normal basket rules, the original is not removed or replaced, and the window closes. | 3 |
| **7.2.5** Same controls for alternatives | Given the shopper is viewing an alternative's details, when they use its quantity, "Add to basket", price-trends or "Schedule purchase" controls, then they behave exactly as for any other item (Epics 1 and 4). | 3 |

## US 7.3 Understand why an alternative is recommended

Card [2527216879](https://monashie.leankit.com/card/2527216879) · size 10

As a household shopper, I want to inspect the nutritional differences between an item and its recommended alternative, so that I can understand the recommendation before deciding what to add.

**Implementation** — frontend: [`healthier-alternatives.tsx`](../../frontend/components/healthier-alternatives.tsx), [`nutrition.ts`](../../frontend/lib/nutrition.ts); backend/data: [`nutrition.py`](../../backend/smartcart/nutrition.py), [`nutrition_comparison.py`](../../backend/smartcart/nutrition_comparison.py), [`comparison_policy.json`](../../backend/data/nutrition/comparison_policy.json).

**Tests** — [`test_nutrition_comparison.py`](../../backend/tests/test_nutrition_comparison.py), [`test_alternative_item_nutrition.py`](../../backend/tests/test_alternative_item_nutrition.py), [`healthier-alternatives.test.tsx`](../../frontend/components/healthier-alternatives.test.tsx).

| AC | Criterion | Size |
| --- | --- | --- |
| **7.3.1** Separate "Why" button | Given an alternative card is shown, when the shopper looks at it, then it has a separate "Why this alternative?" (lightbulb) button. | 3 |
| **7.3.2** Open the comparison | Given an alternative card is shown, when the shopper presses its "Why this alternative?" button, then a comparison panel opens beside the item details without changing the item, quantity or basket. | 5 |
| **7.3.3** Identify both items | Given the "Why this alternative?" panel is open, when the shopper reads it, then it names both items, gives the reason, and compares the key nutrient for each. | 5 |
| **7.3.4** Compare nutrients on the same basis | Given the "Why this alternative?" panel is open, when the shopper reads it, then both items are compared per 100 g (or per 100 mL) with units shown. | 5 |
| **7.3.5** Nutrition sources | Given the "Why this alternative?" panel is open, when the shopper expands "Usage & sources", then it names the nutrition data source for both items. | 3 |
| **7.3.6** Show trade-offs | Given the alternative is worse on another nutrient, when the panel is shown, then that trade-off is shown as well. | 5 |
| **7.3.7** Switch the comparison | Given the "Why this alternative?" panel is open for one alternative, when the shopper presses the lightbulb on another alternative, then the panel updates to compare the original item with the newly selected alternative. | 3 |
| **7.3.8** Close insights | Given the "Why this alternative?" panel is open, when the shopper presses its "×" button, then the panel closes and the item, quantity and basket are unchanged. | 1 |
| **7.3.9** Incompatible measurements | Given a nutrient cannot be compared fairly between the two items, when the panel is shown, then that value reads "Non-comparable". | 3 |
| **7.3.10** Generic food disclosure | Given either item's nutrition comes from a generic food, when the panel is shown, then a note says the values are generic references. | 1 |
| **7.3.11** Missing nutrition values | Given a nutrient value is missing, when the panel is shown, then that value reads "Unavailable" and is never shown as zero. | 3 |
| **7.3.12** No comparable values | Given none of the nutrients can be compared, when the panel is shown, then a message says no comparable values are available. | 1 |
| **7.3.13** Usage notes | Given the "Why this alternative?" panel is open, when the shopper expands "Usage & sources", then it shows what the alternative suits and a usage note. | 3 |
| **7.3.14** One side panel at a time | Given the "Price trends" panel is open, when the shopper presses an alternative's lightbulb button, then price trends closes and the "Why this alternative?" panel opens. | 3 |
| **7.3.15** Price trends replaces the comparison | Given the "Why this alternative?" panel is open, when the shopper presses the price-trends button, then the "Why" panel closes and "Price trends" opens. | 3 |
| **7.3.16** Missing secondary comparisons | Given some secondary nutrient checks are unavailable, when the shopper expands "Usage & sources", then a note says so. | 1 |

## US 7.4 View an item's nutrition information

Card [2529698678](https://monashie.leankit.com/card/2529698678) · size 5

As a household shopper, I want to see the nutrition values of any item I am looking at, so that I can judge how healthy it is even when no alternative is suggested.

**Implementation** — frontend: [`item-nutrition.tsx`](../../frontend/components/item-nutrition.tsx), [`api.ts`](../../frontend/lib/api.ts) (fetchItemNutrition); backend/data: [`item_nutrition.py`](../../backend/smartcart/item_nutrition.py), [`nutrition_repository.py`](../../backend/smartcart/nutrition_repository.py).

**Tests** — [`test_item_nutrition.py`](../../backend/tests/test_item_nutrition.py), [`test_item_nutrition_coverage.py`](../../backend/tests/test_item_nutrition_coverage.py), [`test_nutrition_repository.py`](../../backend/tests/test_nutrition_repository.py), [`item-nutrition.test.tsx`](../../frontend/components/item-nutrition.test.tsx), [`test_import_nutrition.py`](../../database/tests/test_import_nutrition.py), [`test_import_usda.py`](../../data/nutrition/scripts/test_import_usda.py), [`test_import_fndds.py`](../../data/nutrition/scripts/test_import_fndds.py), [`test_import_singapore.py`](../../data/nutrition/scripts/test_import_singapore.py), [`test_map_ingredient_nutrition.py`](../../data/nutrition/scripts/test_map_ingredient_nutrition.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **7.4.1** Nutrition information | Given the item details window is open, when the shopper expands "Nutrition information", then it lists the item's nutrient values per 100 g (or 100 mL), showing "-" for any missing value. | 8 |
| **7.4.2** Generic food reference | Given the item's nutrition is from a generic food, when the shopper expands "Nutrition information", then a note says the values come from a generic food reference. | 1 |
| **7.4.3** Nutrition source | Given nutrition information is shown, when the shopper reads below the values, then the reference food and data source are shown with links. | 3 |
| **7.4.4** No nutrition match | Given the item has no reviewed nutrition match, when the shopper expands "Nutrition information", then a message says no match is available. | 1 |
| **7.4.5** Nutrition cannot load | Given the shopper expands "Nutrition information", when it cannot be loaded, then a message says it is unavailable and the item controls still work. | 1 |
| **7.4.6** Loading nutrition | Given the shopper has just opened an item, when its nutrition is still loading, then "Nutrition information" shows a loading message. | 1 |
