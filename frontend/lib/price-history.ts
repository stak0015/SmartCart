import { API_BASE_URL } from './api-base';

export type PricePoint = { week: string; price: number | null; stores?: number; observations?: number };
export type PriceHistory = {
  item?: string; unit?: string; region: string | null; region_id: string | null;
  regions: { id: string; label: string; status: string }[];
  history: PricePoint[]; forecast: PricePoint[]; status: string; reasons: string[];
  source: string; aggregation: string; latest_observation?: string;
  generated_at: string; data_cutoff: string; model?: string;
  forecast_horizon_weeks?: number; validated_horizon_weeks?: number; annual_forecast_experimental?: boolean;
  short_diagnostics?: { test_paths: number; worst_relative_mae: number | null; baseline_mae_ratio: number | null };
  annual_diagnostics?: {test_paths: number; mae: number | null; relative_mae: number | null; worst_relative_mae: number | null;
    overlapping_test_paths?: boolean; historical_archive_reused?: boolean; shape_correlation?: number | null};
};

export function forecastForDisplay(data: Pick<PriceHistory, 'status' | 'forecast' | 'forecast_horizon_weeks' | 'validated_horizon_weeks'> | null, displayWeeks = 12) {
  if (!data || data.status !== 'available') return [];
  const horizon = data.forecast_horizon_weeks ?? 52;
  const validated = data.validated_horizon_weeks ?? 12;
  if (![horizon, validated, displayWeeks].every(value => Number.isInteger(value) && value > 0)) return [];
  return data.forecast.slice(0, Math.min(12, displayWeeks, horizon, validated));
}

export function fourWeekForecastSignal(data: Pick<PriceHistory, 'status' | 'history' | 'forecast' | 'forecast_horizon_weeks' | 'validated_horizon_weeks'> | null, now = new Date()) {
  if (!data) return null;
  const anchor = data.history.filter(p => p.price !== null).at(-1)?.price;
  if (anchor == null || !Number.isFinite(anchor) || anchor <= 0) return null;
  // Use the full validated display horizon, independent of the chart selection.
  const window = upcomingPoints(forecastForDisplay(data), now).slice(0, 4);
  if (window.length !== 4 || window.some((p, i) => p.price == null || !Number.isFinite(p.price) || p.price <= 0 ||
    (i > 0 && Date.parse(p.week) - Date.parse(window[i-1].week) !== 7 * 86400000))) return null;
  const average = window.reduce((sum, p) => sum + p.price!, 0) / 4;
  const difference = average - anchor;
  // Avoid treating floating-point roundoff at exactly 10% as a threshold crossing.
  if (Math.abs(difference) <= anchor * .1 + Number.EPSILON * Math.max(anchor, average) * 4) return null;
  return { direction: difference > 0 ? 'rise' as const : 'fall' as const,
    percent: difference / anchor * 100, firstWeek: window[0].week, lastWeek: window[3].week };
}

export async function fetchPriceHistory(code: string, region: string, signal: AbortSignal): Promise<PriceHistory> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  const response = await fetch(`${API_BASE_URL}/items/${encodeURIComponent(code)}/price-history?${params}`, { signal });
  if (!response.ok) throw new Error('Price history could not be loaded. Try again.');
  return response.json();
}

export function costInsight(projected: number | null, reference: number | null, quantity: number | null) {
  if (projected === null || reference === null || quantity === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { projectedCost: projected * quantity, referenceCost: reference * quantity,
    difference: (projected - reference) * quantity, percent: reference > 0 ? (projected-reference)/reference*100 : null };
}

export function historyPeriod(points: PricePoint[], months: number | null) {
  if (months === null || !points.length) return points;
  const end = new Date(`${points[points.length-1].week}T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() - months);
  return points.filter(p => new Date(`${p.week}T00:00:00Z`) >= end);
}

export function upcomingPoints(points: PricePoint[], now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type===name)?.value;
  const monday = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  return points.filter(p => p.week >= monday.toISOString().slice(0,10));
}
