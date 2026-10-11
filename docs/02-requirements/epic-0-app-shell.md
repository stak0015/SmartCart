# Epic 0 — App shell, home and navigation

> Mirrors the LeanKit board after the 11 October 2026 US/AC revision. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2529693131](https://monashie.leankit.com/card/2529693131) |
| Size | 8 |
| Planned window | 2026-09-08 → 2026-09-18 |
| Assigned | Shunnosuke Takei |
| Stories / ACs | 3 / 20 |

As a household shopper, I want a clear home screen and consistent navigation, so that I can start, resume and move between my shopping tasks easily.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [0.1](#us-01-move-around-the-app) | Move around the app | — | 8 | 10 | Shunnosuke Takei |
| [0.2](#us-02-use-smartcart-in-my-language) | Use SmartCart in my language | — | 5 | 2 | Shunnosuke Takei |
| [0.3](#us-03-start-or-resume-a-shopping-trip-from-home) | Start or resume a shopping trip from Home | — | 8 | 8 | Shunnosuke Takei |

## US 0.1 Move around the app

Card [2529693224](https://monashie.leankit.com/card/2529693224) · size 8

As a household shopper, I want the same header and step guide on every screen, so that I always know where I am and can reach any part of SmartCart.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (Header), [`shopping-step-nav.tsx`](../../frontend/components/shopping-step-nav.tsx); backend/data: —.

**Tests** — [`shopping-step-nav.test.tsx`](../../frontend/components/shopping-step-nav.test.tsx).

| AC | Criterion | Size |
| --- | --- | --- |
| **0.1.1** Header navigation | Given the shopper is on any screen, when they select Home, Checklist, History or Reports in the header, then that screen opens and its link is marked as the current page. | 3 |
| **0.1.3** Logo returns home | Given the shopper is on any screen, when they select the SmartCart logo in the header, then the Home screen opens. | 3 |
| **0.1.4** Header basket count | Given the shopper adds or removes basket items, when they look at the basket button in the header, then it shows the total number of units in the basket. | 3 |
| **0.1.5** Shopping steps bar | Given the shopper is planning a trip or has an active checklist, when the screen loads, then a steps bar shows the trip steps (Travel, Shop, Basket, Recommendations, Store details, Checklist) with the current step highlighted and earlier steps marked done. | 5 |
| **0.1.6** Steps locked before a location is chosen | Given the shopper has not chosen a starting location, when they open the Travel screen, then only the "Travel" step can be selected in the steps bar. | 3 |
| **0.1.7** Recommendations locked with an empty basket | Given the shopper has chosen a starting location but the basket is empty, when they press "Continue to Shop", then the "Travel", "Shop" and "Basket" steps can be selected and the later steps cannot. | 3 |
| **0.1.8** Jump to an available step | Given a step in the steps bar is available, when the shopper selects it, then that step's screen opens with the current basket and travel preferences unchanged. | 3 |
| **0.1.10** Saved store link without a selected store | Given the shopper opens a saved or shared store details link without having chosen that store in this trip, when the page loads, then SmartCart opens the Recommendations screen instead. | 3 |
| **0.1.11** Header basket button | Given the shopper is on any screen, when they select the basket button in the header, then the "Review your basket" screen opens. | 3 |
| **0.1.12** Checklist step is a marker only | Given the steps bar is shown, when the shopper looks at the "Checklist" step, then it shows their progress but cannot be selected, as the checklist is opened from the header or Home. | 1 |

## US 0.2 Use SmartCart in my language

Card [2529694293](https://monashie.leankit.com/card/2529694293) · size 5

As a Malaysian household shopper, I want to switch SmartCart between English and Bahasa Melayu, so that I can understand every screen in my preferred language.

**Implementation** — frontend: [`i18n.ts`](../../frontend/lib/i18n.ts), [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (LanguageToggle); backend/data: [`translations.py`](../../backend/smartcart/translations.py), [`categories.py`](../../backend/smartcart/categories.py).

**Tests** — [`i18n.test.ts`](../../frontend/lib/i18n.test.ts), [`test_translations.py`](../../backend/tests/test_translations.py), [`test_seed_item_names.py`](../../database/tests/test_seed_item_names.py), [`test_migrate_item_name_en.py`](../../database/tests/test_migrate_item_name_en.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **0.2.1** Switch language | Given SmartCart is shown in one language, when the shopper presses the "EN \| BM" toggle in the header, then all screen text and item names switch to the other language. | 8 |
| **0.2.2** Remember language | Given the shopper has chosen a language, when they close and reopen SmartCart on the same device, then SmartCart opens in that language. | 3 |

## US 0.3 Start or resume a shopping trip from Home

Card [2529693423](https://monashie.leankit.com/card/2529693423) · size 8

As a household shopper, I want Home to show where I am in my shopping, so that I can start a new trip or carry on where I left off.

**Implementation** — frontend: [`journey-screens.tsx`](../../frontend/components/journey-screens.tsx), [`shopping-session.ts`](../../frontend/lib/shopping-session.ts); backend/data: —.

**Tests** — [`shopping-session.test.ts`](../../frontend/lib/shopping-session.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **0.3.1** Home with no trip in progress | Given no trip is in progress, when the shopper presses "Start a shopping trip" on Home, then the Travel screen opens. | 3 |
| **0.3.2** Home with a trip in progress | Given a trip is in progress, when the shopper opens Home, then it shows that a trip is in progress and a "Resume shopping trip" button that reopens the last step reached. | 3 |
| **0.3.3** Ask before starting a new trip | Given a trip is in progress, when the shopper presses "Start a new trip" on Home, then a dialog asks them to confirm that the basket and trip progress will be cleared while the checklist and history are kept. | 3 |
| **0.3.4** Confirm a new trip | Given the "Start a new trip?" dialog is open, when the shopper presses "Start new", then the basket, starting location and selected store are cleared and the Travel screen opens. | 3 |
| **0.3.5** Cancel a new trip | Given the "Start a new trip?" dialog is open, when the shopper presses "Cancel", then the dialog closes and the trip in progress is unchanged. | 1 |
| **0.3.6** Home shortcut cards | Given the shopper opens Home, when the page loads, then the Checklist, Shopping history and Reports cards show the checklist progress, the number of recorded trips and the number of unread reports. | 3 |
| **0.3.7** Resume after closing SmartCart | Given the shopper has a trip in progress, when they close and reopen SmartCart on the same device, then the basket, travel preferences, starting location, last step reached and selected store are restored. | 5 |
| **0.3.8** Open a tool from Home | Given the shopper is on Home, when they select the Checklist, Shopping history or Reports card, then that screen opens. | 3 |
