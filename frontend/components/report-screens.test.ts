import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatInclusiveDateRange } from "../lib/report-format";

describe("G6 and G7 report and Statistics surfaces", () => {
  it("formats inclusive Malaysia date ranges for English and Malay", () => {
    const english = formatInclusiveDateRange("2026-09-13T16:00:00.000Z", "2026-09-20T16:00:00.000Z", "en");
    const malay = formatInclusiveDateRange("2026-09-13T16:00:00.000Z", "2026-09-20T16:00:00.000Z", "ms");
    expect(english).toContain("14");
    expect(english).toContain("20");
    expect(malay).toContain("14");
    expect(malay).toContain("20");
    expect(english).not.toContain("13 Sep");
    expect(malay).not.toContain("13 Sep");
  });

  it("removes hidden-statistics controls, stale no-upload copy, and the dead InboxScreen export", () => {
    const reportScreen = readFileSync(new URL("./report-screens.tsx", import.meta.url), "utf8");
    const journey = readFileSync(new URL("./journey-screens.tsx", import.meta.url), "utf8");
    const app = readFileSync(new URL("./smartcart-app.tsx", import.meta.url), "utf8");
    for (const source of [reportScreen, journey, app]) expect(source).not.toContain("summaryHidden");
    expect(reportScreen).not.toMatch(/Items without prices|Hide statistics|Show statistics/);
    expect(reportScreen).not.toContain("shopping history is not uploaded");
    expect(journey).not.toMatch(/export\s+(function|const)\s+InboxScreen/);
  });

  it("keeps the exact three KPI concepts, accessible chart tables, and responsive layout", () => {
    const reportScreen = readFileSync(new URL("./report-screens.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(reportScreen.match(/className="stat-metric tone-/g)).toHaveLength(3);
    expect(reportScreen).toContain("<table className=\"chart-data-table\"");
    expect(reportScreen).toContain("statistics.comparisonRangeLabel");
    expect(css).toMatch(/\.statistics-grid \{ display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    expect(css).toMatch(/\.statistics-grid \{ grid-template-columns:minmax\(0,1fr\)/);
  });

  it("renders report prose and broad category facts, previews reports, and charts broad categories in Statistics", () => {
    const reportScreen = readFileSync(new URL("./report-screens.tsx", import.meta.url), "utf8");
    const layout = readFileSync(new URL("../app/ui-layout.css", import.meta.url), "utf8");
    for (const field of ["newsletter.subject", "newsletter.preview", "newsletter.opening", "newsletter.insights", "newsletter.tip"]) {
      expect(reportScreen).toContain(field);
    }
    expect(reportScreen).toContain("<ReportFacts report={report} locale={locale}/>");
    expect(reportScreen).toContain("report.categorySpending.map(row");
    expect(reportScreen).toContain("const currentCategories = statistics.categoryRows");
    expect(reportScreen).toContain("CategoryPie rows={currentCategories}");
    expect(reportScreen).not.toContain("statistics.specificCategoryRows");
    expect(reportScreen).toContain("conic-gradient(from -90deg");
    expect(reportScreen).toContain("groupPieCategories(rows)");
    expect(reportScreen).toContain("otherCategories");
    expect(reportScreen).toContain("inbox-message-preview");
    expect(reportScreen).toContain("report-reader-content");
    expect(layout).toContain(".inbox-layout.has-selection .inbox-list-panel");
    expect(layout).toContain(".inbox-layout.has-selection .inbox-reading-pane");
    expect(reportScreen).not.toContain("CategoryBars");
  });

  it("includes a bilingual consent disclosure for backend, Cerebras, data fields, retention, and local storage", () => {
    const source = readFileSync(new URL("./report-screens.tsx", import.meta.url), "utf8");
    for (const phrase of ["English", "Bahasa Melayu", "SmartCart’s backend", "Cerebras", "bought item names", "broad shopping categories and labels", "kategori umum membeli-belah dan labelnya", "missing price markers", "does not retain the request or report", "stored on this device", "Enable AI reports", "Aktifkan laporan AI", "No thanks", "Tidak, terima kasih"]) {
      expect(source).toContain(phrase);
    }
    expect(source).not.toContain("specific catalogue source category IDs");
  });

  it("keeps generation transient, exposes retry, and confirms deletion and disable-abort behavior", () => {
    const reportScreen = readFileSync(new URL("./report-screens.tsx", import.meta.url), "utf8");
    const app = readFileSync(new URL("./smartcart-app.tsx", import.meta.url), "utf8");
    expect(reportScreen).toContain('generation.status === "generating"');
    expect(reportScreen).toContain('onRetry(generation.id)');
    expect(app).toContain('status: "failed"');
    expect(app).toContain('activeReportControllerRef.current?.abort()');
    expect(app).toContain('window.confirm(confirmation)');
    expect(app).toContain('persistInboxTransition(clearInboxReports(inboxRef.current))');
  });
});
