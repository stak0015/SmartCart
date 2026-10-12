"""Fixed validated Chronos-2 peer-context + pooled ridge inference.

Promoted from the SmartCart research bundle. No model/hyperparameter selection
occurs during weekly refresh. Chronological callers pass only origin-known data.
"""
from functools import lru_cache
import warnings
import numpy as np
import pandas as pd
import torch
from convertdate import islamic
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

MODEL_ID = 'autogluon/chronos-2-small'
MODEL_REVISION = 'ddec01313e50b6bc58ebaa92ede81bc24a3d9f9a'
MODES = ('peer_past',)

def values(record):
    return np.array([p['price'] if p['price'] is not None else np.nan for p in record['history']],dtype=float)

def load_pipeline(cache_dir=None, local_files_only=False):
    from chronos import BaseChronosPipeline
    torch.set_num_threads(4)
    pipeline = BaseChronosPipeline.from_pretrained(
        MODEL_ID, revision=MODEL_REVISION, device_map='cpu', torch_dtype=torch.float32,
        cache_dir=cache_dir, local_files_only=local_files_only, token=False)
    return type('Adapter', (), {'pipeline': pipeline})()

def forecast(items, origin, adapter, settings, batch_size=32):
    data = np.stack([values(r) for r in items])
    # Slice before both shared training and peer selection; held-out prices
    # cannot become features or pooled ridge targets.
    raw = peer_paths(adapter,items,origin,'peer_past',items,batch_size)
    annual = calibrate(correct(raw,data,origin,.25,6),data,origin,.05)
    head = SharedShortHead(settings['alpha']).fit(data,origin)
    return calibrate(blend(annual,head.predict(data,origin),settings['weight'],settings['decay']),data,origin,.05)

# Promoted from shared_short_head.py
def features(data, origin, horizon):
    if origin < 104 or not 1 <= horizon <= 12:
        raise ValueError('104 past weeks and horizon 1..12 required')
    past=np.asarray(data,dtype=float)[:,:origin]
    present=np.isfinite(past)&(past>0)
    valid=present[:,-104:].sum(axis=1)>=94
    valid &= present[:,-1]
    anchor=np.where(present[:,-1],past[:,-1],1.)
    columns=[]
    for lag in (1,2,4,8,13,26,52):
        z=past[:,-lag-1]
        columns.extend([np.where(np.isfinite(z)&(z>0),z/anchor-1,0),np.isfinite(z).astype(float)])
    for width in (4,8,13,26,52):
        z=np.where(present[:,-width:],past[:,-width:]/anchor[:,None]-1,np.nan)
        count=np.isfinite(z).sum(axis=1)
        mean=np.divide(np.nansum(z,axis=1),count,out=np.zeros(len(past)),where=count>0)
        variance=np.divide(np.nansum((z-mean[:,None])**2,axis=1),count,out=np.zeros(len(past)),where=count>0)
        columns.extend([mean,np.sqrt(variance),count/width])
    old=past[:,origin+horizon-53]
    old_anchor=past[:,origin-53]
    paired=np.isfinite(old)&np.isfinite(old_anchor)&(old>0)&(old_anchor>0)
    annual=np.divide(old-old_anchor,anchor,out=np.zeros(len(past)),where=paired)
    columns.extend([annual,paired.astype(float),np.full(len(past),horizon/12),np.full(len(past),(horizon/12)**2)])
    base=np.column_stack(columns)
    # Common horizon interactions let mean reversion vary with lead time.
    x=np.column_stack([base,base[:,:29]*(horizon/12)])
    return x,anchor,valid

# Promoted from shared_short_head.py
class SharedShortHead:
    def __init__(self,alpha=100.):
        if not np.isfinite(alpha) or alpha<=0:raise ValueError('Positive alpha required')
        self.alpha=alpha

    def fit(self,data,origin):
        data=np.asarray(data,dtype=float)[:,:origin]
        xx=[];yy=[]
        for time in range(104,origin):
            for h in range(1,min(12,origin-time)+1):
                x,anchor,valid=features(data,time,h)
                actual=data[:,time+h-1]
                valid &= np.isfinite(actual)&(actual>0)
                xx.append(x[valid]);yy.append(actual[valid]/anchor[valid]-1)
        x=np.concatenate(xx);y=np.concatenate(yy)
        if not len(y):raise ValueError('No observed training targets')
        self.training_rows=len(y)
        self.model=make_pipeline(StandardScaler(),Ridge(alpha=self.alpha)).fit(x,y)
        return self

    def predict(self,data,origin):
        result=[]
        for h in range(1,13):
            x,anchor,valid=features(data,origin,h)
            price=anchor*(1+np.clip(self.model.predict(x),-.8,3.))
            result.append(np.where(valid,np.maximum(price,.01),np.nan))
        return np.stack(result,axis=1)

