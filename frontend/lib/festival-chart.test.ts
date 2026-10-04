import { describe, expect, it } from "vitest";

import { buildChartData, chartGeometry, percentChange, relativeDay } from "./festival-chart";

describe("festival chart helpers", () => {
  it("computes relative days around the festival date", () => {
    expect(relativeDay("2026-02-01", "2026-02-01")).toBe(0);
    expect(relativeDay("2026-01-30", "2026-02-01")).toBe(-2);
    expect(relativeDay("2026-02-03", "2026-02-01")).toBe(2);
  });

  it("computes percentage change from baseline", () => {
    expect(percentChange(11, 10)).toBeCloseTo(10);
    expect(percentChange(9, 10)).toBeCloseTo(-10);
    expect(percentChange(10, null)).toBeNull();
  });

  it("builds chart data with relative days and percent change", () => {
    const data = buildChartData(
      [
        { date: "2026-01-31", value: "10" },
        { date: "2026-02-01", value: "11" },
      ],
      "2026-02-01",
      "10",
    );
    expect(data[0]).toMatchObject({ relativeDay: -1, value: 10, percent: 0 });
    expect(data[1].relativeDay).toBe(0);
    expect(data[1].percent).toBeCloseTo(10);
  });

  it("returns geometry with festival and baseline guides", () => {
    const data = buildChartData(
      [
        { date: "2026-01-31", value: "10" },
        { date: "2026-02-01", value: "11" },
        { date: "2026-02-02", value: "12" },
      ],
      "2026-02-01",
      "10",
    );
    const geometry = chartGeometry(data, "price");
    expect(geometry).not.toBeNull();
    expect(geometry?.points.split(" ")).toHaveLength(3);
    expect(geometry?.zeroX).not.toBeNull();
    expect(geometry?.minValue).toBe(10);
    expect(geometry?.maxValue).toBe(12);
  });
});
