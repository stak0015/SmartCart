import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ItemCategory } from "./contracts";
import { writeReportConsent, REPORT_CONSENT_STORAGE_KEY } from "./report-consent";
import {
  buildCategoryChartRows,
  buildGenerateReportRequest,
  claimAutomaticReportPeriods,
  getEligibleReportPeriods,
  getManualReportPeriods,
  requestGeneratedReport,
  validateGeneratedReport,
  type GeneratedReport,
  type ReportPeriod,
} from "./report-generation";
import type { TripRecord } from "./trip-history";

const fixture = JSON.parse(readFileSync(new URL(
  "../../tests/fixtures/reports/G4-report-response.json",
  import.meta.url,
), "utf8")) as { request: Parameters<typeof requestGeneratedReport>[0]; expected: GeneratedReport };

const category: ItemCategory = {
  id: "staples", labelEn: "Rice, Noodles & Bread", labelMs: "Beras, Mi & Roti", spendingClass: "essential",
};

function trip(id: string, recordedAt: string): TripRecord {
  return {
    version: 3,
    id,
    recordedAt,
    checklistId: "CHECKLIST_SECRET",
    store: { premiseId: "PREMISE_SECRET", premiseCode: "STORE_SECRET", name: "STORE_NAME_SECRET", address: "ADDRESS_SECRET" },
    plannedSubtotalRm: 88,
    estimatedRoundTripCostRm: 12,
    plannedCombinedTotalRm: 100,
    alternativeStoreEstimates: [{ premiseId: "ALTERNATIVE_SECRET", name: "ALTERNATIVE_NAME_SECRET", estimatedRoundTripCostRm: 4, estimatedTotalCostRm: 34 }],
    estimatedSavings: {
      medianCombinedCostRm: 55,
      selectedBaselineCombinedCostRm: 50,
      selectedCurrentCombinedCostRm: 40,
      storeChoiceImpactRm: 2.25,
      itemChangeImpactRm: -0.75,
      netSavingRm: 1.5,
      comparableStoreCount: 4,
      estimatedPriceCount: 0,
      routeEstimated: false,
    },
    actualTotalRm: 8,
    lines: [
      {
        id: "LINE_SECRET", source: "catalogue", catalogueItemId: "CATALOGUE_SECRET",
        itemName: "Rice", itemNameEn: "Rice EN", itemNameMs: "Beras MS", category,
        imageUrl: "IMAGE_SECRET", packageSize: "1 kg", quantity: 2, actualQuantity: 3,
        quantitySource: "actual", unitPriceRm: 2, priceSource: "store", observedDate: null,
        actualPriceRm: 2.5, actualLineTotalRm: 7.5, status: "bought",
      },
      {
        id: "UNBOUGHT_LINE_SECRET", source: "manual", catalogueItemId: null,
        itemName: "UNBOUGHT_NAME_SECRET", itemNameEn: "UNBOUGHT_NAME_SECRET", itemNameMs: "UNBOUGHT_NAME_SECRET", category: null,
        packageSize: null, quantity: 1, actualQuantity: null, quantitySource: "planned", unitPriceRm: 1,
        priceSource: "manual", observedDate: null, actualPriceRm: null, actualLineTotalRm: null, status: "neutral",
      },
    ],
  };
}

function storage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
    setRaw(next: string | null) { value = next; },
  };
}

function reportResponse(body: unknown = fixture.expected) {
  return { ok: true, json: async () => body } as Response;
}

