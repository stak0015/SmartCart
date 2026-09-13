import { describe, expect, it } from "vitest";

import { COPY, categoryLabel } from "./i18n";

describe("categoryLabel", () => {
  it("shows English category translations in English mode", () => {
    expect(categoryLabel("en", "BERAS")).toBe("Rice");
    expect(categoryLabel("en", "ALAT TULIS DAN BAHAN BACAAN")).toBe(
      "Stationery & Reading Materials",
    );
  });

  it("keeps the source Malay category in Malay mode", () => {
    expect(categoryLabel("ms", "SAYUR-SAYURAN")).toBe("SAYUR-SAYURAN");
  });

  it("falls back safely for missing or newly introduced categories", () => {
    expect(categoryLabel("en", null)).toBe("—");
    expect(categoryLabel("en", "KATEGORI BAHARU")).toBe("KATEGORI BAHARU");
  });
});

describe("pagination and SARA candidate copy", () => {
  it("keeps category candidates distinct from verified eligibility", () => {
    expect(COPY.en.saraCategoryCandidate).toContain("Potential");
    expect(COPY.en.saraCategoryCandidate).toContain("verify");
    expect(COPY.ms.saraCategoryCandidate).toContain("berpotensi");
    expect(COPY.ms.saraCategoryCandidate).toContain("sahkan");
  });

  it("localizes page position labels", () => {
    expect(COPY.en.pageOf(2, 31)).toBe("Page 2 of 31");
    expect(COPY.ms.pageOf(2, 31)).toBe("Halaman 2 daripada 31");
  });
});

describe("pack size comparison copy (AC 3.2.1)", () => {
  it("exposes the new keys in both English and Bahasa Melayu", () => {
    for (const copy of [COPY.en, COPY.ms]) {
      expect(copy.packSizeOptions.trim().length).toBeGreaterThan(0);
      expect(copy.currentPack.trim().length).toBeGreaterThan(0);
    }
  });

  it("formats the per-unit price per kg or per litre", () => {
    expect(COPY.en.packUnitPrice("RM 9.00", "KG")).toBe("RM 9.00 per kg");
    expect(COPY.en.packUnitPrice("RM 9.00", "L")).toBe("RM 9.00 per litre");
    expect(COPY.ms.packUnitPrice("RM 9.00", "KG")).toBe("RM 9.00 setiap kg");
    expect(COPY.ms.packUnitPrice("RM 9.00", "L")).toBe("RM 9.00 setiap liter");
  });
});

describe("best value copy (AC 3.2.2)", () => {
  it("keeps the English label verbatim and provides a Malay translation", () => {
    expect(COPY.en.bestValue).toBe("Best value");
    expect(COPY.ms.bestValue.trim().length).toBeGreaterThan(0);
  });
});

describe("value trade-off copy (AC 3.2.3)", () => {
  it("shows the upfront and per-unit differences with direction words", () => {
    expect(COPY.en.packTradeoff("RM 3.00", "more", "RM 0.40", "more", "KG"))
      .toBe("RM 3.00 more now · RM 0.40/kg more");
    expect(COPY.en.packTradeoff("RM 8.50", "less", "RM 0.50", "more", "KG"))
      .toBe("RM 8.50 less now · RM 0.50/kg more");
    expect(COPY.en.packTradeoff("RM 3.00", "more", "RM 0.40", "more", "L"))
      .toContain("/litre more");
    expect(COPY.en.packTradeoff("RM 0.00", "same", "RM 0.00", "same", "KG"))
      .toBe("same total price · same per kg");
  });

  it("provides a Malay translation and a baseline note in both languages", () => {
    expect(COPY.ms.packTradeoff("RM 3.00", "more", "RM 0.40", "more", "KG"))
      .toContain("lebih");
    expect(COPY.en.bestValueBaseline.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.bestValueBaseline.trim().length).toBeGreaterThan(0);
  });
});

describe("compact replacement copy", () => {
  it("separates immediate savings from best unit value in both languages", () => {
    expect(COPY.en.lowerPriceNow).toBe("Lower price now");
    expect(COPY.en.bestUnitValue).toBe("Best unit value");
    expect(COPY.en.comparePackSizes(3)).toBe("Compare 3 pack sizes");
    expect(COPY.ms.lowerPriceNow.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.bestUnitValue.trim().length).toBeGreaterThan(0);
  });

  it("supports saving, higher-cost, and neutral summaries", () => {
    expect(COPY.en.costsMoreNow("RM 2.00")).toBe("Costs RM 2.00 more now");
    expect(COPY.en.noBasketCostChange).toBe("No change in basket cost");
    expect(COPY.ms.costsMoreNow("RM 2.00")).toContain("RM 2.00");
  });
});

