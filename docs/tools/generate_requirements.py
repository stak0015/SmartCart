"""Generate docs/02-requirements/* and docs/08-evidence/traceability-matrix.md.

Card text, assignees, IDs and sizes come from a LeanKit card export
(live-cards.json, every card on the board). Epic planned windows, and the size
of any card without one on the board, come from the applied revision
(us-ac-revision.md).

Usage, from the repository root:
    python docs/tools/generate_requirements.py [--cards PATH] [--backup PATH] [--revision PATH]

Defaults point at the project workspace one level above the repository.
Owner: Shun
"""
import argparse
import html
import json
import re
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WORK = REPO.parent
_PARSER = argparse.ArgumentParser(description="Generate requirement docs from a LeanKit export.")
_PARSER.add_argument("--cards", type=Path, default=WORK / "leankit-sync" / "live-cards.json")
_PARSER.add_argument("--backup", type=Path, default=WORK / "leankit-sync" / "backup-before-sync.json")
_PARSER.add_argument("--revision", type=Path, default=WORK / "us-ac-revision.md")
ARGS = _PARSER.parse_args()
CARDS = json.loads(ARGS.cards.read_text(encoding="utf-8"))
REVISION = ARGS.revision.read_text(encoding="utf-8")
BOARD = "https://monashie.leankit.com/board/2494576111"

NUM = re.compile(r"^(\d+)\.(\d+)(?:\.(\d+))?R?\s*(?:[-:–—]\s*)?(.+?)\s*$")
TAG = re.compile(r"\s*\[(MUST|SHOULD|COULD|REFINED)\]", re.I)
PARENT = re.compile(r"\s*\[US \d+\.\d+\]\s*$")

EPICS = {
    0: ("epic-0-app-shell.md", "App shell, home and navigation"),
    1: ("epic-1-basket-building.md", "Essential basket building"),
    2: ("epic-2-store-recommendation.md", "Reachable store recommendation"),
    3: ("epic-3-budget-alternatives.md", "Smart budget alternatives"),
    4: ("epic-4-price-history-and-planning.md", "Price history, forecasting and planned items"),
    5: ("epic-5-checklist-and-trips.md", "Shopping checklist and trip tracking"),
    6: ("epic-6-multi-store.md", "Multi-store basket recommendations"),
    7: ("epic-7-nutrition.md", "Healthier alternatives and nutrition insights"),
    8: ("epic-8-reports.md", "Personalised shopping progress report"),
}

