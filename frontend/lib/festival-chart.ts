import type { FestivalDailyPoint } from "./festival-contracts";

export type FestivalChartMode = "price" | "percent";

export interface FestivalChartDatum {
  date: string;
  relativeDay: number;
  value: number;
  percent: number | null;
}

export interface FestivalChartGeometry {
  points: string;
  minValue: number;
  maxValue: number;
  zeroX: number | null;
  zeroY: number | null;
  firstRelativeDay: number;
  lastRelativeDay: number;
}

function utcDate(value: string): number {
  return Date.parse(value + "T00:00:00Z");
}

export function relativeDay(date: string, observanceDate: string): number {
  return Math.round((utcDate(date) - utcDate(observanceDate)) / 86_400_000);
}

export function percentChange(value: number, baseline: number | null): number | null {
  if (baseline == null || !Number.isFinite(baseline) || baseline <= 0) return null;
  return ((value - baseline) / baseline) * 100;
}

export function buildChartData(
  points: FestivalDailyPoint[],
  observanceDate: string,
  baselineValue: string | null,
): FestivalChartDatum[] {
  const baseline = baselineValue == null ? null : Number(baselineValue);
  return points.map(point => {
    const value = Number(point.value);
    return {
      date: point.date,
      relativeDay: relativeDay(point.date, observanceDate),
      value,
      percent: percentChange(value, baseline),
    };
  });
}

function axisValue(value: number, min: number, max: number, start: number, end: number): number {
  if (max === min) return (start + end) / 2;
  return start + ((value - min) / (max - min)) * (end - start);
}

export function chartGeometry(
  data: FestivalChartDatum[],
  mode: FestivalChartMode,
  width = 720,
  height = 260,
  padding = 28,
): FestivalChartGeometry | null {
  const usable = data.filter(point => mode === "price" || point.percent != null);
  if (usable.length < 2) return null;

  const values = usable.map(point => mode === "percent" ? point.percent as number : point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const firstRelativeDay = Math.min(...usable.map(point => point.relativeDay));
  const lastRelativeDay = Math.max(...usable.map(point => point.relativeDay));
  const yPad = maxValue === minValue ? Math.max(Math.abs(maxValue) * 0.1, 1) : 0;
  const yMin = minValue - yPad;
  const yMax = maxValue + yPad;

  const xFor = (day: number) => axisValue(
    day,
    firstRelativeDay,
    lastRelativeDay,
    padding,
    width - padding,
  );
  const yFor = (value: number) => (
    height - padding - axisValue(value, yMin, yMax, 0, height - 2 * padding)
  );

  const points = usable
    .map(point => {
      const value = mode === "percent" ? point.percent as number : point.value;
      return xFor(point.relativeDay) + "," + yFor(value);
    })
    .join(" ");

  const zeroX = firstRelativeDay <= 0 && lastRelativeDay >= 0 ? xFor(0) : null;
  const zeroY = yMin <= 0 && yMax >= 0 ? yFor(0) : null;

  return {
    points,
    minValue,
    maxValue,
    zeroX,
    zeroY,
    firstRelativeDay,
    lastRelativeDay,
  };
}
