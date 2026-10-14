import { describe, expect, it } from "vitest";
import { estimateLabel, priceRangeText } from "./estimate-label";

describe("estimated price labels (AC 2.4.10)", () => {
  it("names the range an estimate comes from", () => {
    expect(estimateLabel({ estimateLowRm: 2.8, estimateHighRm: 3.6 }, "en")).toBe("Estimated from a range of RM2.80 – RM3.60");
    expect(estimateLabel({ estimateLowRm: 2.8, estimateHighRm: 3.6 }, "ms")).toBe("Anggaran daripada julat RM2.80 – RM3.60");
  });

  it("never says the price is unavailable when no range is known", () => {
    expect(estimateLabel({}, "en")).toBe("Estimated price");
    expect(estimateLabel({ estimateLowRm: null, estimateHighRm: 3 }, "ms")).toBe("Anggaran harga");
  });

  it("shows a single price when the range is flat", () => {
    expect(priceRangeText(3, 3)).toBe("RM3.00");
  });
});
