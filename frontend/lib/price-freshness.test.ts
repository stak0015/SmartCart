import { describe, expect, it } from "vitest";

import { PRICE_STALE_AFTER_DAYS, isPriceStale } from "./price-freshness";

describe("isPriceStale", () => {
  it("uses a 7-day freshness threshold", () => {
    expect(PRICE_STALE_AFTER_DAYS).toBe(7);
  });

  it("does not warn at exactly 7 days old", () => {
    expect(isPriceStale(7)).toBe(false);
  });

  it("warns from 8 days old onwards", () => {
    expect(isPriceStale(8)).toBe(true);
    expect(isPriceStale(241)).toBe(true);
  });

  it("never warns without a price age", () => {
    expect(isPriceStale(null)).toBe(false);
    expect(isPriceStale(0)).toBe(false);
  });
});
