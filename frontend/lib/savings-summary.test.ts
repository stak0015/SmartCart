import { describe, expect, it } from "vitest";

import { undoBasketReplacement, type BasketItem } from "./basket-state";
import { basketSavingsSummary } from "./savings-summary";

// A basket line whose alternative has been applied (AC 3.3.1 provenance).
const swappedRice: BasketItem = {
  id: "db-201",
  name: "Beras Ekonomi 5kg",
  size: "5 kg",
  qty: 2,
  saraEligible: true,
  saraCategoryCandidate: true,
  replacement: {
    original: {
      id: "db-101",
      name: "Beras 5kg",
      size: "5 kg",
      qty: 2,
      saraEligible: true,
      saraCategoryCandidate: true,
    },
    premiseId: "10",
    premiseName: "Test Store",
    kind: "lower_cost",
    sourceUnitPriceRm: 15.9,
    alternativeUnitPriceRm: 12.5,
    sourceObservedDate: "2026-08-01",
    alternativeObservedDate: "2026-08-15",
  },
};

const swappedOil: BasketItem = {
  id: "db-202",
  name: "Minyak Masak 1kg (Value)",
  size: "1 kg",
  qty: 3,
  saraEligible: true,
  saraCategoryCandidate: true,
  replacement: {
    original: {
      id: "db-102",
      name: "Minyak Masak 1kg",
      size: "1 kg",
      qty: 3,
      saraEligible: true,
      saraCategoryCandidate: true,
    },
    premiseId: "10",
    premiseName: "Test Store",
    kind: "lower_cost",
    sourceUnitPriceRm: 7.5,
    alternativeUnitPriceRm: 6.9,
    sourceObservedDate: null,
    alternativeObservedDate: "2026-08-15",
  },
};

// A basket line that was never replaced; it must not appear in the summary.
const plainEggs: BasketItem = {
  id: "db-3",
  name: "Grade A Eggs",
  size: "10 pcs",
  qty: 1,
  saraEligible: null,
  saraCategoryCandidate: false,
};

describe("basketSavingsSummary", () => {
  it("reports no savings when no alternatives have been applied", () => {
    const summary = basketSavingsSummary([plainEggs]);
    expect(summary.hasReplacements).toBe(false);
    expect(summary.comparable).toBe(false);
    expect(summary.items).toEqual([]);
    expect(summary.originalRm).toBeNull();
    expect(summary.newRm).toBeNull();
    expect(summary.netSavingRm).toBeNull();
  });

  it("summarises a single applied alternative", () => {
    const summary = basketSavingsSummary([swappedRice, plainEggs]);
    expect(summary.hasReplacements).toBe(true);
    expect(summary.comparable).toBe(true);
    expect(summary.items).toEqual([
      {
        id: "db-201",
        name: "Beras Ekonomi 5kg",
        originalLineRm: 31.8,
        newLineRm: 25,
        impactRm: 6.8,
      },
    ]);
    expect(summary.originalRm).toBe(31.8);
    expect(summary.newRm).toBe(25);
    expect(summary.netSavingRm).toBe(6.8);
  });

  it("makes per-item savings add up to the total saving", () => {
    const summary = basketSavingsSummary([swappedRice, swappedOil]);
    expect(summary.items).toHaveLength(2);
    const perItemTotal = summary.items.reduce((total, line) => total + (line.impactRm ?? 0), 0);
    expect(perItemTotal).toBeCloseTo(summary.netSavingRm ?? 0, 2);
    expect(summary.netSavingRm).toBeCloseTo(8.6, 2);
    expect(summary.originalRm).toBeCloseTo(54.3, 2);
    expect(summary.newRm).toBeCloseTo(45.7, 2);
    // AC 3.4.2 reconciliation: total saving = original total - new total.
    expect((summary.originalRm ?? 0) - (summary.newRm ?? 0)).toBeCloseTo(summary.netSavingRm ?? 0, 2);
  });

  it("reports a higher upfront pack cost as a negative net saving", () => {
    const costlierPack: BasketItem = {
      ...swappedRice,
      id: "db-301",
      replacement: {
        ...swappedRice.replacement!,
        kind: "pack",
        alternativeUnitPriceRm: 18,
      },
    };
    const summary = basketSavingsSummary([costlierPack]);
    expect(summary.netSavingRm).toBe(-4.2);
    expect(summary.originalRm).toBe(31.8);
    expect(summary.newRm).toBe(36);
  });

  it("reports a neutral net change for mixed cheaper and costlier replacements", () => {
    const offsettingPack: BasketItem = {
      ...swappedOil,
      id: "db-302",
      replacement: {
        ...swappedOil.replacement!,
        kind: "pack",
        sourceUnitPriceRm: 7.5,
        alternativeUnitPriceRm: 9.766666666666667,
      },
    };
    const summary = basketSavingsSummary([swappedRice, offsettingPack]);
    expect(summary.comparable).toBe(true);
    expect(summary.netSavingRm).toBe(0);
    expect((summary.originalRm ?? 0) - (summary.newRm ?? 0)).toBe(0);
  });

  it("suppresses the total when a comparison price is missing", () => {
    const unknown: BasketItem = {
      ...swappedRice,
      replacement: { ...swappedRice.replacement!, sourceUnitPriceRm: null },
    };
    const summary = basketSavingsSummary([unknown]);
    expect(summary.hasReplacements).toBe(true);
    expect(summary.comparable).toBe(false);
    expect(summary.netSavingRm).toBeNull();
  });

  it("returns to the no-savings state after the swap is undone", () => {
    const restored = undoBasketReplacement([swappedRice, plainEggs], "db-201");
    const summary = basketSavingsSummary(restored);
    expect(summary.hasReplacements).toBe(false);
    expect(summary.items).toEqual([]);
    expect(summary.netSavingRm).toBeNull();
  });
});
