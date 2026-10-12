import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReceiptHistoryScreen } from "./shopping-history";
import { createPlanShoppingChecklist } from "@/lib/shopping-checklist";
import { buildTripRecord } from "@/lib/trip-history";
import { basket, plan, stores } from "../tests/fixtures/store-plan";

function recordedTrip() {
  const checklist = createPlanShoppingChecklist(plan, stores, basket);
  return buildTripRecord({ ...checklist, items: checklist.items.map(item => ({ ...item, status: "bought" as const })) }, { recordId: "history-trip", recordedAt: "2026-10-10T08:00:00Z" });
}

describe("shopping history", () => {
  it("shows both store logos and groups purchases by their assigned store", () => {
    const html = renderToStaticMarkup(<ReceiptHistoryScreen history={[recordedTrip()]} locale="en" onDeleteTrip={() => {}}/>);
    expect(html).toContain("/chain-logos-v1/lotus.webp");
    expect(html).toContain("/chain-logos-v1/mydin.webp");
    expect(html).toContain("Multi-store trip");
    expect(html).toContain("Store 1");
    expect(html).toContain("Store 2");
    expect(html).toContain("RM65.00");
    expect(html).toContain("RM68.00");
    const body = html.slice(html.indexOf('class="history-trip-body"'));
    expect(body).toContain("/chain-logos-v1/lotus.webp");
    expect(body).toContain("/chain-logos-v1/mydin.webp");
    expect(body.indexOf("Lotus")).toBeLessThan(body.indexOf("Rice"));
    expect(body.indexOf("MYDIN")).toBeLessThan(body.indexOf("Milk"));
  });

  it("keeps unassigned purchases separate and discloses partial totals", () => {
    const record = recordedTrip();
    const line = { ...record.lines[0], id: "unassigned", storePremiseId: undefined, storeName: undefined, itemName: "Custom purchase", itemNameEn: null, unitPriceRm: null, actualPriceRm: null };
    const html = renderToStaticMarkup(<ReceiptHistoryScreen history={[{ ...record, lines: [...record.lines, line] }]} locale="en" onDeleteTrip={() => {}}/>);
    expect(html).toContain("Other purchases");
    expect(html).toContain("Custom purchase");
    expect(html).toContain("Partial spending total");
    expect(html).toContain("Spending includes priced items only");
  });

  it("supports old single-store records and missing travel estimates", () => {
    const record = recordedTrip();
    const html = renderToStaticMarkup(<ReceiptHistoryScreen history={[{ ...record, stores: undefined, store: record.stores![0], estimatedRoundTripCostRm: null, lines: record.lines.map(line => ({ ...line, storePremiseId: undefined })) }]} locale="en" onDeleteTrip={() => {}}/>);
    expect(html).toContain("Single-store trip");
    expect(html).toContain('aria-label="Purchased items"');
    expect(html).toContain('class="history-combined-total"><span>Items + estimated travel</span><strong>—</strong>');
  });

  it("renders bilingual empty history and keeps the delete action", () => {
    const empty = renderToStaticMarkup(<ReceiptHistoryScreen history={[]} locale="ms" onDeleteTrip={() => {}}/>);
    expect(empty).toContain("Belum ada perjalanan direkodkan");
    const html = renderToStaticMarkup(<ReceiptHistoryScreen history={[recordedTrip()]} locale="ms" onDeleteTrip={() => {}}/>);
    expect(html).toContain("Kedai 2");
    expect(html).toContain("Padam perjalanan");
    expect(html).toContain("Anggaran perjalanan");
  });

  it("starts receipts closed and keeps deletion outside the collapsed content", () => {
    const html = renderToStaticMarkup(<ReceiptHistoryScreen history={[recordedTrip()]} locale="en" onDeleteTrip={() => {}}/>);
    const receiptStart = html.indexOf('<details class="history-receipt">');
    expect(receiptStart).toBeGreaterThan(0);
    expect(html.indexOf('class="history-delete"')).toBeLessThan(receiptStart);
    expect(html).not.toContain('<details class="history-receipt" open');
    expect(html).not.toContain("Saved planning estimates");
    expect(html).not.toContain("Planned basket + travel");
  });
});
