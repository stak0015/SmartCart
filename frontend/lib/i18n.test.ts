import { describe, expect, it } from "vitest";

import { COPY, categoryLabel } from "./i18n";

describe("categoryLabel", () => {
  const category = {
    id: "fresh-produce" as const,
    labelEn: "Fresh Produce",
    labelMs: "Hasil Segar",
    spendingClass: "essential" as const,
  };

  it("uses the localized broad category fields", () => {
    expect(categoryLabel("en", category)).toBe("Fresh Produce");
    expect(categoryLabel("ms", category)).toBe("Hasil Segar");
  });

  it("localizes null categories as uncategorised", () => {
    expect(categoryLabel("en", null)).toBe("Uncategorised");
    expect(categoryLabel("ms", null)).toBe("Tidak berkategori");
  });
});

describe("copy shape", () => {
  it("keeps the English and Bahasa Melayu copy shapes identical", () => {
    expect(Object.keys(COPY.ms).sort()).toEqual(Object.keys(COPY.en).sort());
  });

  it("keeps SARA category candidates distinct from verified eligibility", () => {
    expect(COPY.en.saraCategoryCandidate).toContain("verify");
    expect(COPY.ms.saraCategoryCandidate).toContain("sahkan");
  });
});

describe("formatted copy", () => {
  it("localizes page position labels", () => {
    expect(COPY.en.pageOf(2, 31)).toBe("Page 2 of 31");
    expect(COPY.ms.pageOf(2, 31)).toBe("Halaman 2 daripada 31");
  });

  it("formats the per-unit price per kg or per litre", () => {
    expect(COPY.en.packUnitPrice("RM 9.00", "KG")).toBe("RM 9.00 per kg");
    expect(COPY.en.packUnitPrice("RM 9.00", "L")).toBe("RM 9.00 per litre");
    expect(COPY.ms.packUnitPrice("RM 9.00", "L")).toBe("RM 9.00 setiap liter");
  });

  it("shows upfront and per-unit pack differences with direction words", () => {
    expect(COPY.en.packTradeoff("RM 3.00", "more", "RM 0.40", "more", "KG"))
      .toBe("RM 3.00 more now · RM 0.40/kg more");
    expect(COPY.en.packTradeoff("RM 8.50", "less", "RM 0.50", "more", "KG"))
      .toBe("RM 8.50 less now · RM 0.50/kg more");
    expect(COPY.en.packTradeoff("RM 0.00", "same", "RM 0.00", "same", "KG"))
      .toBe("same total price · same per kg");
  });

  it("pluralises basket, checklist and price-disclosure counts", () => {
    expect(COPY.en.basketItemsAndKinds(1, 1)).toBe("1 item · 1 product");
    expect(COPY.en.basketItemsAndKinds(3, 2)).toBe("3 items · 2 products");
    expect(COPY.ms.basketItemsAndKinds(3, 2)).toBe("3 item · 2 produk");
    expect(COPY.en.openChecklistAria(1)).toBe("Open shopping checklist, 1 item");
    expect(COPY.en.openChecklistAria(3)).toBe("Open shopping checklist, 3 items");
    expect(COPY.en.checklistProgress(2, 3)).toBe("2 of 3 items bought");
    expect(COPY.ms.checklistProgress(2, 3)).toBe("2 daripada 3 item dibeli");
    expect(COPY.en.checklistPriceDisclosure(1)).toContain("1 item has no price");
    expect(COPY.en.checklistPriceDisclosure(2)).toContain("2 items have no price");
  });

  it("interpolates item names into actions and confirmations", () => {
    expect(COPY.en.markBought("Rice")).toContain("Rice");
    expect(COPY.ms.markBought("Beras")).toContain("Beras");
    expect(COPY.en.deleteItemConfirm("Milk")).toContain("Milk");
    expect(COPY.en.costsMoreNow("RM 2.00")).toContain("RM 2.00");
  });

  it("labels estimated totals differently from observed ones", () => {
    expect(COPY.en.plannedSubtotal).not.toBe(COPY.en.estimatedPlannedSubtotal);
    expect(COPY.ms.plannedSubtotal).not.toBe(COPY.ms.estimatedPlannedSubtotal);
    expect(COPY.en.basketSubtotal).not.toBe(COPY.en.estimatedSubtotal);
  });
});
