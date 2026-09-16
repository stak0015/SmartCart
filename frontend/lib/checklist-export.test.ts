import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildChecklistExportModel,
} from "./checklist-export";
import {
  setChecklistItemActualPrice,
  SHOPPING_CHECKLIST_VERSION,
  toggleChecklistItemStatus,
  type ChecklistItem,
  type ShoppingChecklist,
} from "./shopping-checklist";

// AC 5.7.2 fixtures: one catalogue row per relevant price/status shape plus
// a custom (shopper-added) row.
const catalogueRow: ChecklistItem = {
  id: "catalogue-101-0",
  source: "catalogue",
  catalogueItemId: "101",
  itemName: "BERAS SUPER CAP RODA SAZARICE 5%",
  itemNameEn: "Super rice 5%",
  itemNameMs: "Beras super 5%",
  packageSize: "10 kg",
  quantity: 2,
  unitPriceRm: 32.5,
  lineTotalRm: 65,
  actualPriceRm: null,
  actualQuantity: null,
  quantitySource: "planned",
  priceSource: "store",
  observedDate: "2026-09-10",
  status: "bought",
};

const medianRow: ChecklistItem = {
  ...catalogueRow,
  id: "catalogue-102-1",
  catalogueItemId: "102",
  itemName: "MINYAK MASAK CAP SAWIT",
  itemNameEn: "Cooking oil",
  itemNameMs: "Minyak masak",
  packageSize: null,
  quantity: 1,
  unitPriceRm: 12.34,
  lineTotalRm: 12.34,
  priceSource: "median",
  status: "not_bought",
};

const noPriceRow: ChecklistItem = {
  ...catalogueRow,
  id: "catalogue-103-2",
  catalogueItemId: "103",
  itemName: "TELUR AYAM GRED C",
  itemNameEn: null,
  itemNameMs: null,
  packageSize: "30 biji",
  quantity: 1,
  unitPriceRm: null,
  lineTotalRm: null,
  priceSource: null,
  status: "neutral",
};

const actualEntryRow: ChecklistItem = {
  ...catalogueRow,
  id: "catalogue-104-3",
  catalogueItemId: "104",
  itemName: "SUSU SEGAR",
  itemNameEn: "Fresh milk",
  itemNameMs: "Susu segar",
  quantity: 3,
  actualPriceRm: 7.2,
  actualQuantity: 4,
  quantitySource: "actual",
  status: "bought",
};

const customRow: ChecklistItem = {
  id: "manual-abc",
  source: "manual",
  catalogueItemId: null,
  itemName: "Homemade sambal from the pasar malam stall with a very long name",
  itemNameEn: null,
  itemNameMs: null,
  packageSize: null,
  quantity: 1,
  unitPriceRm: null,
  lineTotalRm: null,
  actualPriceRm: null,
  actualQuantity: null,
  quantitySource: "planned",
  priceSource: null,
  observedDate: null,
  status: "bought",
};

const checklist: ShoppingChecklist = {
  version: SHOPPING_CHECKLIST_VERSION,
  id: "checklist-test",
  store: {
    premiseId: "premise-1",
    premiseCode: "PC-1",
    name: "Kedai Runcit Uji",
    address: "1, Jalan Ujian, Kuala Lumpur",
  },
  createdAt: "2026-09-16T08:30:00.000Z",
  updatedAt: "2026-09-16T08:30:00.000Z",
  plannedSubtotalRm: 110.84,
  estimatedRoundTripCostRm: 4.6,
  plannedCombinedTotalRm: 115.44,
  alternativeStoreEstimates: [
    {
      premiseId: "premise-2",
      name: "Kedai Lain",
      estimatedRoundTripCostRm: 6,
      estimatedTotalCostRm: 120,
    },
  ],
  estimatedSavings: null,
  items: [catalogueRow, medianRow, noPriceRow, actualEntryRow, customRow],
};