# Promoted from shared_short_head.py
def blend(annual,short,weight,decay):
    if not 0<=weight<=1 or decay<=0:raise ValueError('Invalid common blend')
    result=np.array(annual,dtype=float,copy=True)
    # Smoothly taper to zero at week 13, leaving the later annual path intact.
    h=np.arange(1,13)
    w=weight*np.exp(-(h-1)/decay)*(13-h)/12
    usable=np.isfinite(short)&np.isfinite(result[:,:12])
    result[:,:12]=np.where(usable,result[:,:12]*(1-w)+short*w,result[:,:12])
    return result

# Promoted from repeatability_audit.py
def detrended_cycle(y):
    y=np.asarray(y,dtype=float)
    if y.shape!=(52,):raise ValueError('Expected one aligned annual cycle')
    valid=np.isfinite(y)
    if valid.sum()<47:return np.full(52,np.nan)
    x=np.arange(52,dtype=float)
    slope=np.dot(x[valid]-x[valid].mean(),y[valid]-y[valid].mean())/np.sum((x[valid]-x[valid].mean())**2)
    residual=y-y[valid].mean()-slope*(x-x[valid].mean())
    total=np.zeros(52);count=np.zeros(52)
    for offset in range(-2,3):
        shifted=np.roll(residual,offset);available=np.isfinite(shifted)
        total+=np.where(available,shifted,0);count+=available
    result=np.divide(total,count,out=np.full(52,np.nan),where=count>=3)
    result[~valid]=np.nan  # Missing target weeks never become observations.
    return result

# Promoted from repeatability_audit.py
def shape_agreement(predicted,observed):
    predicted=np.asarray(predicted,dtype=float);observed=np.asarray(observed,dtype=float)
    valid=np.isfinite(predicted)&np.isfinite(observed)
    result=dict(paired_weeks=int(valid.sum()),correlation=None,amplitude_ratio=None,
                peak_band_error=None,trough_band_error=None,shape_pass=False)
    if valid.sum()<42:return result
    p=predicted[valid];y=observed[valid]
    scale=max(1.,float(np.max(abs(y))),float(np.max(abs(p))))
    if min(np.std(p),np.std(y))<1e-10*scale:return result
    amplitude=float(np.quantile(y,.9)-np.quantile(y,.1))
    ratio=float((np.quantile(p,.9)-np.quantile(p,.1))/amplitude)
    correlation=float(np.corrcoef(p,y)[0,1])
    errors=[]
    for peak in (True,False):
        lo=float(np.nanmin(observed));hi=float(np.nanmax(observed))
        band=np.flatnonzero(observed>=hi-.2*(hi-lo) if peak else observed<=lo+.2*(hi-lo))
        index=int(np.nanargmax(predicted) if peak else np.nanargmin(predicted))
        distance=abs(band-index)
        errors.append(int(np.minimum(distance,52-distance).min()))
    result.update(correlation=correlation,amplitude_ratio=ratio,peak_band_error=errors[0],
                  trough_band_error=errors[1],shape_pass=bool(correlation>=.5 and .5<=ratio<=1.5 and max(errors)<=6))
    return result

# Promoted from chronos2_shape_correction.py
@lru_cache(maxsize=4)
def basis(harmonics):
    if harmonics not in (3,6):raise ValueError('Expected 3 or 6 shared harmonics')
    x=np.arange(52,dtype=float)
    design=np.column_stack([f(2*np.pi*k*x/52) for k in range(1,harmonics+1) for f in (np.sin,np.cos)])
    level_trend=np.column_stack([np.ones(52),x-x.mean()])
    design-=level_trend@np.linalg.lstsq(level_trend,design,rcond=None)[0]
    design.setflags(write=False)
    return design

