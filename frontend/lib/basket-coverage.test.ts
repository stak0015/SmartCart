import { describe, expect, it } from "vitest";

import { isCompleteBasket } from "./basket-coverage";

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