describe("checklist export model (AC 5.7.2)", () => {
  it("carries the store, localized title, and checklist date", () => {
    const en = buildChecklistExportModel(checklist, "en");
    expect(en.storeName).toBe("Kedai Runcit Uji");
    expect(en.title).toBe("Shopping checklist");
    expect(en.dateText).toBe(
      new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(
        new Date("2026-09-16T08:30:00.000Z"),
      ),
    );
    const ms = buildChecklistExportModel(checklist, "ms");
    expect(ms.title).toBe("Senarai semak beli-belah");
    expect(ms.dateText).toBe(
      new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium" }).format(
        new Date("2026-09-16T08:30:00.000Z"),
      ),
    );
  });

  it("exports every catalogue and custom row exactly once, in order", () => {
    const model = buildChecklistExportModel(checklist, "en");
    expect(model.rows).toHaveLength(5);
    expect(model.rows.map(row => row.name)).toEqual([
      "Super rice 5%",
      "Cooking oil",
      "TELUR AYAM GRED C",
      "Fresh milk",
      "Homemade sambal from the pasar malam stall with a very long name",
    ]);
  });

  it("localizes catalogue names and falls back to the original name", () => {
    const ms = buildChecklistExportModel(checklist, "ms");
    expect(ms.rows[0].name).toBe("Beras super 5%");
    // noPriceRow has no translated names: original name is the fallback.
    expect(ms.rows[2].name).toBe("TELUR AYAM GRED C");
    // Custom rows always keep the shopper's typed name in every locale.
    expect(ms.rows[4].name).toBe(
      "Homemade sambal from the pasar malam stall with a very long name",
    );
  });

  it("includes package size when known and null otherwise", () => {
    const model = buildChecklistExportModel(checklist, "en");
    expect(model.rows[0].packageSize).toBe("10 kg");
    expect(model.rows[1].packageSize).toBeNull();
    expect(model.rows[4].packageSize).toBeNull();
  });

  it("labels every row outcome", () => {
    const en = buildChecklistExportModel(checklist, "en");
    expect(en.rows.map(row => row.outcomeLabel)).toEqual([
      "Bought",
      "Not bought",
      "Neutral",
      "Bought",
      "Bought",
    ]);
    const ms = buildChecklistExportModel(checklist, "ms");
    expect(ms.rows.map(row => row.outcomeLabel)).toEqual([
      "Dibeli",
      "Belum dibeli",
      "Belum ditanda",
      "Dibeli",
      "Dibeli",
    ]);
  });

  it("labels reference prices by source and marks unknown prices unavailable", () => {
    const model = buildChecklistExportModel(checklist, "en");
    // Store-observed price is the plain reference price.
    expect(model.rows[0].referenceUnitPriceText).toBe("RM32.50");
    // Median reference prices stay labelled as estimates.
    expect(model.rows[1].referenceUnitPriceText).toBe(
      "RM12.34 (Estimated price)",
    );
    // No reference price: an explicit unavailable label, never RM0.00.
    expect(model.rows[2].referenceUnitPriceText).toBe("Price unavailable");
    expect(model.rows[2].referenceUnitPriceText).not.toContain("RM0");
  });

  it("keeps shopper-recorded actual prices separately labelled", () => {
    const model = buildChecklistExportModel(checklist, "en");
    expect(model.rows[3].actualUnitPriceText).toBe("RM7.20 (Shopper recorded)");
    // The actual price never rewrites the reference price label.
    expect(model.rows[3].referenceUnitPriceText).toBe("RM32.50");
    expect(model.rows[0].actualUnitPriceText).toBeNull();
  });

  it("uses the actual quantity with its source label when recorded", () => {
    const model = buildChecklistExportModel(checklist, "en");
    expect(model.rows[3].quantity).toBe(4);
    expect(model.rows[3].quantitySourceLabel).toBe("actual");
    expect(model.rows[0].quantity).toBe(2);
    expect(model.rows[0].quantitySourceLabel).toBeNull();
  });

  it("keeps custom rows clearly marked as shopper-added", () => {
    const en = buildChecklistExportModel(checklist, "en");
    expect(en.rows[4].shopperAddedLabel).toBe("Manually added");
    const ms = buildChecklistExportModel(checklist, "ms");
    expect(ms.rows[4].shopperAddedLabel).toBe("Ditambah secara manual");
    expect(en.rows[0].shopperAddedLabel).toBeNull();
  });
});