describe("G6 report request construction and session policy", () => {
  it("selects only the immediately preceding completed Malaysia week/month with activity", () => {
    const records = [
      trip("week", "2026-09-15T03:00:00.000Z"),
      trip("month", "2026-08-12T03:00:00.000Z"),
    ];
    expect(getEligibleReportPeriods(records, "2026-09-26T12:00:00.000Z")).toEqual([
      { id: "weekly:2026-09-13T16:00:00.000Z", cadence: "weekly", periodStart: "2026-09-13T16:00:00.000Z", periodEnd: "2026-09-20T16:00:00.000Z" },
      { id: "monthly:2026-07-31T16:00:00.000Z", cadence: "monthly", periodStart: "2026-07-31T16:00:00.000Z", periodEnd: "2026-08-31T16:00:00.000Z" },
    ]);
  });

  it("selects the active period for manual generation when it has activity and otherwise falls back to the latest completed month", () => {
    const now = "2026-09-26T12:00:00.000Z";
    const active = getManualReportPeriods([trip("active", "2026-09-26T03:00:00.000Z")], now);
    expect(active).toEqual([
      { id: "weekly:2026-09-20T16:00:00.000Z", cadence: "weekly", periodStart: "2026-09-20T16:00:00.000Z", periodEnd: "2026-09-27T16:00:00.000Z" },
      { id: "monthly:2026-08-31T16:00:00.000Z", cadence: "monthly", periodStart: "2026-08-31T16:00:00.000Z", periodEnd: "2026-09-30T16:00:00.000Z" },
    ]);

    expect(getManualReportPeriods([trip("last-month", "2026-08-12T03:00:00.000Z")], now)).toEqual([
      { id: "monthly:2026-07-31T16:00:00.000Z", cadence: "monthly", periodStart: "2026-07-31T16:00:00.000Z", periodEnd: "2026-08-31T16:00:00.000Z" },
    ]);
  });

  it("claims stable report IDs once across Strict Mode effect replays and caps a session at two", () => {
    const candidates: ReportPeriod[] = ["weekly", "monthly", "weekly"].map((cadence, index) => ({
      cadence: cadence as "weekly" | "monthly",
      periodStart: `2026-09-0${index + 1}T16:00:00.000Z`,
      periodEnd: `2026-09-0${index + 8}T16:00:00.000Z`,
      id: `${cadence}:2026-09-0${index + 1}T16:00:00.000Z`,
    }));
    const attempted = new Set<string>();
    const ready = new Set([candidates[1].id]);
    expect(claimAutomaticReportPeriods(attempted, candidates, ready).map(item => item.id)).toEqual([candidates[0].id, candidates[2].id]);
    expect(claimAutomaticReportPeriods(attempted, candidates, ready)).toEqual([]);
  });

  it("serializes only the exact G4 allowlist and only bought lines", () => {
    const record = trip("TRIP_ID_SECRET", "2026-09-15T03:00:00.000Z");
    record.lines[0].sourceCategory = { id: "BERAS", labelEn: "Rice", labelMs: "Beras" };
    const period: ReportPeriod = {
      id: "weekly:2026-09-13T16:00:00.000Z", cadence: "weekly",
      periodStart: "2026-09-13T16:00:00.000Z", periodEnd: "2026-09-20T16:00:00.000Z",
    };
    const request = buildGenerateReportRequest([
      trip("comparison", "2026-09-08T02:00:00.000Z"), record,
      trip("unrelated", "2026-08-12T03:00:00.000Z"),
    ], period, "ms");
    expect(Object.keys(request)).toEqual(["cadence", "periodStart", "periodEnd", "locale", "timeZone", "trips"]);
    expect(request.trips).toHaveLength(2);
    expect(request.trips[1]).toEqual({
      recordedAt: record.recordedAt,
      boughtLines: [{ name: "Beras MS", categoryId: "staples", sourceCategory: { id: "BERAS", labelEn: "Rice", labelMs: "Beras" }, quantity: 3, lineTotalRm: 7.5 }],
      estimatedSavings: { storeChoiceImpactRm: 2.25, itemChangeImpactRm: -0.75, netSavingRm: 1.5 },
    });
    const serialized = JSON.stringify(request);
    for (const secret of ["TRIP_ID_SECRET", "CHECKLIST_SECRET", "PREMISE_SECRET", "STORE_SECRET", "STORE_NAME_SECRET", "ADDRESS_SECRET", "ALTERNATIVE_SECRET", "ALTERNATIVE_NAME_SECRET", "LINE_SECRET", "CATALOGUE_SECRET", "IMAGE_SECRET", "UNBOUGHT_NAME_SECRET", "plannedCombinedTotalRm", "routeEstimated"]) {
      expect(serialized).not.toContain(secret);
    }
    for (const recordRequest of request.trips) {
      expect(Object.keys(recordRequest)).toEqual(["recordedAt", "boughtLines", "estimatedSavings"]);
      for (const line of recordRequest.boughtLines) expect(Object.keys(line)).toEqual(["name", "categoryId", "sourceCategory", "quantity", "lineTotalRm"]);
    }
  });

  it("uses current locale and localizes item names while converting absent/unusable savings to null", () => {
    const record = trip("x", "2026-09-15T03:00:00.000Z");
    record.estimatedSavings = null;
    const period = getEligibleReportPeriods([record], "2026-09-26T12:00:00.000Z")[0];
    expect(buildGenerateReportRequest([record], period, "en").trips[0]).toMatchObject({
      boughtLines: [{ name: "Rice EN" }], estimatedSavings: null,
    });
  });
});

