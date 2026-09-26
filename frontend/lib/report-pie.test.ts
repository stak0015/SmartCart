import { describe, expect, it } from "vitest";
import { groupPieCategories } from "./report-pie";

describe("category pie grouping", () => {
  it("shows the six largest categories and an Other categories slice while retaining every table row", () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      categoryId: `category-${index + 1}`,
      amountRm: index + 1,
    }));
    const chart = groupPieCategories(rows);
    expect(chart.totalRm).toBe(36);
    expect(chart.slices.map(slice => slice.categoryId)).toEqual([
      "category-8", "category-7", "category-6", "category-5", "category-4", "category-3", "other-categories",
    ]);
    expect(chart.slices.at(-1)?.amountRm).toBe(3);
    expect(chart.orderedRows).toHaveLength(8);
    expect(chart.slices.reduce((sum, slice) => sum + slice.amountRm / chart.totalRm * 100, 0)).toBeCloseTo(100);
  });

  it("keeps a single category as one complete slice and omits zero-value slices", () => {
    const chart = groupPieCategories([
      { categoryId: "eggs", amountRm: 7.5 },
      { categoryId: "dairy", amountRm: 0 },
    ]);
    expect(chart.slices).toEqual([{ categoryId: "eggs", amountRm: 7.5 }]);
    expect(chart.orderedRows).toHaveLength(2);
    expect(chart.slices[0].amountRm / chart.totalRm).toBe(1);
    expect(groupPieCategories([{ categoryId: "eggs", amountRm: 0 }]).slices).toEqual([]);
  });
});