describe("checklist export current state and privacy (AC 5.7.3)", () => {
  it("reflects the latest saved checklist state on every rebuild", () => {
    const before = buildChecklistExportModel(checklist, "en");
    expect(before.rows[0].outcomeLabel).toBe("Bought");
    expect(before.rows[0].actualUnitPriceText).toBeNull();

    // Later saved edits (a shopper-recorded price and a re-marked outcome)
    // show up in the next export without touching the original snapshot.
    // Note: actual prices can only be recorded while the line is bought, so
    // the price is set before the outcome is re-marked.
    const updated = toggleChecklistItemStatus(
      setChecklistItemActualPrice(checklist, catalogueRow.id, 30.99)!,
      catalogueRow.id,
      "not_bought",
    );
    const after = buildChecklistExportModel(updated, "en");
    expect(after.rows[0].outcomeLabel).toBe("Not bought");
    expect(after.rows[0].actualUnitPriceText).toBe("RM30.99 (Shopper recorded)");
    // The earlier model and the source checklist are left unchanged.
    expect(before.rows[0].outcomeLabel).toBe("Bought");
    expect(checklist.items[0].status).toBe("bought");
  });

  it("never includes precise location, identity, or hidden app data", () => {
    const sentinelChecklist: ShoppingChecklist = {
      ...checklist,
      id: "SENTINEL-CHECKLIST-ID",
      store: {
        premiseId: "SENTINEL-PREMISE-ID",
        premiseCode: "SENTINEL-PREMISE-CODE",
        name: "Kedai Runcit Uji",
        address: "SENTINEL-ADDRESS",
      },
      plannedSubtotalRm: 888.88,
      estimatedRoundTripCostRm: 999.99,
      plannedCombinedTotalRm: 1111.11,
      alternativeStoreEstimates: [
        {
          premiseId: "SENTINEL-ALT-PREMISE-ID",
          name: "SENTINEL-ALT-STORE-NAME",
          estimatedRoundTripCostRm: 666.66,
          estimatedTotalCostRm: 555.55,
        },
      ],
      estimatedSavings: {
        medianCombinedCostRm: 777.77,
        selectedBaselineCombinedCostRm: 777.77,
        selectedCurrentCombinedCostRm: 777.77,
        storeChoiceImpactRm: 777.77,
        itemChangeImpactRm: 777.77,
        netSavingRm: 777.77,
        comparableStoreCount: 3,
        estimatedPriceCount: 2,
        routeEstimated: true,
      },
      items: [
        {
          ...catalogueRow,
          id: "SENTINEL-ROW-ID",
          catalogueItemId: "SENTINEL-CATALOGUE-ITEM-ID",
          observedDate: "SENTINEL-OBSERVED-DATE",
        },
      ],
    };
    const model = buildChecklistExportModel(sentinelChecklist, "en");
    const serialized = JSON.stringify(model);

    // Positive control: the export does carry the public content.
    expect(serialized).toContain("Kedai Runcit Uji");
    expect(serialized).toContain("Super rice 5%");

    const hiddenSentinels = [
      "SENTINEL-CHECKLIST-ID",
      "SENTINEL-PREMISE-ID",
      "SENTINEL-PREMISE-CODE",
      "SENTINEL-ADDRESS",
      "SENTINEL-ROW-ID",
      "SENTINEL-CATALOGUE-ITEM-ID",
      "SENTINEL-OBSERVED-DATE",
      "SENTINEL-ALT-PREMISE-ID",
      "SENTINEL-ALT-STORE-NAME",
      "888.88",
      "999.99",
      "1111.11",
      "666.66",
      "555.55",
      "777.77",
    ];
    for (const sentinel of hiddenSentinels) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("keeps generation on-device: the export module makes no network calls", () => {
    const sourcePath = fileURLToPath(
      new URL("./checklist-export.ts", import.meta.url),
    );
    const source = readFileSync(sourcePath, "utf8");
    // No network API and no remote endpoint anywhere in the module: the
    // checklist is never silently uploaded during export generation.
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest|sendBeacon|axios|api-client/);
    expect(source).not.toMatch(/https?:\/\//);
  });
});
