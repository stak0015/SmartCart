import { describe, it, expect, vi } from 'vitest';
import { costInsight, fetchPriceHistory, historyPeriod, upcomingPoints, forecastForDisplay, fourWeekForecastSignal } from './price-history';
describe('price history', () => {
  it('shows only qualified forecasts within the configured display horizon', () => {
    const forecast=Array.from({length:52},(_,i)=>({week:String(i),price:2}));
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:12})).toEqual(forecast.slice(0,12));
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:4})).toHaveLength(4);
    expect(forecastForDisplay({status:'rejected',forecast})).toEqual([]);
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:0})).toEqual([]);
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:52})).toHaveLength(12);
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:52},4)).toEqual(forecast.slice(0,4));
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:52},8)).toEqual(forecast.slice(0,8));
    expect(forecastForDisplay({status:'available',forecast,forecast_horizon_weeks:52},52)).toHaveLength(12);
    expect(forecastForDisplay({status:'available',forecast,validated_horizon_weeks:4},12)).toHaveLength(4);
    expect(forecastForDisplay({status:'available',forecast,validated_horizon_weeks:0})).toEqual([]);
    expect(forecastForDisplay({status:'available',forecast},0)).toEqual([]);
    expect(forecastForDisplay({status:'available',forecast},4.5)).toEqual([]);
  });
  it('updates quantity cost, RM difference and percentage on the same basis', () => {
    expect(costInsight(3,2,4)).toEqual({projectedCost:12,referenceCost:8,difference:4,percent:50});
    expect(costInsight(1,2,2)?.difference).toBe(-2);
    expect(costInsight(3,0,2)?.percent).toBeNull();
    expect(costInsight(3,2,null)).toBeNull();
  });
  it('filters history without replacing gaps or modifying the source', () => {
    const points=[{week:'2022-01-03',price:2},{week:'2026-06-01',price:null},{week:'2026-09-21',price:4}];
    expect(historyPeriod(points,null)).toEqual(points);
    expect(historyPeriod(points,6)).toEqual(points.slice(1));
    expect(points.length).toBe(3);
  });
  it('uses item code and explicit region, propagating failures', async () => {
    const fetcher=vi.fn().mockResolvedValue({ok:false}); vi.stubGlobal('fetch',fetcher);
    await expect(fetchPriceHistory('113','district:Selangor:Petaling',new AbortController().signal)).rejects.toThrow();
    expect(fetcher.mock.calls[0][0]).toContain('/items/113/price-history?region=district%3ASelangor%3APetaling');
    vi.unstubAllGlobals();
  });
  it('does not offer elapsed forecast weeks for purchase comparisons, using Malaysia weeks', () => {
    const points=[{week:'2026-09-28',price:2},{week:'2026-10-05',price:3},{week:'2026-10-12',price:4}];
    expect(upcomingPoints(points,new Date('2026-10-07T00:00:00Z'))).toEqual(points.slice(1));
    expect(upcomingPoints(points,new Date('2026-10-11T16:01:00Z'))).toEqual(points.slice(2));
  });
  const signalData = (prices: (number | null)[]) => ({status:'available', history:[{week:'2026-09-21',price:10}], validated_horizon_weeks:12,
    forecast: prices.map((price,i)=>({week:new Date(Date.UTC(2026,8,28+i*7)).toISOString().slice(0,10),price}))});
  const signalNow = new Date('2026-10-07T00:00:00Z');
  it('indicates significant four-week average rises and falls, excluding elapsed forecasts', () => {
    expect(fourWeekForecastSignal(signalData([100,12,12,12,12]),signalNow)).toEqual({direction:'rise',percent:20,firstWeek:'2026-10-05',lastWeek:'2026-10-26'});
    expect(fourWeekForecastSignal(signalData([100,8,8,8,8]),signalNow)?.direction).toBe('fall');
    // An isolated spike does not qualify when the four-week average changes by only 5%.
    expect(fourWeekForecastSignal(signalData([100,12,10,10,10]),signalNow)).toBeNull();
    for(const price of [9,10,11]) expect(fourWeekForecastSignal(signalData([100,price,price,price,price]),signalNow)).toBeNull();
  });
  it('requires a qualified complete consecutive window inside the validated horizon', () => {
    const data=signalData([100,12,12,12,12]);
    expect(fourWeekForecastSignal({...data,status:'rejected'},signalNow)).toBeNull();
    expect(fourWeekForecastSignal({...data,validated_horizon_weeks:4},signalNow)).toBeNull();
    expect(fourWeekForecastSignal(signalData([100,12,null,12,12]),signalNow)).toBeNull();
    expect(fourWeekForecastSignal(signalData([100,12,NaN,12,12]),signalNow)).toBeNull();
    expect(fourWeekForecastSignal(signalData([100,12,0,12,12]),signalNow)).toBeNull();
    expect(fourWeekForecastSignal({...data,history:[{week:'2026-09-21',price:0}]},signalNow)).toBeNull();
    expect(fourWeekForecastSignal({...data,forecast:data.forecast.filter((_,i)=>i!==2)},signalNow)).toBeNull();
    expect(fourWeekForecastSignal(data,new Date('2026-12-01T00:00:00Z'))).toBeNull();
    expect(fourWeekForecastSignal(null,signalNow)).toBeNull();
  });
});
