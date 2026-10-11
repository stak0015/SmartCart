import { describe, expect, it } from "vitest";
import { cataloguePrice } from "./catalogue-price";

describe("catalogue price labels", () => {
  const range = { min_rm: 3.2, max_rm: 3.2, store_count: 0, oldest_observed_date: null };

  it("labels median prices as estimated in both languages", () => {
    const item = { price_range: { ...range, price_source: "median" as const } };
    expect(cataloguePrice(item, "en")).toBe("RM3.20 (estimated)");
    expect(cataloguePrice(item, "ms")).toBe("RM3.20 (anggaran)");
  });

  it("preserves observed ranges and single observed prices", () => {
    expect(cataloguePrice({ price_range: { ...range, max_rm: 4.5, price_source: "store" } }, "en")).toBe("RM3.20 – RM4.50");
    expect(cataloguePrice({ price_range: range }, "en")).toBe("RM3.20");
  });

  it("keeps items without either source unavailable", () => {
    expect(cataloguePrice({ price_range: null }, "en")).toBe("Price unavailable");
    expect(cataloguePrice({}, "ms")).toBe("Harga tidak tersedia");
  });
});
