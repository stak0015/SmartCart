import { describe, expect, it } from "vitest";

import { VISIBLE_STEP, hasMoreStores, nextVisibleCount } from "./visible-stores";

describe("visible-stores pagination (AC 2.3.2)", () => {
  it("starts at five and appends exactly five per step", () => {
    expect(VISIBLE_STEP).toBe(5);
    let count = VISIBLE_STEP;
    count = nextVisibleCount(count, 25);
    expect(count).toBe(10);
    count = nextVisibleCount(count, 25);
    expect(count).toBe(15);
  });

  it("caps at the total so the last page may be smaller than five", () => {
    expect(nextVisibleCount(20, 23)).toBe(23);
  });

  it("reports no remaining stores exactly at the total", () => {
    expect(hasMoreStores(5, 25)).toBe(true);
    expect(hasMoreStores(25, 25)).toBe(false);
    expect(hasMoreStores(23, 23)).toBe(false);
    expect(hasMoreStores(5, 5)).toBe(false);
  });
});
