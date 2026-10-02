import { API_BASE_URL } from "./api-base";
import {
  ITEM_CATEGORY_IDS,
  ITEM_CATEGORY_SPENDING_CLASS,
  type ItemCategoryId,
  type ItemCategorySpendingClass,
  type SourceCategory,
} from "./contracts";
import { readReportConsent, type ConsentStorage } from "./report-consent";
import {
  periodAnalytics,
  periodAnalyticsForStart,
  type AnalyticsCadence,
} from "./period-analytics";
import { boughtLineQuantity, boughtLineTotalRm, type TripRecord } from "./trip-history";

export type ReportCadence = AnalyticsCadence;
export type ReportVisualization = "overview-kpis" | "category-pie" | "savings-breakdown" | "spending-class-bar";
export type ReportSectionId = "overview" | "categories" | "savings" | "essentials";
export type ReportCategoryId = ItemCategoryId | "uncategorised";

export interface GenerateReportRequest {
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
  locale: "en" | "ms";
  timeZone: "Asia/Kuala_Lumpur";
  trips: Array<{
    recordedAt: string;
    boughtLines: Array<{
      name: string;
      categoryId: ItemCategoryId | null;
      sourceCategory: SourceCategory | null;
      quantity: number;
      lineTotalRm: number | null;
    }>;
    estimatedSavings: {
      storeChoiceImpactRm: number | null;
      itemChangeImpactRm: number | null;
      netSavingRm: number | null;
    } | null;
  }>;
}

export interface ReportCategoryAmount {
  categoryId: ReportCategoryId;
  spendingClass: ItemCategorySpendingClass;
  amountRm: number;
  partial: boolean;
}

export interface ReportSpendingClassAmount {
  spendingClass: ItemCategorySpendingClass;
  amountRm: number | null;
}

export interface SpecificCategoryAmount {
  categoryId: string;
  labelEn: string;
  labelMs: string;
  amountRm: number;
  partial: boolean;
}

export interface ReportNewsletter {
  subject: string;
  preview: string;
  opening: string;
  insights: Array<{ heading: string; body: string }>;
  tip: string | null;
}

export interface ReportComparison {
  periodStart: string;
  periodEnd: string;
  tripCount: number;
  actualSpendingRm: number | null;
  spendingIncomplete: boolean;
  estimatedNetSavingsRm: number | null;
  storeChoiceImpactRm: number | null;
  itemChangeImpactRm: number | null;
  savingsIncomplete: boolean;
  categorySpending: ReportCategoryAmount[];
  specificCategorySpending: SpecificCategoryAmount[];
  spendingClassBreakdown: ReportSpendingClassAmount[];
}

export interface ReportSection {
  id: ReportSectionId;
  heading: string;
  observation: string;
  visualization: ReportVisualization;
}

export interface GeneratedReport {
  id: string;
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  tripCount: number;
  actualSpendingRm: number | null;
  spendingIncomplete: boolean;
  estimatedNetSavingsRm: number | null;
  storeChoiceImpactRm: number | null;
  itemChangeImpactRm: number | null;
  savingsIncomplete: boolean;
  categorySpending: ReportCategoryAmount[];
  specificCategorySpending: SpecificCategoryAmount[];
  spendingClassBreakdown: ReportSpendingClassAmount[];
  comparison: ReportComparison | null;
  sections: [ReportSection, ReportSection, ReportSection, ReportSection];
  newsletter: ReportNewsletter;
  disclosures: string[];
  generationSource: "fallback" | "llm";
}

export interface LocalInboxReport extends GeneratedReport {
  read: boolean;
}

export interface ReportPeriod {
  id: string;
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
}

export interface CategoryChartRow {
  categoryId: ReportCategoryId;
  amountRm: number;
  spendingClass: ItemCategorySpendingClass;
  partial: boolean;
  percent: number | null;
}

export interface SpecificCategoryChartRow extends SpecificCategoryAmount {
  percent: number | null;
}

const SECTION_BINDINGS: ReadonlyArray<readonly [ReportSectionId, ReportVisualization]> = [
  ["overview", "overview-kpis"],
  ["categories", "category-pie"],
  ["savings", "savings-breakdown"],
  ["essentials", "spending-class-bar"],
];
const CLASS_ORDER: readonly ItemCategorySpendingClass[] = ["essential", "discretionary", "mixed_or_unknown"];
const CATEGORY_ORDER = new Map<string, number>(ITEM_CATEGORY_IDS.map((id, index) => [id, index]));

function objectHasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).sort().join("\u0000") === [...keys].sort().join("\u0000");
}

