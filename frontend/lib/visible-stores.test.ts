import { describe, expect, it } from "vitest";

import { VISIBLE_STEP, hasMoreStores, nextVisibleCount } from "./visible-stores";

describe("visible-stores pagination (AC 2.3.2)", () => {
  it("starts at six and appends exactly six per step", () => {
    expect(VISIBLE_STEP).toBe(6);
    let count = VISIBLE_STEP;
    count = nextVisibleCount(count, 25);
    expect(count).toBe(12);
    count = nextVisibleCount(count, 25);
    expect(count).toBe(18);
  });

  it("caps at the total so the last page may be smaller than six", () => {
    expect(nextVisibleCount(18, 23)).toBe(23);
  });

  it("reports no remaining stores exactly at the total", () => {
    expect(hasMoreStores(6, 25)).toBe(true);
    expect(hasMoreStores(25, 25)).toBe(false);
    expect(hasMoreStores(23, 23)).toBe(false);
    expect(hasMoreStores(6, 6)).toBe(false);
  });
});
