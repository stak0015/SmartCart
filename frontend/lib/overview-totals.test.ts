import { describe, expect, it } from "vitest";

import type { BasketLineDetail } from "./contracts";
import { overviewTotalRm, sumPricedLineTotals } from "./overview-totals";

const line = (lineTotalRm: number | null): BasketLineDetail => ({
  itemId: "x",
  itemName: "Item",
  unit: null,
  quantity: 1,
  unitPriceRm: lineTotalRm,
  lineTotalRm,
  observedDate: null,
});

describe("sumPricedLineTotals", () => {
  it("adds up every priced line total", () => {
    expect(sumPricedLineTotals([line(12.5), line(13)])).toBeCloseTo(25.5, 2);
  });

  it("excludes lines without a price", () => {
    expect(sumPricedLineTotals([line(12.5), line(null), line(4.2)])).toBeCloseTo(16.7, 2);
  });

  it("is zero when nothing is priced", () => {
    expect(sumPricedLineTotals([line(null)])).toBe(0);
  });
});

describe("overviewTotalRm", () => {
  it("adds the priced subtotal and the return travel cost", () => {
    expect(overviewTotalRm(25.5, 4)).toBeCloseTo(29.5, 2);
  });

  it("treats a missing subtotal as zero (no priced lines)", () => {
    expect(overviewTotalRm(null, 4)).toBe(4);
  });
});