describe("G4 response validation and consent-gated network requests", () => {
  it("accepts only the complete frozen response with exact stable ID and section bindings", () => {
    expect(validateGeneratedReport(fixture.expected, fixture.request)).toEqual(fixture.expected);
    expect(validateGeneratedReport({ ...fixture.expected, id: "weekly:2026-09-13" })).toBeNull();
    expect(validateGeneratedReport({ ...fixture.expected, sections: fixture.expected.sections.slice(1) })).toBeNull();
    expect(validateGeneratedReport({ ...fixture.expected, additional: true })).toBeNull();
    expect(validateGeneratedReport({ ...fixture.expected, categorySpending: [{ ...fixture.expected.categorySpending[0], spendingClass: "discretionary" }] })).toBeNull();
  });

  it("sends zero report requests before acceptance, after decline, for bad storage, and after disable", async () => {
    const fetcher = vi.fn(async () => reportResponse());
    const stores = [
      storage(),
      storage(JSON.stringify({ version: 2, status: "accepted", decidedAt: "2026-09-26T12:00:00Z" })),
      storage("{broken"),
    ];
    for (const candidate of stores) await expect(requestGeneratedReport(fixture.request, candidate, { fetcher })).resolves.toBeNull();

    const declined = storage();
    writeReportConsent(declined, "declined", "2026-09-26T12:00:00.000Z");
    await expect(requestGeneratedReport(fixture.request, declined, { fetcher })).resolves.toBeNull();

    const acceptedThenDisabled = storage();
    writeReportConsent(acceptedThenDisabled, "accepted", "2026-09-26T12:00:00.000Z");
    writeReportConsent(acceptedThenDisabled, "declined", "2026-09-26T12:01:00.000Z");
    await expect(requestGeneratedReport(fixture.request, acceptedThenDisabled, { fetcher })).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("permits an accepted consent to send exactly one allowlisted report request", async () => {
    const accepted = storage();
    writeReportConsent(accepted, "accepted", "2026-09-26T12:00:00.000Z");
    const fetcher = vi.fn(async () => reportResponse());
    await expect(requestGeneratedReport(fixture.request, accepted, { fetcher })).resolves.toEqual(fixture.expected);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/reports\/generate$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(fixture.request);
    expect(Object.keys(JSON.parse(String(init.body)))).toEqual(["cadence", "periodStart", "periodEnd", "locale", "timeZone", "trips"]);
  });

  it("keeps a failed request retryable and accepts a successful retry without storing a job", async () => {
    const accepted = storage();
    writeReportConsent(accepted, "accepted", "2026-09-26T12:00:00.000Z");
    let attempt = 0;
    const fetcher = vi.fn(async () => {
      if (attempt++ === 0) throw new Error("temporary network failure");
      return reportResponse();
    });

    await expect(requestGeneratedReport(fixture.request, accepted, { fetcher })).rejects.toThrow("temporary network failure");
    await expect(requestGeneratedReport(fixture.request, accepted, { fetcher })).resolves.toEqual(fixture.expected);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not treat a failed accepted-consent write/readback as authorization", async () => {
    const blocked = storage();
    blocked.getItem.mockReturnValue(null);
    expect(writeReportConsent(blocked, "accepted", "2026-09-26T12:00:00.000Z")).toBeNull();
    expect(blocked.getItem).toHaveBeenCalledWith(REPORT_CONSENT_STORAGE_KEY);
    const fetcher = vi.fn(async () => reportResponse());
    await expect(requestGeneratedReport(fixture.request, blocked, { fetcher })).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("builds localized chart data in analytics order and discloses unavailable percentages", () => {
    expect(buildCategoryChartRows([
      { categoryId: "fresh-produce", spendingClass: "essential", amountRm: 9.45, partial: true },
      { categoryId: "snacks-convenience", spendingClass: "discretionary", amountRm: 2.25, partial: true },
    ], 11.7).map(row => row.percent)).toEqual([80.8, 19.2]);
    expect(buildCategoryChartRows([
      { categoryId: "staples", spendingClass: "essential", amountRm: 2, partial: false },
    ], null)[0].percent).toBeNull();
  });
});