function isInstant(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function isNumberOrNull(value: unknown, nonNegative = false): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && (!nonNegative || value >= 0));
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function categoryClass(categoryId: ReportCategoryId): ItemCategorySpendingClass {
  return categoryId === "uncategorised" ? "mixed_or_unknown" : ITEM_CATEGORY_SPENDING_CLASS[categoryId];
}

function isCategoryAmount(value: unknown): value is ReportCategoryAmount {
  if (!objectHasExactKeys(value, ["categoryId", "spendingClass", "amountRm", "partial"])) return false;
  const categoryId = value.categoryId;
  if (typeof categoryId !== "string" || !(categoryId === "uncategorised" || CATEGORY_ORDER.has(categoryId))) return false;
  return value.spendingClass === categoryClass(categoryId as ReportCategoryId)
    && typeof value.amountRm === "number" && Number.isFinite(value.amountRm) && value.amountRm >= 0
    && isBoolean(value.partial);
}

function isSortedCategoryAmounts(values: unknown): values is ReportCategoryAmount[] {
  if (!Array.isArray(values) || !values.every(isCategoryAmount)) return false;
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (seen.has(current.categoryId)) return false;
    seen.add(current.categoryId);
    const previous = values[index - 1];
    if (previous && (previous.amountRm < current.amountRm
      || (previous.amountRm === current.amountRm
        && (CATEGORY_ORDER.get(previous.categoryId) ?? ITEM_CATEGORY_IDS.length)
          > (CATEGORY_ORDER.get(current.categoryId) ?? ITEM_CATEGORY_IDS.length)))) return false;
  }
  return true;
}

function isSpecificCategoryAmount(value: unknown): value is SpecificCategoryAmount {
  if (!objectHasExactKeys(value, ["categoryId", "labelEn", "labelMs", "amountRm", "partial"])) return false;
  return typeof value.categoryId === "string" && value.categoryId.trim().length > 0
    && typeof value.labelEn === "string" && value.labelEn.trim().length > 0
    && typeof value.labelMs === "string" && value.labelMs.trim().length > 0
    && typeof value.amountRm === "number" && Number.isFinite(value.amountRm) && value.amountRm >= 0
    && isBoolean(value.partial);
}

function isSortedSpecificCategoryAmounts(values: unknown): values is SpecificCategoryAmount[] {
  if (!Array.isArray(values) || !values.every(isSpecificCategoryAmount)) return false;
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (seen.has(current.categoryId)) return false;
    seen.add(current.categoryId);
    const previous = values[index - 1];
    if (previous && (previous.amountRm < current.amountRm
      || (previous.amountRm === current.amountRm && previous.categoryId > current.categoryId))) return false;
  }
  return true;
}

function isNewsletter(value: unknown): value is ReportNewsletter {
  if (!objectHasExactKeys(value, ["subject", "preview", "opening", "insights", "tip"])) return false;
  return [value.subject, value.preview, value.opening].every(field => typeof field === "string" && field.trim().length > 0)
    && Array.isArray(value.insights) && value.insights.length <= 3
    && value.insights.every(insight => objectHasExactKeys(insight, ["heading", "body"])
      && typeof insight.heading === "string" && insight.heading.trim().length > 0
      && typeof insight.body === "string" && insight.body.trim().length > 0)
    && (value.tip === null || (typeof value.tip === "string" && value.tip.trim().length > 0));
}

function isClassBreakdown(values: unknown): values is ReportSpendingClassAmount[] {
  if (!Array.isArray(values) || values.length !== CLASS_ORDER.length) return false;
  return values.every((value, index) => objectHasExactKeys(value, ["spendingClass", "amountRm"])
    && value.spendingClass === CLASS_ORDER[index]
    && isNumberOrNull(value.amountRm, true));
}

function isComparison(value: unknown): value is ReportComparison {
  if (!objectHasExactKeys(value, [
    "periodStart", "periodEnd", "tripCount", "actualSpendingRm", "spendingIncomplete",
    "estimatedNetSavingsRm", "storeChoiceImpactRm", "itemChangeImpactRm", "savingsIncomplete",
    "categorySpending", "spendingClassBreakdown",
    "specificCategorySpending",
  ])) return false;
  return isInstant(value.periodStart) && isInstant(value.periodEnd)
    && Date.parse(value.periodStart) < Date.parse(value.periodEnd)
    && typeof value.tripCount === "number" && Number.isInteger(value.tripCount) && value.tripCount >= 1
    && isNumberOrNull(value.actualSpendingRm, true)
    && isBoolean(value.spendingIncomplete)
    && isNumberOrNull(value.estimatedNetSavingsRm)
    && isNumberOrNull(value.storeChoiceImpactRm)
    && isNumberOrNull(value.itemChangeImpactRm)
    && isBoolean(value.savingsIncomplete)
    && isSortedCategoryAmounts(value.categorySpending)
    && isSortedSpecificCategoryAmounts(value.specificCategorySpending)
    && isClassBreakdown(value.spendingClassBreakdown);
}

