"use client";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PricePoint } from '@/lib/price-history';
import type { Locale } from '@/lib/i18n';

export default function PriceSeriesChart({ history, forecast, unit, locale }: {
  history: PricePoint[]; forecast: PricePoint[]; unit: string; locale: Locale;
}) {
  const historical = locale==='en' ? 'Historical' : 'Sejarah';
  const projected = locale==='en' ? 'Projected' : 'Unjuran';
  const data = [...history.map(p=>({...p,time:Date.parse(p.week),observed:p.price,projected:null})),
    ...forecast.map(p=>({...p,time:Date.parse(p.week),observed:null,projected:p.price}))];
  const prices=data.flatMap(p=>p.price===null ? [] : [p.price]);
  const minimum=Math.min(...prices), maximum=Math.max(...prices);
  const padding=Math.max(.1,(maximum-minimum)*.15);
  const longRange=data.length>60;
  const dates=new Intl.DateTimeFormat(locale==='en' ? 'en-MY' : 'ms-MY',{timeZone:'UTC',month:'short',...(longRange ? {year:'2-digit'} : {day:'numeric'})});
  return <div className="price-chart-card">
    <div className="price-chart-legend"><span><i className="historical-swatch"/>{historical}</span>{forecast.length>0 && <span><i className="projected-swatch"/>{projected}</span>}<small>RM / {unit}</small></div>
    <div className="price-chart-plot" aria-label={locale==='en' ? 'Weekly price chart' : 'Graf harga mingguan'}>
      <ResponsiveContainer width="100%" height={250} minWidth={0}>
        <LineChart data={data} margin={{top:24,right:12,bottom:8,left:0}} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4"/>
          <XAxis dataKey="time" type="number" scale="time" domain={['dataMin','dataMax']} tickCount={4} minTickGap={24} tickFormatter={value=>dates.format(new Date(value))} tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
          <YAxis width={45} domain={[Math.max(0,minimum-padding),maximum+padding]} tickCount={4} tickFormatter={value=>Number(value).toFixed(2)} tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
          {forecast.length>0 && <><ReferenceArea x1={Date.parse(forecast[0].week)} x2={Date.parse(forecast[forecast.length-1].week)} fill="#f3e8ff" fillOpacity={.6}/><ReferenceLine x={Date.parse(forecast[0].week)} stroke="#a78bfa" strokeDasharray="4 4"/></>}
          <Tooltip labelFormatter={value=>`${locale==='en' ? 'Week beginning' : 'Minggu bermula'} ${new Date(Number(value)).toISOString().slice(0,10)}`}
            formatter={(value,name)=>[`RM ${Number(value).toFixed(2)}`,name]}
            contentStyle={{border:'1px solid #e2e8f0',borderRadius:12,fontSize:12,boxShadow:'0 4px 16px #0f172a15'}}
            cursor={{stroke:'#94a3b8',strokeDasharray:'3 3'}}/>
          <Line dataKey="observed" name={historical} stroke="#15803d" strokeWidth={2.5} dot={history.filter(p=>p.price!==null).length<2 ? {r:4} : false} activeDot={{r:5}} connectNulls isAnimationActive={false}/>
          <Line dataKey="projected" name={projected} stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="6 5" dot={false} activeDot={{r:5}} connectNulls={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="price-chart-range"><span>{data[0]?.week}</span><span>{data.at(-1)?.week}</span></div>
  </div>;
}
