import { describe, expect, it } from "vitest";

import { coverageLabel, isCompleteBasket } from "./basket-coverage";

describe("coverageLabel", () => {
  it("renders the priced-item coverage verbatim", () => {
    expect(coverageLabel(3, 5)).toBe("3 of 5 items priced");
  });

  it("handles full and empty coverage", () => {
    expect(coverageLabel(5, 5)).toBe("5 of 5 items priced");
    expect(coverageLabel(0, 5)).toBe("0 of 5 items priced");
  });
});

describe("isCompleteBasket", () => {
  it("is complete only when every requested line is priced", () => {
    expect(isCompleteBasket({ pricedCount: 5, basketLineCount: 5 })).toBe(true);
    expect(isCompleteBasket({ pricedCount: 3, basketLineCount: 5 })).toBe(false);
    expect(isCompleteBasket({ pricedCount: 0, basketLineCount: 5 })).toBe(false);
  });

  it("is not complete when coverage was never computed (no basket sent)", () => {
    expect(isCompleteBasket({ pricedCount: null, basketLineCount: null })).toBe(false);
  });
});