function isSection(value: unknown, expectedIndex: number): value is ReportSection {
  if (!objectHasExactKeys(value, ["id", "heading", "observation", "visualization"])) return false;
  const [id, visualization] = SECTION_BINDINGS[expectedIndex];
  return value.id === id && value.visualization === visualization
    && typeof value.heading === "string" && value.heading.trim().length > 0
    && typeof value.observation === "string" && value.observation.trim().length > 0;
}

function expectedRange(cadence: ReportCadence, periodStart: string): { start: string; end: string } | null {
  if (!isInstant(periodStart)) return null;
  try {
    const period = periodAnalyticsForStart([], cadence, periodStart);
    if (period.periodStart !== new Date(Date.parse(periodStart)).toISOString()) return null;
    return { start: period.periodStart, end: period.periodEnd };
  } catch {
    return null;
  }
}

export function isGeneratedReport(value: unknown): value is GeneratedReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  if (report.cadence !== "weekly" && report.cadence !== "monthly") return false;
  if (typeof report.periodStart !== "string") return false;
  const range = expectedRange(report.cadence, report.periodStart);
  return objectHasExactKeys(report, [
    "id", "cadence", "periodStart", "periodEnd", "generatedAt", "tripCount", "actualSpendingRm",
    "spendingIncomplete", "estimatedNetSavingsRm", "storeChoiceImpactRm", "itemChangeImpactRm",
    "savingsIncomplete", "categorySpending", "spendingClassBreakdown", "comparison", "sections",
    "specificCategorySpending", "newsletter", "disclosures", "generationSource",
  ])
    && typeof report.id === "string" && report.id === `${report.cadence}:${report.periodStart}`
    && isInstant(report.periodStart) && isInstant(report.periodEnd) && report.periodEnd === range?.end
    && isInstant(report.generatedAt)
    && typeof report.tripCount === "number" && Number.isInteger(report.tripCount) && report.tripCount >= 0
    && isNumberOrNull(report.actualSpendingRm, true)
    && isBoolean(report.spendingIncomplete)
    && isNumberOrNull(report.estimatedNetSavingsRm)
    && isNumberOrNull(report.storeChoiceImpactRm)
    && isNumberOrNull(report.itemChangeImpactRm)
    && isBoolean(report.savingsIncomplete)
    && isSortedCategoryAmounts(report.categorySpending)
    && isSortedSpecificCategoryAmounts(report.specificCategorySpending)
    && isClassBreakdown(report.spendingClassBreakdown)
    && (report.comparison === null || isComparison(report.comparison))
    && Array.isArray(report.sections) && report.sections.length === SECTION_BINDINGS.length
    && report.sections.every(isSection)
    && isNewsletter(report.newsletter)
    && Array.isArray(report.disclosures)
    && report.disclosures.every(disclosure => typeof disclosure === "string" && disclosure.length > 0 && disclosure.length <= 500)
    && (report.generationSource === "llm" || report.generationSource === "fallback");
}

export function validateGeneratedReport(
  value: unknown,
  expected?: Pick<ReportPeriod, "cadence" | "periodStart" | "periodEnd">,
): GeneratedReport | null {
  if (!isGeneratedReport(value)) return null;
  if (expected && (value.cadence !== expected.cadence
    || value.periodStart !== expected.periodStart
    || value.periodEnd !== expected.periodEnd)) return null;
  return value;
}

export function getEligibleReportPeriods(records: readonly TripRecord[], now: string | Date): ReportPeriod[] {
  const periods: ReportPeriod[] = [];
  for (const cadence of ["weekly", "monthly"] as const) {
    const previous = periodAnalytics(records, cadence, now).previous;
    if (!previous.hasActivity) continue;
    periods.push({
      id: `${cadence}:${previous.periodStart}`,
      cadence,
      periodStart: previous.periodStart,
      periodEnd: previous.periodEnd,
    });
  }
  return periods;
}

/** Return the active period when it has trips, otherwise the latest completed period with trips. */
export function getManualReportPeriods(records: readonly TripRecord[], now: string | Date): ReportPeriod[] {
  const periods: ReportPeriod[] = [];
  for (const cadence of ["weekly", "monthly"] as const) {
    const analytics = periodAnalytics(records, cadence, now);
    const selected = analytics.current.hasActivity ? analytics.current : analytics.previous;
    if (!selected.hasActivity) continue;
    periods.push({
      id: `${cadence}:${selected.periodStart}`,
      cadence,
      periodStart: selected.periodStart,
      periodEnd: selected.periodEnd,
    });
  }
  return periods;
}

