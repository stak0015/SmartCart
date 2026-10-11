import type { Locale } from "./i18n";

export const REPORT_LANGUAGE_STORAGE_KEY = "smartcart.report-language.v1";

/** The language AI reports are written in; null until the shopper picks one. */
export function readReportLanguage(storage: Pick<Storage, "getItem">): Locale | null {
  try {
    const value = storage.getItem(REPORT_LANGUAGE_STORAGE_KEY);
    return value === "en" || value === "ms" ? value : null;
  } catch {
    return null;
  }
}

export function writeReportLanguage(storage: Pick<Storage, "setItem">, language: Locale): void {
  try {
    storage.setItem(REPORT_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The choice still applies for this session.
  }
}
