# Epic 8 — Personalised shopping progress report

> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2516753852](https://monashie.leankit.com/card/2516753852) |
| Size | 10 |
| Planned window | 2026-09-08 → 2026-09-18 |
| Assigned | Chenglong Meng |
| Stories / ACs | 5 / 43 |

As a SmartCart user, I want a weekly or monthly statistics dashboard and personalised shopping reports about my spending, trips and estimated savings, so that I can understand my recent shopping decisions and what to do next time.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [8.1](#us-81-see-my-weekly-or-monthly-spending-summary) | See my weekly or monthly spending summary | MUST | 8 | 11 | Chenglong Meng |
| [8.2](#us-82-understand-estimated-savings-from-smartcart) | Understand estimated savings from SmartCart | MUST | 8 | 7 | Chenglong Meng |
| [8.3](#us-83-compare-weekly-or-monthly-progress) | Compare weekly or monthly progress | MUST | 3 | 2 | Chenglong Meng |
| [8.5](#us-85-read-personalised-shopping-reports) | Read personalised shopping reports | — | 10 | 17 | Shunnosuke Takei |
| [8.6](#us-86-control-ai-report-privacy) | Control AI report privacy | — | 5 | 6 | Shunnosuke Takei |

## US 8.1 See my weekly or monthly spending summary

Card [2512848530](https://monashie.leankit.com/card/2512848530) · size 8 · MUST

As a SmartCart user, I want a statistics dashboard of what I spent, how often I shopped and on what, for any week or month, so that I know where my money went.

**Implementation** — frontend: [`statistics-panel.tsx`](../../frontend/components/statistics-panel.tsx), [`period-analytics.ts`](../../frontend/lib/period-analytics.ts), [`statistics-view.ts`](../../frontend/lib/statistics-view.ts); backend/data: [`period_analytics.py`](../../backend/smartcart/period_analytics.py).

**Tests** — [`statistics-view.test.ts`](../../frontend/lib/statistics-view.test.ts), [`test_period_analytics.py`](../../backend/tests/test_period_analytics.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **8.1.1** Period spending and trips | Given the shopper has recorded trips, when they open Reports, press "Statistics" and choose "Weekly" or "Monthly", then tiles show the amount spent, number of trips and average per trip for the current period. | 5 |
| **8.1.2** Estimates stay estimates | Given the Statistics tab is open, when the shopper expands "About these statistics", then it explains what spending includes and that savings are estimates. | 3 |
| **8.1.3** No trips in the period | Given the chosen period has no trips, when the Statistics tab shows it, then the tiles show no amounts and the cards say no trips were recorded in that period. | 3 |
| **8.1.4** Partial or unpriced spending | Given some bought items in the chosen period have no price, when the shopper views the spending tile, then the amount is labelled as partial. | 1 |
| **8.1.5** Move between periods | Given the Statistics tab is open, when the shopper presses the previous or next arrow, then the dashboard shows the previous or next week or month. | 3 |
| **8.1.6** Spending trend | Given the Statistics tab is open, when the shopper views "Spending trend", then a chart shows spending for recent periods, and hovering a bar shows its amount and number of trips. | 5 |
| **8.1.7** Spending by category | Given the chosen period has priced bought items, when the shopper views "Spending by category", then each category shows its amount, share and change from the previous period. | 5 |
| **8.1.8** Top items | Given the chosen period has priced bought items, when the shopper views "Top items", then the items with the largest spending are listed with their quantity, amount and share. | 3 |
| **8.1.9** Remember weekly or monthly | Given the shopper chose "Weekly" or "Monthly", when they reopen Reports on the same device, then the same choice is selected. | 1 |
| **8.1.10** No priced items in the period | Given the chosen period has trips but no priced bought items, when the shopper views the Statistics tab, then spending shows "—" rather than RM0.00 and the category and top-item cards say there are no priced items. | 3 |
| **8.1.11** Arrow limits | Given the dashboard shows the current period, when the shopper looks at the arrows, then the next arrow is disabled. | 1 |

## US 8.2 Understand estimated savings from SmartCart

Card [2516754228](https://monashie.leankit.com/card/2516754228) · size 8 · MUST

As a SmartCart user, I want to understand how my store choice and applied item changes affect the estimated cost of my plan, so that I can compare options without mistaking an estimate for money I have already saved.

**Implementation** — frontend: [`estimated-savings.ts`](../../frontend/lib/estimated-savings.ts), [`estimated-savings-summary.tsx`](../../frontend/components/estimated-savings-summary.tsx); backend/data: —.

**Tests** — [`estimated-savings.test.ts`](../../frontend/lib/estimated-savings.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **8.2.1** Estimated savings on a plan | Given at least two listed options price the same basket, when the shopper opens a store's or two-store plan's details, then the "Estimated savings" card shows how much less or more this plan costs than the median plan, including travel. | 8 |
| **8.2.2** Item changes | Given a median comparison exists and the shopper has swapped items that lower the cost, when they view "Estimated savings", then an "Item changes" row shows the reduction and it is counted once in the total. | 5 |
| **8.2.3** Plan choice and labels | Given the "Estimated savings" card has a comparison, when the shopper reads it, then a "Plan choice" row shows the amount from choosing this plan and every amount is labelled as estimated. | 1 |
| **8.2.4** No comparison yet | Given fewer than two comparable options exist and no item has been swapped, when the shopper views "Estimated savings", then it says a comparison is not available yet. | 1 |
| **8.2.5** Savings in statistics | Given trips in the chosen period saved a store comparison, when the shopper views the Statistics tab, then the "Estimated savings" tile shows the total compared with the typical recommended store, and "Savings breakdown" splits it into store choice and item swaps. | 5 |
| **8.2.6** No saved comparison | Given no trip in the chosen period saved a store comparison, when the shopper views the Statistics tab, then the savings tile and breakdown say no comparison was saved. | 3 |
| **8.2.7** Item changes without a median | Given no median comparison exists and the shopper has swapped items, when they view "Estimated savings", then it shows how much the item changes reduced or added to the basket. | 3 |

## US 8.3 Compare weekly or monthly progress

Card [2518229276](https://monashie.leankit.com/card/2518229276) · size 3 · MUST

As a SmartCart user, I want to compare my current week or month with the previous one, so that I can understand how my shopping activity has changed.

**Implementation** — frontend: [`statistics-view.ts`](../../frontend/lib/statistics-view.ts), [`statistics-panel.tsx`](../../frontend/components/statistics-panel.tsx); backend/data: —.

**Tests** — [`statistics-view.test.ts`](../../frontend/lib/statistics-view.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **8.3.1** Compare with the previous period | Given both the chosen and previous period have trips, when the shopper views the Statistics tiles, then spending, trips and average per trip each show their change from the previous period. | 5 |
| **8.3.2** No previous period | Given the previous period has no trips, when the shopper views the Statistics tiles, then they say there are no earlier trips to compare. | 3 |

## US 8.5 Read personalised shopping reports

Card [2529699835](https://monashie.leankit.com/card/2529699835) · size 10

As a SmartCart user, I want short personalised reports about each week or month, so that I can see what stood out in my shopping and get ideas for next time.

**Implementation** — frontend: [`report-screens.tsx`](../../frontend/components/report-screens.tsx), [`report-generation.ts`](../../frontend/lib/report-generation.ts), [`inbox.ts`](../../frontend/lib/inbox.ts), [`report-language.ts`](../../frontend/lib/report-language.ts); backend/data: [`reporting.py`](../../backend/smartcart/reporting.py), [`report_insights.py`](../../backend/smartcart/report_insights.py), [`cerebras_narrator.py`](../../backend/smartcart/cerebras_narrator.py), [`report_models.py`](../../backend/smartcart/report_models.py).

**Tests** — [`test_report_insights.py`](../../backend/tests/test_report_insights.py), [`test_report_story.py`](../../backend/tests/test_report_story.py), [`test_cerebras_narrator.py`](../../backend/tests/test_cerebras_narrator.py), [`test_report_api.py`](../../backend/tests/test_report_api.py), [`report-generation.test.ts`](../../frontend/lib/report-generation.test.ts), [`report-screens.test.ts`](../../frontend/components/report-screens.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **8.5.1** Generate menu | Given the shopper is on the Reports "Inbox" tab, when they press "Generate", then a menu offers a report language, "Weekly report" and "Monthly report" with their dates, and any period without trips cannot be chosen. | 1 |
| **8.5.2** Generate a report | Given AI reports are enabled, when the shopper chooses "Weekly report" or "Monthly report" in the Generate menu, then a generating message appears and the finished report is added to the inbox as "Unread". | 10 |
| **8.5.3** Report fails | Given a report is being generated, when it cannot be created or saved, then the card says the report failed, with a "Retry" button. | 1 |
| **8.5.4** AI reports turned off | Given AI reports are not enabled, when the shopper chooses a report in the Generate menu, then the privacy settings window opens, and after pressing "Enable AI reports" the report is generated. | 3 |
| **8.5.5** Read a report | Given the inbox has a report, when the shopper selects it, then the report opens with its headline, insight cards with tips and key numbers, and it is marked as read. | 5 |
| **8.5.6** The numbers | Given a report is open, when the shopper reads "The numbers", then it shows spending, trips and estimated savings compared with the previous period, and the top categories. | 3 |
| **8.5.7** What reports point out | Given the shopper has recorded trips in and before the report period, when a report is generated, then its insight cards point out notable changes, such as spending above usual, price changes on regular items, items probably due, cheaper stores and ways to save on travel. | 10 |
| **8.5.8** AI-written note | Given a report was written with AI, when the shopper reads its notes, then a note says it was written with AI and every figure comes from their own records. | 1 |
| **8.5.9** Report language | Given the shopper picks "English" or "Bahasa Melayu" under "Report language", when they generate a report, then it is written in that language. | 3 |
| **8.5.11** Empty inbox | Given no reports exist, when the shopper opens the Inbox tab, then a message says there are no reports yet and suggests using "Generate". | 1 |
| **8.5.12** Automatic reports | Given AI reports are enabled and the last completed week or month has trips but no report, when the shopper opens SmartCart, then that report is created automatically and appears in the inbox as unread. | 5 |
| **8.5.13** AI-off shortcut in the menu | Given AI reports are not enabled, when the shopper opens the Generate menu and presses the link to turn on AI reports, then the privacy settings window opens. | 3 |
| **8.5.14** Little history | Given the shopper has few earlier trips, when a report is generated, then it includes a card saying the report will become more personal as more trips are recorded. | 3 |
| **8.5.15** Report language remembered | Given the shopper picked a report language, when they reopen SmartCart and generate another report, then the same report language is used. | 3 |
| **8.5.16** Report language follows the app by default | Given the shopper never picked a report language, when they generate a report, then it is written in the app's current language. | 3 |
| **8.5.17** Inbox list | Given reports exist, when the shopper opens the Inbox tab, then each report is listed with its type, dates, a preview and whether it is unread. | 3 |
| **8.5.18** Nothing selected | Given the shopper is on the Inbox tab, when no report is selected, then the reading area asks them to select a report. | 1 |

## US 8.6 Control AI report privacy

Card [2529700054](https://monashie.leankit.com/card/2529700054) · size 5

As a SmartCart user, I want to decide whether my trip data is used to write reports and to delete my reports, so that my shopping information stays under my control.

**Implementation** — frontend: [`report-consent.ts`](../../frontend/lib/report-consent.ts), [`report-screens.tsx`](../../frontend/components/report-screens.tsx) (consent dialog), [`inbox.ts`](../../frontend/lib/inbox.ts); backend/data: —.

**Tests** — [`report-consent.test.ts`](../../frontend/lib/report-consent.test.ts), [`report-screens.test.ts`](../../frontend/components/report-screens.test.ts), [`test_report_api.py`](../../backend/tests/test_report_api.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **8.6.1** Asked before the first report | Given the shopper has never chosen an AI report setting and a completed week or month has trips, when they open SmartCart, then the AI report privacy window opens explaining what is shared, with "Enable AI reports" and "No thanks". | 3 |
| **8.6.2** Decline AI reports | Given the privacy window is open, when the shopper presses "No thanks", then the window closes and no report is created. | 3 |
| **8.6.3** Open report settings | Given the shopper is on Reports, when they press "Report settings", then the privacy window opens with the option to enable or disable AI reports and "Delete all reports". | 3 |
| **8.6.4** Disable AI reports | Given AI reports are enabled, when the shopper presses "Disable AI reports", then no new reports are requested and existing reports stay in the inbox. | 3 |
| **8.6.5** Delete all reports | Given the shopper has reports, when they press "Delete all reports" and confirm, then all reports are removed and shopping history is unchanged. | 3 |
| **8.6.6** Setting cannot be saved | Given the shopper changes the AI report setting, when it cannot be saved on the device, then a message says the setting could not be saved and no report request was sent. | 1 |
