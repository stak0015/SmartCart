/* eslint-disable @typescript-eslint/no-require-imports */
// Real forecast API and full catalogue gate audit; catalogue search is a UI fixture.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../backend/data/price_forecasts.json'),'utf8'));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const output=path.resolve(__dirname,'../../docs/evidence/epic4-prices/shared-short');fs.mkdirSync(output,{recursive:true});
 const capture=async name=>{await page.mouse.move(2,2);await page.screenshot({path:path.join(output,name)});};
 try{
  let qualified=0;
  for(let i=0;i<snapshot.records.length;i+=12){
   await Promise.all(snapshot.records.slice(i,i+12).map(async r=>{
    const response=await page.request.get(`http://127.0.0.1:8011/api/items/${r.item_code}/price-history`);
    assert.equal(response.status(),200);const d=await response.json();assert.deepEqual(d.history,r.history);
    assert.equal(d.model,'chronos_2_small_ridge');assert.equal(d.validated_horizon_weeks,12);
    assert.equal(d.coverage.require_annual_validation,false);assert.equal(d.coverage.require_current_shape,false);
    if(d.status==='available'){
     qualified++;assert.equal(d.forecast.length,52);assert.equal(d.annual_forecast_experimental,true);assert(d.forecast.every(p=>p.price>0&&Number.isFinite(p.price)&&p.week>d.data_cutoff));
     assert(d.coverage.test_relative_mae<=snapshot.quality_policy.rules.max_relative_mae&&d.coverage.test_baseline_mae_ratio<=snapshot.quality_policy.rules.max_baseline_mae_ratio);assert.equal(d.coverage.test_complete_paths,3);
    }else assert.equal(d.forecast.length,0);
   }));
  }
  assert.equal(qualified,snapshot.records.filter(r=>r.status==='available').length);
  const names=[['263','Buruh cooking oil'],['1','Whole chicken'],['70','Selar fish'],['47','Cencaru fish'],['1378','Imported buffalo chuck']];
  const fixtures=names.map(([code,name])=>{const r=snapshot.records.find(r=>r.item_code===code);return {item_id:Number(code),item_code:code,item_name:r.item,item_name_en:name,unit:r.unit,package_size:r.unit,item_category:'FOOD',category:null,sara_eligible:null,sara_category_candidate:true};});
  let failure=false;let requests=0;
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.includes('/price-history')){
    requests++;if(failure)return route.fulfill({status:503,json:{error:{message:'unavailable'}}});
    const response=await route.fetch({url:`http://127.0.0.1:8011${url.pathname}${url.search}`});return route.fulfill({response});
   }
   if(url.pathname.endsWith('/items/search'))return route.fulfill({json:{items:fixtures,count:fixtures.length,total:fixtures.length,page:1,page_size:25,total_pages:1}});
   if(url.pathname.endsWith('/items/categories'))return route.fulfill({json:{categories:[],count:0}});
   return route.fulfill({json:{}});
  });
  const dialog=page.getByRole('dialog');const trends=dialog.getByRole('region',{name:'Price trends',exact:true});
  const open=name=>page.getByRole('button',{name:new RegExp(`Add to basket: ${name}`,'i')}).click();
  const show=async()=>{await dialog.getByRole('button',{name:'See price trends',exact:true}).click();await trends.getByText('Loading history…',{exact:true}).waitFor({state:'hidden'});};
  const close=()=>dialog.getByRole('button',{name:'Close item details'}).click();
  await page.goto('http://127.0.0.1:3011/shop');await open('Buruh cooking oil');assert.equal(await trends.count(),0);assert.equal(requests,0);await close();
  for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
   await page.setViewportSize(viewport);await open('Buruh cooking oil');
   await capture(`${device}-item-details.png`);await show();
   await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();assert.equal(await trends.getByRole('button',{name:'12 weeks',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await trends.getByText('Beyond 12 weeks: exploratory projections.',{exact:true}).count(),0);
   for(const weeks of [4,8,12]){
    await trends.getByRole('button',{name:`${weeks} weeks`,exact:true}).click();
    assert.equal(await trends.getByRole('button',{name:`${weeks} weeks`,exact:true}).getAttribute('aria-pressed'),'true');
    const item=snapshot.records.find(r=>String(r.item_code)==='263'&&r.region_id==='national::');
    assert.equal(await trends.locator('.price-chart-range span').last().innerText(),item.forecast[weeks-1].week);
   }
   assert.equal(await trends.getByLabel('Inspect weekly value').count(),0);
    assert.equal(await trends.getByLabel('Compare future week').count(),0);
    assert.equal(await trends.locator('.price-cost-card').count(),0);
   const left=await dialog.locator('.catalogue-item-card').boundingBox(),right=await dialog.locator('.catalogue-trends-card').boundingBox();
   if(device==='desktop')assert(right.x>=left.x+left.width+8);else assert(right.y>=left.y+left.height);
   assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await trends.scrollIntoViewIfNeeded();await capture(`${device}-history-forecast.png`);
   await trends.locator('summary').click();assert.match(await trends.locator('.price-data-details').innerText(),/chronos_2_small_ridge/);
   assert.match(await trends.locator('.price-data-details').innerText(),/4, 8 and 12-week backtests/);await close();
   await open('Whole chicken');await show();await trends.getByText('History only · forecast unavailable',{exact:true}).waitFor();
   assert.equal(await trends.getByLabel('Compare future week').count(),0);assert.equal(await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).count(),0);
   await trends.scrollIntoViewIfNeeded();await capture(`${device}-history-only.png`);await close();
   for(const name of ['Selar fish','Cencaru fish','Imported buffalo chuck']){
    await open(name);await show();await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();await trends.scrollIntoViewIfNeeded();
    await capture(`${device}-${name.split(' ')[0].toLowerCase()}-forecast.png`);await close();
   }
  }
  failure=true;await open('Buruh cooking oil');await show();await trends.getByRole('alert').waitFor();failure=false;
  await trends.getByRole('button',{name:'Retry'}).click();await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Add to basket',exact:true}).click();await page.getByRole('button',{name:'View basket, 1 item',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS: ${qualified}/796 qualified items; 4/8/12-week display, 12-week validation, history-only rejection, lazy loading, compact desktop/mobile cards, removed week comparison, retry and basket.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
