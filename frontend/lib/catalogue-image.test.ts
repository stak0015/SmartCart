import { describe, expect, it } from "vitest";
import { catalogueImageUrl } from "./catalogue-image";

describe("catalogueImageUrl", () => {
  it("upgrades persisted legacy PNG URLs", () => {
    expect(catalogueImageUrl("/pricecatcher/1183.png")).toBe("/pricecatcher-v1/1183.webp");
  });

  it("preserves the current versioned URL", () => {
    expect(catalogueImageUrl("/pricecatcher-v1/1183.webp")).toBe("/pricecatcher-v1/1183.webp");
  });

  it("returns null for missing images", () => {
    expect(catalogueImageUrl(null)).toBeNull();
  });
});