# Story -> (frontend, backend/data, tests). Paths are repository-relative.
IMPL = {
    "0.1": (["frontend/components/smartcart-app.tsx (Header, steps bar)", "frontend/components/shopping-step-nav.tsx"], [],
            ["frontend/components/shopping-step-nav.test.tsx"]),
    "0.2": (["frontend/lib/i18n.ts", "frontend/components/smartcart-app.tsx (LanguageToggle)"],
            ["backend/smartcart/translations.py", "backend/smartcart/categories.py"],
            ["frontend/lib/i18n.test.ts", "backend/tests/test_translations.py", "database/tests/test_seed_item_names.py", "database/tests/test_migrate_item_name_en.py"]),
    "0.3": (["frontend/components/journey-screens.tsx", "frontend/lib/shopping-session.ts"], [],
            ["frontend/lib/shopping-session.test.ts"]),
    "1.1": (["frontend/components/smartcart-app.tsx (BasketScreen)", "frontend/lib/api.ts", "frontend/lib/result-row.ts"],
            ["backend/smartcart/api.py (search_items)", "backend/smartcart/catalogue.py", "backend/smartcart/translations.py"],
            ["backend/tests/test_api.py", "backend/tests/test_catalogue_controls.py", "frontend/lib/api.test.ts", "frontend/lib/result-row.test.ts", "database/tests/test_ingest_pricecatcher.py"]),
    "1.2": (["frontend/components/smartcart-app.tsx (category panel)", "frontend/lib/i18n.ts"],
            ["backend/smartcart/categories.py", "backend/smartcart/catalogue.py"],
            ["backend/tests/test_catalogue_controls.py", "frontend/lib/i18n.test.ts"]),
    "1.3": (["frontend/components/catalogue-item-dialog.tsx", "frontend/components/catalogue-item-image.tsx", "frontend/lib/package-size.ts", "frontend/lib/item-name.ts"],
            ["backend/smartcart/catalogue.py (display_package_size)", "backend/smartcart/catalogue_image_manifest.py"],
            ["frontend/components/catalogue-item-dialog.test.tsx", "frontend/lib/package-size.test.ts", "frontend/lib/item-name.test.ts", "frontend/lib/catalogue-image.test.ts"]),
    "1.4": (["frontend/components/quantity-selector.tsx", "frontend/lib/result-row.ts", "frontend/lib/basket-state.ts"], [],
            ["frontend/lib/result-row.test.ts", "frontend/lib/basket-state.test.ts"]),
    "1.5": (["frontend/lib/result-row.ts (upsertBasketLine)", "frontend/components/smartcart-app.tsx (BasketScreen)"], [],
            ["frontend/lib/result-row.test.ts"]),
    "1.6": (["frontend/components/smartcart-app.tsx (BasketScreen)", "frontend/lib/result-row.ts"], [],
            ["frontend/lib/result-row.test.ts", "frontend/components/shopping-step-nav.test.tsx"]),
    "2.1": (["frontend/components/smartcart-app.tsx (LocationScreen)", "frontend/lib/api-client.ts", "frontend/lib/shopping-session.ts"],
            ["backend/smartcart/api.py (/locations/*)", "backend/smartcart/maps.py"],
            ["backend/tests/test_maps.py", "backend/tests/test_api.py", "frontend/lib/api-client.test.ts"]),
    "2.2": (["frontend/components/smartcart-app.tsx (CompareScreen)"],
            ["backend/smartcart/api.py (_recommend_stores)", "backend/smartcart/premises.py", "backend/smartcart/recommendation.py (rank_reachable_stores)", "backend/smartcart/maps.py", "backend/smartcart/route_cache.py"],
            ["backend/tests/test_recommendation.py", "backend/tests/test_premises.py", "backend/tests/test_api.py", "backend/tests/test_route_cache.py", "database/tests/test_migrate_premise_open_status.py", "database/tests/test_migrate_sara_verified.py", "database/tests/test_migrate_sara_chain_partners.py", "database/tests/test_sara_chain_catalog.py"]),
    "2.3": (["frontend/components/smartcart-app.tsx (CompareScreen, StoreCard)", "frontend/lib/visible-stores.ts", "frontend/lib/basket-coverage.ts", "frontend/lib/travel.ts (directions links)"],
            ["backend/smartcart/pricing.py", "backend/smartcart/recommendation.py (apply_basket_pricing)", "backend/smartcart/sara.py"],
            ["backend/tests/test_pricing.py", "backend/tests/test_recommendation.py", "backend/tests/test_sara.py", "frontend/lib/visible-stores.test.ts", "frontend/lib/basket-coverage.test.ts", "frontend/lib/travel.test.ts", "database/tests/test_migrate_median_prices.py", "frontend/lib/basket-lines.test.ts", "frontend/lib/format-rm.test.ts"]),
    "2.4": (["frontend/components/smartcart-app.tsx (RecommendationOverview)", "frontend/lib/recommendation-detail.ts", "frontend/components/travel-cost-breakdown.tsx", "frontend/components/store-basket-row.tsx", "frontend/lib/estimate-label.ts"],
            ["backend/smartcart/fuel.py", "backend/smartcart/recommendation.py (fuel_cost_breakdown)", "backend/smartcart/estimate_ranges.py"],
            ["backend/tests/test_fuel.py", "backend/tests/test_estimate_ranges.py", "frontend/lib/estimate-label.test.ts", "frontend/lib/recommendation-detail.test.ts", "frontend/lib/travel-cost-breakdown.test.tsx"]),
    "2.5": (["frontend/components/nearby-price-status.tsx", "frontend/lib/catalogue-price.ts", "frontend/components/catalogue-item-details.tsx"],
            ["backend/smartcart/api.py (/recommendations/prepare)", "backend/smartcart/catalogue.py (catalogue_price_ranges)"],
            ["backend/tests/test_catalogue_prices.py", "frontend/components/nearby-price-status.test.tsx", "frontend/lib/catalogue-price.test.ts"]),
    "3.1": (["frontend/components/recommendation-basket-row.tsx", "frontend/components/smartcart-app.tsx (RecommendationOverview)"],
            ["backend/smartcart/alternatives.py"],
            ["backend/tests/test_alternatives.py", "frontend/components/recommendation-basket-row.test.tsx", "database/tests/test_seed_demo_alternatives.py"]),
    "3.2": (["frontend/components/recommendation-basket-row.tsx"],
            ["backend/smartcart/pack_ratios.py", "database/migrate_pack_quantities.py"],
            ["backend/tests/test_pack_ratios.py", "database/tests/test_migrate_pack_quantities.py"]),
    "3.3": (["frontend/lib/basket-state.ts (replacement)", "frontend/lib/recommendation-detail.ts", "frontend/components/recommendation-basket-row.tsx"], [],
            ["frontend/lib/basket-state.test.ts", "frontend/lib/recommendation-detail.test.ts", "frontend/lib/basket-lines.test.ts"]),
    "4.1": (["frontend/components/price-history.tsx", "frontend/components/price-series-chart.tsx", "frontend/lib/price-history.ts"],
            ["backend/smartcart/price_history.py", "forecasting/refresh.py", "forecasting/store.py"],
            ["backend/tests/test_price_history.py", "backend/tests/test_forecast_postgres.py", "frontend/lib/price-history.test.ts"]),
    "4.2": (["frontend/lib/price-history.ts (forecastForDisplay, fourWeekForecastSignal)", "frontend/components/price-history.tsx"],
            ["backend/smartcart/forecast_rules.py", "backend/smartcart/price_history.py", "forecasting/model.py", "forecasting/refresh.py"],
            ["backend/tests/test_price_history.py", "backend/tests/test_forecast_postgres.py", "forecasting/tests/test_refresh.py", "frontend/lib/price-history.test.ts"]),
    "4.4": (["frontend/lib/next-trip.ts", "frontend/lib/planned-week.ts", "frontend/components/smartcart-app.tsx (schedule dialog)"], [],
            ["frontend/lib/next-trip.test.ts", "frontend/lib/planned-week.test.ts"]),
    "4.5": (["frontend/components/shopping-checklist.tsx (NextTripList)", "frontend/components/smartcart-app.tsx (Home)", "frontend/lib/planned-week.ts"], [],
            ["frontend/lib/planned-week.test.ts", "frontend/lib/next-trip.test.ts"]),
    "4.6": (["frontend/components/smartcart-app.tsx (planWithSavedItems)", "frontend/lib/next-trip.ts"], [],
            ["frontend/lib/next-trip.test.ts"]),
    "4.8": (["frontend/components/planned-items-panel.tsx", "frontend/components/shopping-checklist.tsx (NextTripList)", "frontend/lib/next-trip.ts (nextTripBasket)"], [],
            ["frontend/components/shopping-checklist.test.tsx", "frontend/lib/next-trip.test.ts"]),
    "4.9": (["frontend/components/item-details-dialog.tsx", "frontend/components/catalogue-item-dialog.tsx", "frontend/components/price-history.tsx"],
            ["backend/smartcart/api.py (/items/lookup)", "backend/smartcart/catalogue.py (get_catalogue_items)"],
            ["frontend/components/shopping-checklist.test.tsx", "frontend/components/catalogue-item-dialog.test.tsx", "backend/tests/test_estimate_ranges.py"]),
    "5.1": (["frontend/components/shopping-checklist.tsx", "frontend/lib/shopping-checklist.ts"], [],
            ["frontend/lib/shopping-checklist.test.ts", "frontend/components/shopping-checklist.test.tsx", "frontend/lib/checklist-snapshots.test.ts"]),
    "5.2": (["frontend/components/shopping-checklist.tsx", "frontend/lib/shopping-checklist.ts"], [],
            ["frontend/lib/shopping-checklist.test.ts"]),
    "5.4": (["frontend/lib/trip-history.ts", "frontend/components/shopping-checklist.tsx"], [],
            ["frontend/lib/trip-history.test.ts"]),
    "5.5": (["frontend/components/shopping-history.tsx", "frontend/lib/trip-history.ts"], [],
            ["frontend/components/shopping-history.test.tsx", "frontend/lib/trip-history.test.ts"]),
    "5.6": (["frontend/lib/next-trip.ts", "frontend/components/shopping-checklist.tsx"], [],
            ["frontend/lib/next-trip.test.ts"]),
    "5.9": (["frontend/components/item-details-dialog.tsx", "frontend/components/shopping-checklist.tsx (ChecklistRow)"],
            ["backend/smartcart/api.py (/items/lookup)"],
            ["frontend/components/shopping-checklist.test.tsx", "frontend/components/catalogue-item-dialog.test.tsx"]),
    "5.7": (["frontend/lib/checklist-export.ts", "frontend/components/shopping-checklist.tsx"], [],
            ["frontend/lib/checklist-export.test.ts"]),
    "5.8": (["frontend/lib/trip-travel-cost.ts", "frontend/components/travel-cost-breakdown.tsx", "frontend/components/shopping-checklist.tsx (toll entry)"], [],
            ["frontend/lib/travel-cost-breakdown.test.tsx", "frontend/lib/checklist-snapshots.test.ts"]),
    "6.1": (["frontend/components/multi-store-panel.tsx", "frontend/lib/multi-store.ts"],
            ["backend/smartcart/models.py (RecommendationRequest.second_store_limit)"],
            ["frontend/components/multi-store-panel.test.tsx", "frontend/lib/multi-store.test.ts", "backend/tests/test_multi_store_api.py"]),
    "6.2": ([], ["backend/smartcart/multi_store.py", "backend/smartcart/api.py (_build_multi_store_plans)", "backend/smartcart/maps.py (compute_route_matrix_multi_origin)", "backend/smartcart/route_cache.py"],
            ["backend/tests/test_multi_store.py", "backend/tests/test_multi_store_api.py", "backend/tests/test_route_cache.py"]),
    "6.3": (["frontend/lib/multi-store.ts (rankedStorePlanOptions)", "frontend/components/plan-comparison.tsx"],
            ["backend/smartcart/multi_store_pricing.py"],
            ["backend/tests/test_multi_store_pricing.py", "frontend/lib/multi-store-options.test.ts"]),
    "6.4": (["frontend/components/plan-detail.tsx", "frontend/lib/plan-detail-edits.ts", "frontend/components/store-tags.tsx"], [],
            ["frontend/components/plan-detail.test.tsx", "frontend/lib/plan-detail-edits.test.ts"]),
    "6.5": (["frontend/lib/shopping-checklist.ts (createPlanShoppingChecklist)", "frontend/lib/trip-history.ts", "frontend/lib/checklist-export.ts"], [],
            ["frontend/lib/plan-shopping-checklist.test.ts"]),
    "7.1": (["frontend/components/healthier-alternatives.tsx", "frontend/lib/nutrition.ts", "frontend/lib/api.ts (fetchHealthierAlternatives)"],
            ["backend/smartcart/nutrition.py (healthier_alternatives)", "backend/data/nutrition/mappings.json"],
            ["backend/tests/test_healthier_alternatives.py", "backend/tests/test_nutrition.py", "frontend/components/healthier-alternatives.test.tsx", "frontend/lib/nutrition.test.ts"]),
    "7.2": (["frontend/components/catalogue-item-dialog.tsx", "frontend/lib/item-stack.ts"], [],
            ["frontend/lib/item-stack.test.ts", "frontend/components/catalogue-item-dialog.test.tsx"]),
    "7.3": (["frontend/components/healthier-alternatives.tsx", "frontend/lib/nutrition.ts"],
            ["backend/smartcart/nutrition.py", "backend/smartcart/nutrition_comparison.py", "backend/data/nutrition/comparison_policy.json"],
            ["backend/tests/test_nutrition_comparison.py", "backend/tests/test_alternative_item_nutrition.py", "frontend/components/healthier-alternatives.test.tsx"]),
    "7.4": (["frontend/components/item-nutrition.tsx", "frontend/lib/api.ts (fetchItemNutrition)"],
            ["backend/smartcart/item_nutrition.py", "backend/smartcart/nutrition_repository.py"],
            ["backend/tests/test_item_nutrition.py", "backend/tests/test_item_nutrition_coverage.py", "backend/tests/test_nutrition_repository.py", "frontend/components/item-nutrition.test.tsx", "database/tests/test_import_nutrition.py", "data/nutrition/scripts/test_import_usda.py", "data/nutrition/scripts/test_import_fndds.py", "data/nutrition/scripts/test_import_singapore.py", "data/nutrition/scripts/test_map_ingredient_nutrition.py"]),
    "8.1": (["frontend/components/statistics-panel.tsx", "frontend/lib/period-analytics.ts", "frontend/lib/statistics-view.ts"],
            ["backend/smartcart/period_analytics.py"],
            ["frontend/lib/statistics-view.test.ts", "backend/tests/test_period_analytics.py"]),
    "8.2": (["frontend/lib/estimated-savings.ts", "frontend/components/estimated-savings-summary.tsx"], [],
            ["frontend/lib/estimated-savings.test.ts"]),
    "8.3": (["frontend/lib/statistics-view.ts", "frontend/components/statistics-panel.tsx"], [],
            ["frontend/lib/statistics-view.test.ts"]),
    "8.5": (["frontend/components/report-screens.tsx", "frontend/lib/report-generation.ts", "frontend/lib/inbox.ts", "frontend/lib/report-language.ts"],
            ["backend/smartcart/reporting.py", "backend/smartcart/report_insights.py", "backend/smartcart/cerebras_narrator.py", "backend/smartcart/report_models.py"],
            ["backend/tests/test_report_insights.py", "backend/tests/test_report_story.py", "backend/tests/test_cerebras_narrator.py", "backend/tests/test_report_api.py", "frontend/lib/report-generation.test.ts", "frontend/components/report-screens.test.ts"]),
    "8.6": (["frontend/lib/report-consent.ts", "frontend/components/report-screens.tsx (consent dialog)", "frontend/lib/inbox.ts"], [],
            ["frontend/lib/report-consent.test.ts", "frontend/components/report-screens.test.ts", "backend/tests/test_report_api.py"]),
}


