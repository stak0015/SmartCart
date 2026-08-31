import { describe, expect, it } from "vitest";

import { formatRm } from "./format-rm";

describe("formatRm", () => {
  it("renders zero verbatim as RM0 (AC 2.3.4)", () => {
    expect(formatRm(0)).toBe("RM0");
  });

  it("renders other amounts with two decimals", () => {
    expect(formatRm(33.49)).toBe("RM33.49");
    expect(formatRm(14.3)).toBe("RM14.30");
  });

  it("keeps credit + cash reconciled to the displayed total", () => {
    const total = 24.3;
    const credit = 14.31;
    const cash = 9.99;
    expect(credit + cash).toBeCloseTo(total, 2);
    expect(formatRm(credit)).toBe("RM14.31");
    expect(formatRm(cash)).toBe("RM9.99");
  });
});
