/* eslint-disable @typescript-eslint/no-require-imports */
// Real snapshot API; only the catalogue shell is a fixture.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const snapshotPath=process.env.PRICE_HISTORY_SNAPSHOT || path.resolve(__dirname,'../../backend/data/price_forecasts.json');
  const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
  const unified=snapshot.model_policy?.scope==='one_pooled_model';
  const risingName=unified ? 'Imported buffalo top side' : 'Imported buffalo chuck';
  const risingAvailable=snapshot.records.find(r=>r.region_id==='national::' && r.item_code===(unified ? '14' : '1378')).status==='available';
  const candidateRecords=snapshot.records.filter(r=>r.region_id==='national::' && (unified || r.status==='available'));
  let qualifying=0;
  // Check every cutoff-eligible item against runtime gates, not just demo items.
  for(let i=0;i<candidateRecords.length;i+=12) {
    await Promise.all(candidateRecords.slice(i,i+12).map(async record=>{
      const response=await page.request.get(`http://127.0.0.1:8011/api/items/${record.item_code}/price-history`);
      assert.equal(response.status(),200);
      const data=await response.json();
      assert.equal(data.history.some(p=>p.price!==null),record.history.some(p=>p.price!==null));
      if(unified) {
        assert.equal(data.model,snapshot.model_policy.name);
        assert.deepEqual(data.history,record.history);
      }
      if(data.status==='available') {
        qualifying++;
        assert.equal(data.forecast.length,52);
        assert.equal(data.annual_forecast_experimental,true);
        assert.equal(data.validated_horizon_weeks,unified ? 52 : 12);
        if(unified) {
          assert.equal(data.model,snapshot.model_policy.name);
          assert.equal(data.coverage.require_annual_validation,true);
          assert.equal(data.coverage.test_annual_shape_pass,true);
          assert.equal(data.coverage.current_forecast_shape_pass,true);
          assert(data.coverage.test_annual_relative_mae<=.1);
          assert(data.coverage.test_annual_baseline_mae_ratio<=1);
        }
        assert(data.forecast.every(p=>Number.isFinite(p.price) && p.price>0));
      } else assert.equal(data.forecast.length,0);
    }));
  }
  assert(qualifying>0);
  const fixtureNames=[['263','Buruh cooking oil'],['1','Whole chicken'],['70','Selar fish'],['1378','Imported buffalo chuck']];
  if(unified) fixtureNames.push(['14','Imported buffalo top side'],['47','Torpedo scad']);
  const fixtures=fixtureNames.map(([code,name])=>{
    const r=snapshot.records.find(r=>r.item_code===code && r.region_id==='national::');
    return {item_id:Number(code),item_code:code,item_name:r.item,item_name_en:name,unit:r.unit,package_size:r.unit,item_category:'FOOD',category:null,sara_eligible:null,sara_category_candidate:true};
  });
  let failure=false; const requested=[];
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.includes('/price-history')) {
      requested.push(url.pathname+url.search);
      if(failure) return route.fulfill({status:503,json:{error:{message:'unavailable'}}});
      const response=await route.fetch({url:`http://127.0.0.1:8011${url.pathname}${url.search}`});
      return route.fulfill({response});
    }
    if(url.pathname.endsWith('/items/search')) return route.fulfill({json:{items:fixtures,count:fixtures.length,total:fixtures.length,page:1,page_size:25,total_pages:1}});
    if(url.pathname.endsWith('/items/categories')) return route.fulfill({json:{categories:[],count:0}});
    return route.fulfill({json:{}});
  });
  const output=path.resolve(__dirname,`../../docs/evidence/epic4-prices${unified ? '/unified-candidate' : ''}`);
  fs.mkdirSync(output,{recursive:true});
  const dialog=page.getByRole('dialog');
  const trends=dialog.getByRole('region',{name:'Price trends',exact:true});
  const open=name=>page.getByRole('button',{name:new RegExp(`Add to basket: ${name}`,'i')}).click();
  const show=async()=>{await dialog.getByRole('button',{name:'See price trends',exact:true}).click(); await trends.getByText('Loading history…',{exact:true}).waitFor({state:'hidden'});};
  const close=()=>dialog.getByRole('button',{name:'Close item details'}).click();
  try {
    await page.goto('http://127.0.0.1:3011/shop');
    await open('Buruh cooking oil');
    assert.equal(await trends.count(),0);
    assert.equal(requested.length,0,'Opening item details must not fetch trends');
    await show();
    await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();
    assert.equal(await trends.getByLabel('Inspect weekly value').count(),0);
    assert.equal(await trends.getByLabel('Compare future week').count(),0);
    assert.equal(await trends.locator('.price-cost-card').count(),0);
    assert.equal(await dialog.getByLabel('Price region').count(),0);
    assert.equal(await trends.getByRole('button',{name:'1 year',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await trends.getByRole('button',{name:'12 weeks',exact:true}).getAttribute('aria-pressed'),'true');
    await trends.getByRole('button',{name:'All available',exact:true}).click();
    assert.match(await trends.locator('.price-chart-range').innerText(),/2022-01-03/);
    await trends.getByRole('button',{name:'6 months',exact:true}).click();
    const control=await trends.getByRole('button',{name:'6 months',exact:true}).boundingBox();
    assert(control.height<=36);
    await dialog.locator('input[inputmode="numeric"]').fill('3');
    await trends.getByRole('button',{name:'Close price trends'}).click();
    assert.equal(await trends.count(),0);
    assert.equal(await dialog.getByRole('button',{name:'See price trends'}).evaluate(el=>el===document.activeElement),true);
    await close();
    failure=true;
    await open('Buruh cooking oil'); await show();
    await trends.getByRole('alert').waitFor();
    assert(await dialog.getByRole('button',{name:'Add to basket',exact:true}).isEnabled());
    failure=false;
    await trends.getByRole('button',{name:'Retry'}).click();
    await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Add to basket',exact:true}).click();
    await page.getByRole('button',{name:'View basket, 1 item',exact:true}).waitFor();
    for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
      await page.setViewportSize(viewport);
      await open('Buruh cooking oil');
      assert.equal(await trends.count(),0);
      await page.screenshot({path:path.join(output,`${device}-item-details.png`)});
      await show();
      await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();
      const left=await dialog.locator('.catalogue-item-card').boundingBox();
      const right=await dialog.locator('.catalogue-trends-card').boundingBox();
      if(device==='desktop') assert(right.x>=left.x+left.width+8,'Desktop trends must sit beside item');
      else assert(right.y>=left.y+left.height,'Mobile cards must stack');
      assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
      if(device==='mobile') await trends.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${device}-history-metadata.png`)});
      const plot=trends.locator('.recharts-wrapper');
      await plot.scrollIntoViewIfNeeded();
      const bounds=await plot.boundingBox();
      await plot.hover({position:{x:bounds.width-22,y:100}});
      await trends.locator('.recharts-tooltip-wrapper').getByText('Projected',{exact:true}).waitFor();
      await page.screenshot({path:path.join(output,`${device}-history-forecast.png`)});
      await dialog.locator('input[inputmode="numeric"]').fill('3');
      await close();
      await open('Whole chicken'); await show();
      await trends.getByText('History only · forecast unavailable',{exact:true}).waitFor();
      assert.equal(await trends.getByLabel('Compare future week').count(),0);
      assert.equal(await trends.getByRole('button',{name:'4 weeks',exact:true}).count(),0);
      assert.equal(await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).count(),0);
      await trends.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${device}-forecast-rejected.png`)});
      await close();
      await open('Selar fish'); await show();
      await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();
      assert(await trends.locator('.price-chart-legend').getByText('Historical',{exact:true}).isVisible());
      assert(await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).isVisible());
      await trends.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${device}-changing-forecast.png`)});
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(),0);
      await open(risingName); await show();
      await (risingAvailable ? trends.locator('.price-chart-legend').getByText('Projected',{exact:true}) : trends.getByText('History only · forecast unavailable',{exact:true})).waitFor();
      if(!risingAvailable) assert.equal(await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).count(),0);
      await trends.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${device}-rising-${risingAvailable ? 'forecast' : 'history'}.png`)});
      if(unified) {
        if(risingAvailable) await trends.getByText('One past year checked · estimates remain experimental.',{exact:true}).waitFor();
        await trends.locator('summary').click();
        assert.match(await trends.locator('.price-data-details').innerText(),/pooled_seasonal_bridge/);
        assert.match(await trends.locator('.price-data-details').innerText(),/historical year; exploratory evidence/);
        await trends.locator('.price-data-details').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,`${device}-backtest-details.png`)});
      }
      await close();
      if(unified) {
        await open('Torpedo scad'); await show();
        await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).waitFor();
        await trends.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,`${device}-seasonal-forecast.png`)});
        await close();
        await open('Imported buffalo chuck'); await show();
        await trends.getByText('History only · forecast unavailable',{exact:true}).waitFor();
        assert.equal(await trends.getByLabel('Compare future week').count(),0);
        await close();
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await open(risingName); await show();
    await (risingAvailable ? trends.locator('.price-chart-legend').getByText('Projected',{exact:true}) : trends.getByText('History only · forecast unavailable',{exact:true})).waitFor();
    if(risingAvailable) assert(await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).isVisible());
    else assert.equal(await trends.locator('.price-chart-legend').getByText('Projected',{exact:true}).count(),0);
    await close();
    assert(requested.every(value=>!new URL(`http://test${value}`).searchParams.has('region')));
    assert.deepEqual(errors,[]);
    console.log(`PASS: all ${qualifying} runtime-qualified items return history + 52 forecasts with a 4/8/12-week frontend display; all three representative trend types, compact on-demand cards, desktop/mobile layouts, retry, removed week comparison, rejection and basket add.`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
