import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  periodAnalytics,
  type AnalyticsTripRecord,
  type PeriodAnalyticsComparison,
} from "./period-analytics";

interface GoldenFixture {
  id: string;
  cadence: "weekly" | "monthly";
  now: string;
  records: AnalyticsTripRecord[];
  expected: PeriodAnalyticsComparison;
}

const fixturePath = fileURLToPath(new URL(
  "../../tests/fixtures/reports/G3-analytics-golden.json",
  import.meta.url,
));
const fixtures = (JSON.parse(readFileSync(fixturePath, "utf8")) as { fixtures: GoldenFixture[] }).fixtures;

describe("periodAnalytics shared golden fixtures", () => {
  it.each(fixtures)("matches the cross-language expected result: $id", fixture => {
    const result = periodAnalytics(fixture.records, fixture.cadence, fixture.now);
    // G3 fixtures freeze the original broad-category contract. Specific
    // catalogue categories are an additive report/statistics view.
    expect({
      ...result,
      current: { ...result.current, specificCategoryTotals: undefined },
      previous: { ...result.previous, specificCategoryTotals: undefined },
    }).toEqual({
      ...fixture.expected,
      current: { ...fixture.expected.current, specificCategoryTotals: undefined },
      previous: { ...fixture.expected.previous, specificCategoryTotals: undefined },
    });
  });

  it("reconciles category totals to confirmed spending and honors actual quantity", () => {
    const fixture = fixtures.find(value => value.id === "weekly-bought-categories-signed-savings");
    if (!fixture) throw new Error("Missing weekly analytics fixture");
    const { current } = periodAnalytics(fixture.records, fixture.cadence, fixture.now);

    expect(current.actualSpendingRm).toBe(28);
    expect(current.categoryTotals.reduce((sum, category) => sum + category.amountRm, 0))
      .toBe(current.actualSpendingRm);
    expect(current.categoryTotals[1]).toMatchObject({ categoryId: "staples", amountRm: 6 });
    expect(current.categoryTotals.every(category => category.partial)).toBe(true);
    expect(current.missingPriceCount).toBe(1);
    expect(current.spendingClassTotals).toEqual({ essential: 9, discretionary: 10, mixed_or_unknown: 9 });
  });

  it("keeps absent spending null and preserves signed savings and empty prior ranges", () => {
    const noPrices = fixtures.find(value => value.id === "monthly-no-priced-lines-null-savings-and-invalid-time");
    const gap = fixtures.find(value => value.id === "weekly-adjacent-empty-does-not-backfill");
    if (!noPrices || !gap) throw new Error("Missing null or adjacency fixture");
    const nullMetrics = periodAnalytics(noPrices.records, noPrices.cadence, noPrices.now);
    const gapMetrics = periodAnalytics(gap.records, gap.cadence, gap.now);

    expect(nullMetrics.current.actualSpendingRm).toBeNull();
    expect(nullMetrics.current.savings.netSaving.amountRm).toBe(-2);
    expect(nullMetrics.previous.periodStart).toBe("2026-02-28T16:00:00.000Z");
    expect(gapMetrics.previous.hasActivity).toBe(false);
    expect(gapMetrics.previous.periodEnd).toBe(gapMetrics.current.periodStart);

    const complete = fixtures.find(value => value.id === "monthly-malaysia-midnight-year-rollover");
    if (!complete) throw new Error("Missing complete spending fixture");
    const completeMetrics = periodAnalytics(complete.records, complete.cadence, complete.now);
    expect(completeMetrics.current.categoryTotals.every(category => !category.partial)).toBe(true);
  });
});
