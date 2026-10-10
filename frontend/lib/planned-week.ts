/** Purchase weeks use Malaysia's calendar and run Monday through Sunday. */
export function currentPlannedWeek(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export function plannedWeekOptions(now = new Date()): string[] {
  const start = new Date(`${currentPlannedWeek(now)}T00:00:00Z`);
  return Array.from({ length: 5 }, (_, offset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset * 7);
    return date.toISOString().slice(0, 10);
  });
}

export function isPlannedWeek(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

export function plannedWeekLabel(week: string | null | undefined, locale: "en" | "ms"): string {
  if (!week) return locale === "en" ? "Week not set" : "Minggu belum ditetapkan";
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const format = new Intl.DateTimeFormat(locale === "en" ? "en-MY" : "ms-MY", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  });
  return `${format.format(start)} – ${format.format(end)}`;
}
