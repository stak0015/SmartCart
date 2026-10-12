import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatInclusiveDateRange } from "../lib/report-format";

describe("report screens", () => {
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

  it("includes a bilingual consent disclosure for backend, Cerebras, data fields, retention, and local storage", () => {
    const source = readFileSync(new URL("./report-screens.tsx", import.meta.url), "utf8");
    for (const phrase of ["English", "Bahasa Melayu", "SmartCart’s backend", "Cerebras", "bought item names", "broad shopping categories and labels", "kategori umum membeli-belah dan labelnya", "missing price markers", "does not retain the request or report", "stored on this device", "Enable AI reports", "Aktifkan laporan AI", "No thanks", "Tidak, terima kasih"]) {
      expect(source).toContain(phrase);
    }
    expect(source).not.toContain("specific catalogue source category IDs");
  });

});
