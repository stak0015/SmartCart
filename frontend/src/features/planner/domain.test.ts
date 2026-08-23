import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_TRAVEL, DEMO_STORES } from "./mock-data";
import {
  basketSummary,
  filterCatalog,
  rankReachableStores,
  validateQuantity,
  validateQuantityInput,
} from "./domain";

describe("basket domain", () => {
  it("requires at least two search characters when no category is selected", () => {
    expect(filterCatalog(CATALOG, "b", "")).toEqual([]);
    expect(filterCatalog(CATALOG, "be", "").length).toBeGreaterThan(0);
  });

  it("combines category and search filters and sorts the result", () => {
    const results = filterCatalog(CATALOG, "beras", "Rice & Grains");
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.packageSize)).toEqual(["5 kg", "10 kg"]);
  });

  it("validates the user-story quantity boundary", () => {
    expect(validateQuantity(1)).toBeNull();
    expect(validateQuantity(99)).toBeNull();
    expect(validateQuantity(0)).toBeTruthy();
    expect(validateQuantity(1.5)).toBeTruthy();
    expect(validateQuantity(100)).toBeTruthy();
    expect(validateQuantityInput("12")).toBeNull();
    expect(validateQuantityInput("1.0")).toBeTruthy();
    expect(validateQuantityInput("letters")).toBeTruthy();
  });

  it("summarises item types and total units", () => {
    expect(basketSummary([{ itemId: "a", quantity: 2 }, { itemId: "b", quantity: 3 }])).toEqual({
      itemTypes: 2,
      totalUnits: 5,
    });
  });
});

describe("store recommendation domain", () => {
  it("excludes premises outside the selected travel limit", () => {
    const ranked = rankReachableStores(
      DEMO_STORES,
      [{ itemId: "rice-5kg", quantity: 1 }],
      { ...DEFAULT_TRAVEL, maxDistanceKm: 5 },
    );
    expect(ranked.every((store) => store.distanceKm <= 5)).toBe(true);
    expect(ranked.some((store) => store.id === "demo-store-7")).toBe(false);
  });

  it("includes only explicitly verified partners when the SARA filter is enabled", () => {
    const ranked = rankReachableStores(
      DEMO_STORES,
      [{ itemId: "rice-5kg", quantity: 1 }],
      { ...DEFAULT_TRAVEL, saraPartnersOnly: true },
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((store) => store.saraPartner === true)).toBe(true);
  });
});