def clean(description: str | None) -> str:
    text = description or ""
    text = re.sub(r"<\s*br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</\s*(p|li|div|h\d)\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "- ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.split("\n")]
    return "\n\n".join(line for line in lines if line)


def parse_sizes() -> tuple[dict[str, int], dict[int, str]]:
    sizes: dict[str, int] = {}
    dates: dict[int, str] = {}
    current = None
    for line in REVISION.splitlines():
        heading = re.match(r"^#{2,4}\s+(?:EPIC\s+|US\s+)?(\d+\.\d+(?:\.\d+)?)\s+—", line)
        if heading:
            current = heading.group(1)
            continue
        if current is None:
            continue
        size = re.match(r"^\*\*Size:\*\*\s*(\d+)(?:\s*·\s*\*\*Dates:\*\*\s*(\S+)\s*→\s*(\S+))?", line) or re.match(r"^\*Size:\s*(\d+)\*", line)
        if size and current not in sizes:
            sizes[current] = int(size.group(1))
            if size.lastindex and size.lastindex >= 3 and size.group(2):
                dates[int(current.split(".")[0])] = f"{size.group(2)} → {size.group(3)}"
    return sizes, dates


def number_key(number: str) -> tuple[int, ...]:
    return tuple(int(part) for part in number.split("."))