/** A useRef-owned Set can be passed here to claim at most two automatic jobs once per session. */
export function claimAutomaticReportPeriods(
  attemptedIds: Set<string>,
  candidates: readonly ReportPeriod[],
  readyIds: ReadonlySet<string>,
): ReportPeriod[] {
  const claimed: ReportPeriod[] = [];
  for (const candidate of candidates) {
    if (claimed.length === 2) break;
    if (readyIds.has(candidate.id) || attemptedIds.has(candidate.id)) continue;
    attemptedIds.add(candidate.id);
    claimed.push(candidate);
  }
  return claimed;
}

function nameForUpload(recordLine: TripRecord["lines"][number], locale: "en" | "ms"): string {
  const localized = locale === "ms"
    ? recordLine.itemNameMs?.trim() || recordLine.itemName?.trim() || recordLine.itemNameEn?.trim()
    : recordLine.itemNameEn?.trim() || recordLine.itemName?.trim() || recordLine.itemNameMs?.trim();
  const name = localized || (locale === "ms" ? "Item tanpa nama" : "Unnamed item");
  return Array.from(name).slice(0, 200).join("");
}

function nullableFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildGenerateReportRequest(
  records: readonly TripRecord[],
  period: ReportPeriod,
  locale: "en" | "ms",
): GenerateReportRequest {
  const expected = expectedRange(period.cadence, period.periodStart);
  if (!expected || expected.start !== period.periodStart || expected.end !== period.periodEnd
    || period.id !== `${period.cadence}:${period.periodStart}`) {
    throw new TypeError("Report period does not match a Malaysia calendar period");
  }
  const previous = periodAnalyticsForStart([], period.cadence, new Date(Date.parse(period.periodStart) - 1));
  const sliceStart = Date.parse(previous.periodStart);
  const periodEnd = Date.parse(period.periodEnd);
  const trips = records.flatMap(record => {
    const recordedAt = Date.parse(record.recordedAt);
    if (!Number.isFinite(recordedAt) || recordedAt < sliceStart || recordedAt >= periodEnd) return [];
    const boughtLines = record.lines.filter(line => line.status === "bought").map(line => {
      const quantity = boughtLineQuantity(line);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new TypeError("Bought line has an invalid quantity");
      const total = boughtLineTotalRm(line);
      const lineTotalRm = total != null && Number.isFinite(total) && total >= 0 ? total : null;
      const categoryId = line.category?.id;
      return {
        name: nameForUpload(line, locale),
        categoryId: categoryId && CATEGORY_ORDER.has(categoryId) ? categoryId as ItemCategoryId : null,
        sourceCategory: line.sourceCategory ?? null,
        quantity,
        lineTotalRm,
      };
    });
    const snapshot = record.estimatedSavings;
    return [{
      recordedAt: new Date(recordedAt).toISOString(),
      boughtLines,
      estimatedSavings: snapshot == null ? null : {
        storeChoiceImpactRm: nullableFinite(snapshot.storeChoiceImpactRm),
        itemChangeImpactRm: nullableFinite(snapshot.itemChangeImpactRm),
        netSavingRm: nullableFinite(snapshot.netSavingRm),
      },
    }];
  });
  return {
    cadence: period.cadence,
    periodStart: expected.start,
    periodEnd: expected.end,
    locale,
    timeZone: "Asia/Kuala_Lumpur",
    trips,
  };
}

export async function requestGeneratedReport(
  request: GenerateReportRequest,
  storage: Pick<ConsentStorage, "getItem">,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<GeneratedReport | null> {
  if (readReportConsent(storage).status !== "accepted") return null;
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${API_BASE_URL}/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  if (!response.ok) throw new Error("Report generation request failed");
  const report = validateGeneratedReport(await response.json(), request);
  if (!report) throw new Error("Report response did not match the G4 contract");
  return report;
}

export function buildCategoryChartRows(
  categories: readonly Pick<ReportCategoryAmount, "categoryId" | "amountRm" | "spendingClass" | "partial">[],
  totalRm: number | null,
): CategoryChartRow[] {
  return categories.map(category => ({
    ...category,
    percent: totalRm != null && totalRm > 0 ? Math.round((category.amountRm / totalRm) * 1000) / 10 : null,
  }));
}

export function buildSpecificCategoryChartRows(
  categories: readonly SpecificCategoryAmount[],
  totalRm: number | null,
): SpecificCategoryChartRow[] {
  return categories.map(category => ({
    ...category,
    percent: totalRm != null && totalRm > 0 ? Math.round((category.amountRm / totalRm) * 1000) / 10 : null,
  }));
}