describe("basket count copy (iteration1 feedback)", () => {
  it("distinguishes total units from product kinds in English", () => {
    expect(COPY.en.basketItemsAndKinds(3, 2)).toBe("3 items · 2 products");
    expect(COPY.en.basketItemsAndKinds(1, 1)).toBe("1 item · 1 product");
  });

  it("provides a Malay translation", () => {
    expect(COPY.ms.basketItemsAndKinds(3, 2)).toBe("3 item · 2 produk");
    expect(COPY.ms.basketItemsAndKinds(1, 1)).toBe("1 item · 1 produk");
  });
});

describe("combined total labels (iteration1 feedback)", () => {
  it("localizes the basket subtotal, partial total and return travel in both languages", () => {
    expect(COPY.en.basketSubtotal).toBe("Basket subtotal");
    expect(COPY.en.partialTotal).toBe("Partial total");
    expect(COPY.en.returnTravel).toBe("Return travel");
    expect(COPY.en.combinedTotal).toBe("Combined total");
    expect(COPY.en.partialEstimatedTotal).toBe("Partial basket + transport");
    expect(COPY.en.estimatedSubtotal).toBe("Estimated basket subtotal");
    expect(COPY.en.estimatedCombinedTotal).toBe("Estimated basket + transport");
    expect(COPY.en.medianPriceEstimate).toBe("Price unavailable; showing estimate");
    expect(COPY.en.priceCoverage(2, 3)).toBe("2 of 3 products have an official price");

    expect(COPY.ms.basketSubtotal.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.partialTotal.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.returnTravel.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.combinedTotal.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.partialEstimatedTotal.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.estimatedSubtotal.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.estimatedCombinedTotal.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.medianPriceEstimate.trim().length).toBeGreaterThan(0);
    expect(COPY.ms.priceCoverage(2, 3)).toContain("2");
  });

  it("keeps the suffix word order consistent with the equation in both languages", () => {
    expect(`${COPY.en.basketSubtotal} + ${COPY.en.returnTravel}`).toContain("+");
    expect(`${COPY.ms.basketSubtotal} + ${COPY.ms.returnTravel}`).toContain("+");
    expect(`${COPY.en.partialTotal} + ${COPY.en.returnTravel}`).toContain("+");
    expect(`${COPY.ms.partialTotal} + ${COPY.ms.returnTravel}`).toContain("+");
  });
});

describe("shopping checklist copy", () => {
  it("keeps the English and Bahasa Melayu copy shapes identical", () => {
    expect(Object.keys(COPY.ms).sort()).toEqual(Object.keys(COPY.en).sort());
  });

  it("provides localized checklist access, progress, and price copy", () => {
    expect(COPY.en.openChecklistAria(1)).toBe("Open shopping checklist, 1 item");
    expect(COPY.en.openChecklistAria(3)).toBe("Open shopping checklist, 3 items");
    expect(COPY.ms.openChecklistAria(3)).toContain("3 item");
    expect(COPY.en.checklistProgress(2, 3)).toBe("2 of 3 items bought");
    expect(COPY.ms.checklistProgress(2, 3)).toBe("2 daripada 3 item dibeli");
    expect(COPY.en.checklistPriceDisclosure(1)).toContain("1 item has no price");
    expect(COPY.en.checklistPriceDisclosure(2)).toContain("2 items have no price");
    expect(COPY.ms.checklistPriceDisclosure(2)).toContain("2 item");
    expect(COPY.en.plannedSubtotal).not.toBe(COPY.en.estimatedPlannedSubtotal);
    expect(COPY.ms.plannedSubtotal).not.toBe(COPY.ms.estimatedPlannedSubtotal);
  });

  it("provides status actions, manual-item validation, and destructive confirmations", () => {
    expect(COPY.en.markBought("Rice")).toContain("Rice");
    expect(COPY.en.markNotBought("Rice")).toContain("not bought");
    expect(COPY.ms.markBought("Beras")).toContain("Beras");
    expect(COPY.ms.markNotBought("Beras")).toContain("belum dibeli");
    expect(COPY.en.itemQuantityError).toContain("positive whole number");
    expect(COPY.ms.itemQuantityError).toContain("nombor bulat positif");
    expect(COPY.en.itemPriceError).toContain("two decimal places");
    expect(COPY.ms.itemPriceError).toContain("dua tempat perpuluhan");
    expect(COPY.en.shopperRecorded).toBe("Shopper recorded");
    expect(COPY.ms.shopperRecorded).toContain("Dicatat");
    expect(COPY.en.actualUnitPrice).toContain("Actual unit price");
    expect(COPY.ms.actualUnitPrice).toContain("Harga seunit sebenar");
    expect(COPY.en.deleteItemConfirm("Milk")).toContain("Milk");
    expect(COPY.ms.deleteItemConfirm("Susu")).toContain("Susu");
    expect(COPY.en.replaceChecklistConfirm).toContain("manually added items");
    expect(COPY.ms.deleteChecklistConfirm).toContain("secara kekal");
  });
});
