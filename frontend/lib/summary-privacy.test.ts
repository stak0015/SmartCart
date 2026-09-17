import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listCategories, searchItems } from "./api";
import {
  getBasketAlternatives,
  getRecommendations,
  prepareRecommendationCandidates,
  resolveLocation,
  reverseLocation,
  searchLocations,
} from "./api-client";
import { EMPTY_INBOX, serializeInboxState, setSummaryHidden } from "./inbox";

/**
 * AC 8.4.1: "no expense fields appear in any outgoing request."
 *
 * This is the enforceable half of the privacy story. The summary maths live in
 * pure modules with no network imports (asserted below), and every outbound
 * call in the app goes through the two client modules - so exercising all of
 * them against a captured fetch proves expense data never leaves the device.
 *
 * Scope note, stated plainly: the app DOES send basket line ids/quantities and
 * the chosen origin coordinates, because recommendations cannot work without
 * them. What it must never send is recorded expense data - what the shopper
 * actually paid, savings snapshots, or trip records. That is what is asserted.
 */

/** Field names that only exist on recorded expense data, never on a request. */
const EXPENSE_FIELD_NAMES = [
  "actualTotalRm",
  "actualPriceRm",
  "actualLineTotalRm",
  "actualQuantity",
  "plannedSubtotalRm",
  "plannedCombinedTotalRm",
  "estimatedSavings",
  "netSavingRm",
  "storeChoiceImpactRm",
  "itemChangeImpactRm",
  "medianCombinedCostRm",
  "selectedBaselineCombinedCostRm",
  "selectedCurrentCombinedCostRm",
  "comparableStoreCount",
  "alternativeStoreEstimates",
  "recordedAt",
  "checklistId",
  "summaryHidden",
];

/** Local storage keys holding expense data; neither may be transmitted. */
const EXPENSE_STORAGE_KEYS = ["smartcart.trip-history", "smartcart.inbox"];

function sourceOf(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const TRAVEL = {
  origin: { label: "Putrajaya", latitude: 2.9264, longitude: 101.6889, source: "search" as const },
  transportMode: "car" as const,
  limit: { type: "distance" as const, value: 10 },
  saraFilter: "any" as const,
};

afterEach(() => vi.unstubAllGlobals());

/** Calls every outbound function once and returns everything they sent. */
async function captureAllOutboundTraffic(): Promise<string> {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (...args: unknown[]) => {
    calls.push(args.map(argument => String(argument)).join(" "));
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);

  await Promise.allSettled([
    getRecommendations({ travel: TRAVEL, basket: [{ itemId: "2", quantity: 1 }] }),
    prepareRecommendationCandidates(TRAVEL),
    getBasketAlternatives("10", [{ itemId: "2", quantity: 1 }]),
    searchLocations("Putrajaya", "session-token"),
    resolveLocation("place-1", "session-token"),
    reverseLocation(2.9264, 101.6889),
    searchItems("ayam", 1, ["AYAM"]),
    listCategories(),
  ]);

  expect(fetchMock).toHaveBeenCalled();
  return calls.join("\n");
}

describe("AC 8.4.1 - expense data never leaves the device", () => {
  it("sends no expense field in any outbound request", async () => {
    const traffic = await captureAllOutboundTraffic();
    for (const fieldName of EXPENSE_FIELD_NAMES) {
      expect(traffic, `outbound traffic must not contain "${fieldName}"`).not.toContain(fieldName);
    }
  });

  it("sends no expense storage key in any outbound request", async () => {
    const traffic = await captureAllOutboundTraffic();
    for (const storageKey of EXPENSE_STORAGE_KEYS) {
      expect(traffic, `outbound traffic must not contain "${storageKey}"`).not.toContain(storageKey);
    }
  });

  it("never serialises a hidden inbox setting or a trip record into a payload", async () => {
    // The summary state is the object most likely to be leaked by a careless
    // future refactor, so it is serialised explicitly and checked for absence.
    const hidden = setSummaryHidden(EMPTY_INBOX, true);
    const serialized = serializeInboxState(hidden);
    expect(serialized).toContain("summaryHidden");

    const fetchMock = vi.fn(async (...args: unknown[]) => args.map(String).join(" "));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.allSettled([
      getRecommendations({ travel: TRAVEL }),
      getBasketAlternatives("10", [{ itemId: "2", quantity: 1 }]),
    ]);
    const traffic = fetchMock.mock.results.map(result => String(result.value)).join("\n");
    expect(traffic).not.toContain("summaryHidden");
    expect(traffic).not.toContain(serialized);
  });

  it("keeps every summary module free of network facilities", () => {
    // Same pattern as the AC 5.4.3 device-local test in trip-history.test.ts:
    // a source scan is what makes "produced on my device" checkable at all.
    for (const modulePath of ["./period-summary.ts", "./inbox.ts", "./estimated-savings.ts"]) {
      const source = sourceOf(modulePath);
      expect(source, `${modulePath} must not call fetch`).not.toMatch(/fetch\s*\(/);
      expect(source, `${modulePath} must not open a network channel`)
        .not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
      expect(source, `${modulePath} must not import an API client`)
        .not.toMatch(/api-client|api-base|from "\.\/api"|from "\.\.\/lib\/api/);
    }
  });
});

describe("AC 8.4.2 - the summary exists only when it is opened", () => {
  it("schedules no background work in the summary screen", () => {
    const source = sourceOf("../components/journey-screens.tsx");
    expect(source).not.toMatch(/setTimeout|setInterval|requestIdleCallback/);
    expect(source).not.toMatch(/\bNotification\b|serviceWorker|ServiceWorker|new\s+Worker\b/);
  });

  it("imports no effect hook, so nothing runs outside a render", () => {
    // journey-screens.tsx is a pure render component: with no useEffect or
    // useLayoutEffect there is no code path that could compute a summary in the
    // background. The maths therefore happens at the moment the screen opens.
    const source = sourceOf("../components/journey-screens.tsx");
    expect(source).not.toMatch(/useEffect|useLayoutEffect/);
    expect(source).toMatch(/periodComparison\(history, state\.cadence\)/);
  });

  it("computes the summary inside the render body, gated on visibility", () => {
    const source = sourceOf("../components/journey-screens.tsx");
    expect(source).toMatch(/state\.summaryHidden \? null : periodComparison\(history, state\.cadence\)/);
  });
});

describe("AC 8.4.3 - hiding is local, reversible and non-destructive", () => {
  it("toggles the flag without touching cadence or reports", () => {
    const hidden = setSummaryHidden(EMPTY_INBOX, true);
    expect(hidden.summaryHidden).toBe(true);
    expect(hidden.cadence).toBe(EMPTY_INBOX.cadence);
    expect(hidden.messages).toEqual(EMPTY_INBOX.messages);

    const restored = setSummaryHidden(hidden, false);
    expect(restored.summaryHidden).toBe(false);
    expect(restored.messages).toEqual(EMPTY_INBOX.messages);
  });

  it("returns the same object when the value is unchanged", () => {
    expect(setSummaryHidden(EMPTY_INBOX, false)).toBe(EMPTY_INBOX);
  });

  it("gates the whole summary section on the setting", () => {
    // Hiding must remove the section, and showing it again must bring it back -
    // so both the toggle and the two summary components stay wired to the flag.
    const source = sourceOf("../components/journey-screens.tsx");
    expect(source).toMatch(/onToggleSummary/);
    expect(source).toMatch(/aria-pressed=\{state\.summaryHidden\}/);
    expect(source).toMatch(/text\.summaryHiddenNote/);
    expect(source).toMatch(/comparison && currentPeriod \?/);
  });
});
