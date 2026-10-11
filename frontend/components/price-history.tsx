"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchPriceHistory, historyPeriod, forecastForDisplay, fourWeekForecastSignal, type PriceHistory } from '@/lib/price-history';
import type { Locale } from '@/lib/i18n';
import { UIIcon } from './ui-icon';

const PriceSeriesChart = dynamic(() => import('./price-series-chart'), {ssr:false,loading:()=><div className="price-chart-placeholder" aria-busy="true"/>});

export function ItemPriceHistory({ code, locale, onClose }: { code: string; quantity: number | null; locale: Locale; onClose: () => void }) {
  const [data, setData] = useState<PriceHistory | null>(null);
  const [months, setMonths] = useState<number | null>(12);
  const [forecastWeeks, setForecastWeeks] = useState(12);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const t = (en: string, ms: string) => locale === 'en' ? en : ms;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setData(null); setForecastWeeks(12);
    fetchPriceHistory(code, '', controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [code, retry]);
  const history = historyPeriod(data?.history ?? [], months);
  const availableForecast = forecastForDisplay(data);
  const forecast = forecastForDisplay(data, forecastWeeks);
  const signal = fourWeekForecastSignal(data);
  const hasPrices = history.some(p => p.price !== null) || forecast.length > 0;
  return <section className="item-price-history" aria-label={t('Price trends','Trend harga')}>
    <header className="price-trends-header"><h3>{t('Price trends','Trend harga')}</h3><button type="button" className="icon-button" onClick={onClose} aria-label={t('Close price trends','Tutup trend harga')}><UIIcon name="close"/></button></header>
    {loading && <p role="status">{t('Loading history…','Memuatkan sejarah…')}</p>}
    {error && <p role="alert">{t('Price history could not be loaded.','Sejarah harga tidak dapat dimuatkan.')} <button type="button" className="price-retry" onClick={() => setRetry(v => v+1)}>{t('Retry','Cuba lagi')}</button></p>}
    {data && <>
      <p className="price-trends-meta">{t('National','Nasional')} · {data.unit} · {t('Updated','Dikemas kini')} {data.latest_observation ?? '—'}</p>
      {signal && <div className={`price-forecast-signal price-forecast-signal-${signal.direction}`} role="status">
        <span className="price-forecast-signal-arrow" aria-hidden="true">{signal.direction === 'rise' ? '↗' : '↘'}</span>
        <div><strong>{signal.direction === 'rise' ? t('Price rise forecast','Unjuran kenaikan harga') : t('Price drop forecast','Unjuran penurunan harga')} · {signal.percent > 0 ? '+' : '−'}{Math.abs(signal.percent).toFixed(1)}%</strong>
          <p>{t('Upcoming 4-week average vs latest recorded price','Purata 4 minggu akan datang berbanding harga rekod terkini')} · {t('Forecast estimate','Anggaran unjuran')}</p>
          <small>{signal.firstWeek} – {signal.lastWeek}</small>
        </div>
      </div>}
      <div className="price-control-row"><span>{t('History','Sejarah')}</span><div className="price-period-controls" aria-label={t('Historical period','Tempoh sejarah')}>{([[3,'3m'],[6,'6m'],[12,'1y'],[null,t('All','Semua')]] as const).map(([value,label]) => <button key={String(value)} type="button" aria-label={value === null ? t('All available','Semua tersedia') : value === 12 ? t('1 year','1 tahun') : `${value} ${t('months','bulan')}`} aria-pressed={months === value} onClick={() => setMonths(value)}>{label}</button>)}</div></div>
      {availableForecast.length > 0 && <div className="price-control-row"><span>{t('Forecast','Unjuran')}</span><div className="price-period-controls" role="group" aria-label={t('Forecast period','Tempoh unjuran')}>{[4,8,12].map(value => <button key={value} type="button" aria-label={`${value} ${t('weeks','minggu')}`} aria-pressed={forecast.length === value} disabled={availableForecast.length < value} onClick={() => setForecastWeeks(value)}>{value}{t('w','m')}</button>)}</div></div>}
      {hasPrices ? <PriceSeriesChart history={history} forecast={forecast} unit={data.unit ?? ''} locale={locale}/> : <p>{t('No history for this period.','Tiada sejarah bagi tempoh ini.')}</p>}
      {data.status !== 'available' && <p className="price-history-only" role="status">{t('History only · forecast unavailable','Sejarah sahaja · unjuran tidak tersedia')}</p>}
      <p className="price-trends-note">{t('National estimates may differ from store prices.','Anggaran nasional mungkin berbeza daripada harga kedai.')}</p>
      <details className="price-data-details"><summary>{t('Data details','Butiran data')}</summary>
        <p>{data.item} · {data.unit}<br/>{data.source}<br/>{data.aggregation}</p>
        <p>{data.history.filter(p => p.price !== null).length} {t('observed weeks','minggu direkodkan')} · {data.history.filter(p => p.price === null).length} {t('missing','tiada rekod')} · {data.history.reduce((total,p) => total+(p.observations ?? 0),0).toLocaleString()} {t('observations','rekod')}</p>
        <p>{t('Data cutoff','Tarikh akhir data')}: {data.data_cutoff} · {t('Generated','Dijana')}: {data.generated_at.slice(0,10)}{data.model && ` · ${t('Model','Model')}: ${data.model}`}</p>
        <p>{t('Missing weeks are connected visually, without estimated values. Forecasts start after the cutoff. Planning estimates only.','Minggu tanpa rekod disambungkan secara visual tanpa nilai anggaran. Unjuran bermula selepas tarikh akhir. Anggaran perancangan sahaja.')}</p>
        {data.reasons.length > 0 && <p>{data.reasons.join(' ')}</p>}
        {data.short_diagnostics?.worst_relative_mae != null && <p>{t('4, 8 and 12-week backtests','Ujian sejarah 4, 8 dan 12 minggu')} · {t('Worst-window average error','Ralat purata tempoh terburuk')}: {(data.short_diagnostics.worst_relative_mae*100).toFixed(1)}% · {data.short_diagnostics.test_paths} {t('historical starts','tarikh mula sejarah')}</p>}
      </details>
    </>}
  </section>;
}
