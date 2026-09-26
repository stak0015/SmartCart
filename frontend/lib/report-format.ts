import type { Locale } from "./i18n";

function localMalaysiaDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

export function formatInclusiveDateRange(periodStart: string, periodEnd: string, locale: Locale): string {
  return `${localMalaysiaDate(periodStart, locale)} – ${localMalaysiaDate(new Date(Date.parse(periodEnd) - 1).toISOString(), locale)}`;
}