# Promoted from chronos2_shape_correction.py
def past_shape(prefix,harmonics):
    prefix=np.asarray(prefix,dtype=float)
    cycles=[];coefficients=[];design=basis(harmonics)
    for lag in range(min(3,len(prefix)//52)):
        end=len(prefix)-lag*52
        cycle=detrended_cycle(prefix[end-52:end]);valid=np.isfinite(cycle)
        if valid.sum()<47:continue
        cycles.append(cycle)
        coefficients.append(np.linalg.lstsq(design[valid],cycle[valid],rcond=None)[0])
    if len(cycles)<2:return np.zeros(52),0.
    correlations=[shape_agreement(cycles[i],cycles[j])['correlation'] for i in range(len(cycles)) for j in range(i)]
    correlations=[c for c in correlations if c is not None]
    if not correlations:return np.zeros(52),0.
    template=design@np.median(coefficients,axis=0)
    finite=prefix[np.isfinite(prefix)&(prefix>0)]
    if not len(finite):return np.zeros(52),0.
    amplitude=float(np.quantile(template,.9)-np.quantile(template,.1))
    confidence=float(np.clip(np.mean(correlations),0,1)*np.clip(amplitude/(.05*finite[-1]),0,1))
    return template,confidence

# Promoted from chronos2_shape_correction.py
def correct(raw,data,origin,strength,harmonics):
    data=np.asarray(data,dtype=float);raw=np.asarray(raw,dtype=float)
    if data.ndim!=2 or raw.shape!=(len(data),52) or not 1<=origin<=data.shape[1]:raise ValueError('Invalid dimensions or origin')
    if not np.isfinite(strength) or strength<0:raise ValueError('Invalid shared strength')
    design=basis(harmonics);result=raw.copy()
    if strength==0:return result
    for i,row in enumerate(raw):
        if not np.isfinite(row).all():continue
        template,confidence=past_shape(data[i,:origin],harmonics)
        if confidence==0:continue
        projected=design@np.linalg.lstsq(design,row,rcond=None)[0]
        result[i]=np.maximum(.01,row+strength*confidence*(template-projected))
    return result

# Promoted from chronos_model.py
def calibrate(raw,data,end,epsilon):
    if not np.isfinite(epsilon) or epsilon<0:raise ValueError('Invalid shared threshold')
    past=np.asarray(data,dtype=np.float64)[:,:end]
    anchors=np.array([row[np.isfinite(row)&(row>0)][-1] if (np.isfinite(row)&(row>0)).any()
                      else np.nan for row in past])
    with np.errstate(divide='ignore',invalid='ignore'):
        return np.where(abs(raw/anchors[:,None]-1)<epsilon*np.exp(-(np.arange(1,53)/16)**2),anchors[:,None],raw)

# Promoted from chronos2_calendar_model.py
@lru_cache(maxsize=64)
def calendar_covariates(first_week,length,mode):
    if mode not in ('none','solar','hijri','both') or length<1:raise ValueError('Valid calendar mode and length required')
    weeks=pd.date_range(first_week,periods=length,freq='7D')
    result={}
    if mode in ('solar','both'):
        phase=2*np.pi*(weeks-pd.Timestamp('2020-01-01')).days.to_numpy()/365.2425
        for k in (1,2):
            result[f'solar_sin{k}']=np.sin(k*phase).astype(np.float32)
            result[f'solar_cos{k}']=np.cos(k*phase).astype(np.float32)
    if mode in ('hijri','both'):
        phases=[];ramadan=[]
        for day in weeks:
            year,month,date=islamic.from_gregorian(day.year,day.month,day.day)
            ordinal=sum(islamic.month_length(year,m) for m in range(1,month))+date-1
            phases.append(2*np.pi*ordinal/(355 if islamic.leap(year) else 354))
            ramadan.append(float(month==9))
        phase=np.array(phases)
        for k in (1,2):
            result[f'hijri_sin{k}']=np.sin(k*phase).astype(np.float32)
            result[f'hijri_cos{k}']=np.cos(k*phase).astype(np.float32)
        result['ramadan_proxy']=np.array(ramadan,dtype=np.float32)
    # Cached arrays are immutable; no task can contaminate a later origin.
    for array in result.values():array.setflags(write=False)
    return result

# Promoted from chronos2_lagged_model.py
def lagged_values(prefix,lag):
    prefix=np.asarray(prefix,dtype=np.float32)
    if prefix.ndim!=1 or not isinstance(lag,int) or lag<52:
        raise ValueError('A lag of at least 52 weeks is required for known annual inputs')
    indices=np.arange(len(prefix)+52)-lag
    valid=(indices>=0)&(indices<len(prefix))
    result=np.full(len(indices),np.nan,dtype=np.float32)
    result[valid]=prefix[indices[valid]]
    result[~np.isfinite(result)|(result<=0)]=np.nan
    return result

# Promoted from chronos2_peer_context.py
def peer_indices(past):
    """Rank up to five positive peers by paired 4-week log-price changes.

    Target is excluded. Require 78 paired actual changes in the last 104 weeks
    and correlation >= .35. No missing prices are filled for selection/indexing.
    Scaling uses each peer's origin-known recent median; at least two peers must
    be observed to define an index point. Return NaN where evidence is absent.
    """
    past=np.asarray(past,dtype=float).copy()
    if past.ndim!=2 or past.shape[1]<104:raise ValueError('104-week matrix required')
    past[~np.isfinite(past)|(past<=0)]=np.nan
    logs=np.log(past)
    changes=logs[:,4:]-logs[:,:-4]
    tail=changes[:,-104:]
    index=np.full(past.shape,np.nan);members=[]
    for i,x in enumerate(tail):
        ranked=[]
        for j,y in enumerate(tail):
            if i==j:continue
            mask=np.isfinite(x)&np.isfinite(y)
            if mask.sum()<78:continue
            a=x[mask];b=y[mask]
            if min(a.std(),b.std())<1e-8:continue
            correlation=float(np.corrcoef(a,b)[0,1])
            if correlation>=.35:ranked.append((j,correlation))
        ranked.sort(key=lambda pair:(-pair[1],pair[0]));ranked=ranked[:5]
        members.append(ranked)
        if len(ranked)<2:continue
        peers=np.array([j for j,_ in ranked]);prices=past[peers]
        normalizers=np.nanmedian(prices[:,-104:],axis=1)
        relative=prices/normalizers[:,None]
        present=np.isfinite(relative).sum(axis=0)>=2
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',RuntimeWarning)
            index[i,present]=np.nanmedian(relative[:,present],axis=0)
    return index,members

# Promoted from chronos2_peer_context.py
def peer_paths(adapter,items,origin,mode,pool,batch_size=32):
    if mode not in MODES:raise ValueError('Invalid peer mode')
    data=np.stack([values(r) for r in pool])
    if not 104<=origin<=data.shape[1] or batch_size<1:raise ValueError('Invalid origin or batch size')
    if len({r['item_code'] for r in pool})!=len(pool):raise ValueError('Duplicate pool item')
    common=[r['week'] for r in pool[0]['history'][:origin]]
    if common!=pd.date_range(common[0],periods=origin,freq='7D').date.astype(str).tolist():raise ValueError('Unaligned weekly grid')
    if any([h['week'] for h in r['history'][:origin]]!=common for r in pool):raise ValueError('Unaligned peer grid')
    lookup={r['item_code']:i for i,r in enumerate(pool)}
    past=data[:,:origin].copy();past[~np.isfinite(past)|(past<=0)]=np.nan
    indices,members=peer_indices(past)
    output=np.full((len(items),52),np.nan)
    eligible=[(i,lookup[r['item_code']]) for i,r in enumerate(items)
              if np.isfinite(past[lookup[r['item_code']]]).sum()>=104]
    # Native preprocessing requires identical covariate keys per invocation.
    # Partition by available input schema; all use the same weights and rule.
    groups=[[pair for pair in eligible if bool(np.isfinite(indices[pair[1]]).any())==has_peers]
            for has_peers in (False,True)]
    batches=[group[start:start+batch_size] for group in groups
             for start in range(0,len(group),batch_size)]
    for chosen in batches:
        tasks=[]
        for _,j in chosen:
            context=past[j].astype(np.float32)
            cov=dict(calendar_covariates(common[0],origin+52,'solar'))
            cov['price_lag_52']=lagged_values(context,52)
            known={k:v[origin:] for k,v in cov.items()}
            previous={k:v[:origin] for k,v in cov.items()}
            # No meaningful peer index: preserve the exact original task.
            if np.isfinite(indices[j]).any():
                previous['peer_price_index']=indices[j].astype(np.float32)
                if mode=='peer_annual':
                    shifted=lagged_values(indices[j],52)
                    previous['peer_index_lag_52']=shifted[:origin]
                    known['peer_index_lag_52']=shifted[origin:]
            tasks.append(dict(target=context,past_covariates=previous,future_covariates=known))
        with torch.inference_mode():
            quantiles,_=adapter.pipeline.predict_quantiles(tasks,prediction_length=52,
                quantile_levels=[.5],cross_learning=False,batch_size=batch_size)
        if len(quantiles)!=len(chosen) or any(tuple(q.shape)!=(1,52,1) for q in quantiles):raise ValueError('Invalid output shape')
        prediction=torch.cat(quantiles,dim=0)[:,:,0].cpu().numpy().astype(float)
        if not np.isfinite(prediction).all():raise ValueError('Nonfinite forecast')
        for (i,_),path in zip(chosen,prediction):output[i]=np.maximum(.01,path)
    return output