def card_link(card_id: str) -> str:
    return f"[{card_id}](https://monashie.leankit.com/card/{card_id})"


def code_list(paths: list[str], prefix: str) -> str:
    out = []
    for path in paths:
        file, _, note = path.partition(" ")
        out.append(f"[`{file.split('/')[-1]}`]({prefix}{file}){(' ' + note) if note else ''}")
    return ", ".join(out) if out else "—"


def main() -> None:
    sizes, dates = parse_sizes()
    epics: dict[int, dict] = {}
    stories: dict[str, dict] = {}
    acs: dict[str, list[dict]] = defaultdict(list)
    archived: list[dict] = []
    for card in CARDS:
        header = (card.get("customId") or {}).get("value")
        if header not in {"EPIC", "User story", "User Story", "AC"}:
            continue
        match = NUM.match(card["title"])
        if not match:
            continue
        epic_no, story_no, ac_no, rest = match.groups()
        priority = TAG.search(rest)
        title = PARENT.sub("", TAG.sub("", rest)).strip()
        entry = {
            "id": card["id"], "title": title, "text": clean(card.get("description")),
            "assigned": [user["fullName"] for user in card.get("assignedUsers", [])],
            "priority": priority.group(1).upper() if priority else None,
            "lane": card["lane"]["title"],
        }
        number = f"{epic_no}.{story_no}" + (f".{ac_no}" if ac_no else "") if header != "EPIC" else f"{epic_no}.0"
        if card.get("size"):
            sizes[number] = int(card["size"])
        if card.get("archivedOn"):
            entry["number"] = f"{epic_no}.{story_no}" + (f".{ac_no}" if ac_no else "")
            entry["header"] = header
            archived.append(entry)
            continue
        if header == "EPIC":
            epics[int(epic_no)] = entry
        elif header.lower() == "user story":
            entry["number"] = f"{epic_no}.{story_no}"
            stories[entry["number"]] = entry
        else:
            entry["number"] = f"{epic_no}.{story_no}.{ac_no}"
            acs[f"{epic_no}.{story_no}"].append(entry)

    # The live snapshot stops at 500 cards and omits the Epic 1 card. The sync
    # therefore never updated it; take its (unchanged) text from the backup.
    sync_notes: dict[int, str] = {}
    if 1 not in epics:
        backup = json.loads(ARGS.backup.read_text(encoding="utf-8"))
        card = next(c for c in backup if c["title"].startswith("1.0 - Essential Basket Building"))
        epics[1] = {"id": card["id"], "title": "Essential Basket Building", "text": clean(card["description"]),
                    "assigned": [u["fullName"] for u in (card.get("assignedUsers") or [])], "priority": None, "lane": card["lane"]["title"]}
        sync_notes[1] = ("> **Board gap:** the 11 October sync did not reach this epic card (the card fetch stopped at 500 cards), "
                         "so its revised size, planned window and assignees were never applied. Size and window below are the revision's intended values.")

    out_dir = REPO / "docs" / "02-requirements"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary_rows = []
    for epic_no, (file_name, short) in EPICS.items():
        epic = epics[epic_no]
        epic_stories = sorted((s for n, s in stories.items() if n.split(".")[0] == str(epic_no)), key=lambda s: number_key(s["number"]))
        ac_total = sum(len(acs[s["number"]]) for s in epic_stories)
        summary_rows.append((epic_no, file_name, short, len(epic_stories), ac_total, sizes.get(f"{epic_no}.0"), dates.get(epic_no, "—")))
        lines = [
            f"# Epic {epic_no} — {short.capitalize() if short[0].islower() else short}",
            "",
            f"> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).",
            "",
            "| | |", "| --- | --- |",
            f"| Epic card | {card_link(epic['id'])} |",
            f"| Size | {sizes.get(f'{epic_no}.0', '—')} |",
            f"| Planned window | {dates.get(epic_no, '—')} |",
            f"| Assigned | {', '.join(epic['assigned']) or '—'} |",
            f"| Stories / ACs | {len(epic_stories)} / {ac_total} |",
            "",
            *( [sync_notes[epic_no], ""] if epic_no in sync_notes else [] ),
            epic["text"],
            "",
            "## Stories", "",
            "| Story | Title | Priority | Size | ACs | Assigned |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for story in epic_stories:
            anchor = re.sub(r"[^a-z0-9 -]", "", f"us {story['number']} {story['title']}".lower()).replace(" ", "-")
            lines.append(f"| [{story['number']}](#{anchor}) | {story['title']} | {story['priority'] or '—'} | {sizes.get(story['number'], '—')} | {len(acs[story['number']])} | {', '.join(story['assigned']) or '—'} |")
        for story in epic_stories:
            fe, be, tests = IMPL.get(story["number"], ([], [], []))
            lines += [
                "", f"## US {story['number']} {story['title']}", "",
                f"Card {card_link(story['id'])} · size {sizes.get(story['number'], '—')}" + (f" · {story['priority']}" if story["priority"] else ""),
                "", story["text"], "",
                f"**Implementation** — frontend: {code_list(fe, '../../')}; backend/data: {code_list(be, '../../')}.",
                "", f"**Tests** — {code_list(tests, '../../')}.", "",
                "| AC | Criterion | Size |", "| --- | --- | --- |",
            ]
            for ac in sorted(acs[story["number"]], key=lambda a: number_key(a["number"])):
                text = ac["text"].replace("\n\n", " ").replace("|", "\\|")
                lines.append(f"| **{ac['number']}** {ac['title']} | {text} | {sizes.get(ac['number'], '—')} |")
        (out_dir / file_name).write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    # Retired scope: archived cards on the board.
    retired = ["# Retired and archived scope", "",
               "Cards archived on the LeanKit board. They are kept for history and are not part of the current requirements. Text is the card text at archive time.", "",
               "| Card | Type | Title | Board text |", "| --- | --- | --- | --- |"]
    for entry in sorted(archived, key=lambda e: number_key(e["number"])):
        text = entry["text"].replace("\n\n", " ").replace("|", "\\|")
        if len(text) > 260:
            text = text[:257].rstrip() + "…"
        retired.append(f"| {card_link(entry['id'])} | {entry['header']} | {entry['number']} {entry['title']} | {text} |")
    retired += ["", "## Discontinued epic", "",
                "The original Epic 6, **Price Freshness, Community Prices and Availability Signals** (card `2512848438`), was discontinued by the team on 6 October 2026 and its 22 cards were removed from the board. Epic 6 now means **Multi-Store Basket Recommendations** (card `2527216862`). Source/freshness disclosures and SARA labels that existed before remain in the app."]
    (out_dir / "retired-scope.md").write_text("\n".join(retired) + "\n", encoding="utf-8")

    # Summary for README (printed; README is hand-written around it).
    total_s = sum(r[3] for r in summary_rows)
    total_a = sum(r[4] for r in summary_rows)
    table = ["| Epic | Title | Stories | ACs | Size | Planned window |", "| --- | --- | --- | --- | --- | --- |"]
    for epic_no, file_name, short, s, a, size, window in summary_rows:
        table.append(f"| {epic_no} | [{short.capitalize() if short[0].islower() else short}]({file_name}) | {s} | {a} | {size or '—'} | {window} |")
    table.append(f"| | **Total** | **{total_s}** | **{total_a}** | | |")
    print("\n".join(table).encode("ascii", "replace").decode())
    print("archived:", len(archived))

    # Traceability matrix.
    trace = ["# Traceability matrix", "",
             "Maps every active user story to the code that implements it and the automated tests that exercise it. Generated from the same source as the [requirements](../02-requirements/README.md). Story-level mapping; AC wording lives in the requirement files. Data-pipeline tests (database/ and data/nutrition/scripts/) are listed under the story whose data they produce. Every automated test file in the repository appears at least once.", "",
             "Status key: **Automated** = at least one listed test exercises the story; **Manual** = behaviour is UI-only and verified by browser checks.", "",
             "| Story | Title | Frontend | Backend / data | Tests | Status |", "| --- | --- | --- | --- | --- | --- |"]
    for number in sorted(stories, key=number_key):
        fe, be, tests = IMPL.get(number, ([], [], []))
        blocked = any("blocked" in t for t in tests)
        status = "Automated" + (" (partly blocked)" if blocked else "") if tests else "Manual"
        trace.append(f"| {number} | {stories[number]['title']} | {code_list(fe, '../../')} | {code_list(be, '../../')} | {code_list(tests, '../../')} | {status} |")
    missing = sorted(set(stories) - set(IMPL))
    trace += ["", f"Stories without a mapping: {', '.join(missing) if missing else 'none'}."]
    out = REPO / "docs" / "08-evidence"
    out.mkdir(parents=True, exist_ok=True)
    (out / "traceability-matrix.md").write_text("\n".join(trace) + "\n", encoding="utf-8")

    # Verify every mapped path exists.
    for number, groups in IMPL.items():
        for path in sum(groups, []):
            file = path.split(" ")[0]
            if not (REPO / file).exists():
                print("MISSING PATH", number, file)


if __name__ == "__main__":
    main()
