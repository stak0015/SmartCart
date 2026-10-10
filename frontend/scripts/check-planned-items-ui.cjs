/* eslint-disable @typescript-eslint/no-require-imports */
// Run against a local Next dev server; catalogue requests use fixed fixtures.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.PLANNED_ITEMS_BASE_URL || 'http://127.0.0.1:3100';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('Browser error:', error.stack); });
    const rice = { item_id: 1, item_code: '1', item_name: 'Rice', item_name_en: 'Rice', item_name_ms: 'Beras', category: null, package_size: '5 kg', unit: '5 kg', sara_eligible: null, sara_category_candidate: false };
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/items/search')) return route.fulfill({ json: { items: [rice], count: 1, total: 1, page: 1, page_size: 25, total_pages: 1 } });
      if (url.pathname.endsWith('/items/categories')) return route.fulfill({ json: { categories: [], count: 0 } });
      if (url.pathname.includes('price-history')) return route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } });
      return route.fulfill({ status: 503, json: { error: { message: 'Fixture unavailable' } } });
    });
    await page.goto(`${base}/shop`);
    await page.getByRole('button', { name: /Add to basket: Rice/i }).click();
    await page.getByRole('button', { name: 'See price trends', exact: true }).click();
    await page.getByRole('button', { name: 'Schedule purchase', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Schedule purchase', exact: true });
    const weeks = await dialog.locator('option').evaluateAll(options => options.map(option => option.value));
    assert.equal(weeks.length, 5);
    assert.equal((Date.parse(weeks[4]) - Date.parse(weeks[0])) / 86400000, 28);
    await dialog.getByRole('combobox').selectOption(weeks[4]);
    await dialog.getByRole('button', { name: 'Save planned item', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Planned week:' }).waitFor();
    await page.goto(base);
    let planned = page.getByRole('region', { name: /^Planned items/ });
    await planned.getByText('Rice', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: /^Planned this week/ }).count(), 0);
    assert.equal(await planned.getByRole('button', { name: 'Plan trip with selected items →', exact: true }).count(), 0);
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('smartcart.next-trip.v1')));
    assert.equal(saved.items[0].plannedWeek, weeks[4]);
    // Seed an active manual checklist, then exercise its real scheduling UI.
    await page.evaluate(() => {
      const now = new Date().toISOString();
      const bread = { id: 'manual-bread', source: 'manual', catalogueItemId: null, itemName: 'Bread', itemNameEn: null, itemNameMs: null, category: null, sourceCategory: null, packageSize: null, quantity: 1, unitPriceRm: 4, lineTotalRm: 4, actualPriceRm: null, actualQuantity: null, quantitySource: 'planned', priceSource: 'manual', observedDate: null, status: 'neutral' };
      localStorage.setItem('smartcart.shopping-checklist.v1', JSON.stringify({ version: 6, id: 'test-trip', store: { premiseId: '1', premiseCode: 'P1', name: 'Test Store', address: null }, createdAt: now, updatedAt: now, plannedSubtotalRm: 4, estimatedRoundTripCostRm: null, plannedCombinedTotalRm: null, alternativeStoreEstimates: [], items: [bread] }));
    });
    await page.goto(`${base}/checklist`);
    const bookmark = page.getByRole('button', { name: 'Schedule purchase: Bread', exact: true });
    // Mobile rows expose their actions through the disclosure button.
    await page.getByRole('button', { name: 'Edit item: Bread', exact: true }).first().click();
    await bookmark.click();
    dialog = page.getByRole('dialog', { name: 'Schedule purchase', exact: true });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('smartcart.next-trip.v1')));
    assert.equal(saved.items.length, 1);
    await bookmark.click();
    await dialog.getByRole('combobox').selectOption(weeks[0]);
    await dialog.getByRole('button', { name: 'Save planned item', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Purchase saved' }).waitFor();
    await page.goto(base);
    planned = page.getByRole('region', { name: /^Planned items/ });
    const thisWeek = page.getByRole('region', { name: /^Planned this week/ });
    await thisWeek.getByText('Bread', { exact: true }).waitFor();
    assert.equal(await thisWeek.getByText('Rice', { exact: true }).count(), 0);
    await thisWeek.getByRole('checkbox', { name: 'Select for trip: Bread', exact: true }).check();
    await thisWeek.getByRole('button', { name: 'Plan trip with selected items →', exact: true }).waitFor();
    await thisWeek.getByRole('checkbox', { name: 'Select for trip: Bread', exact: true }).uncheck();
    assert.equal(await thisWeek.getByRole('button', { name: 'Plan trip with selected items →', exact: true }).count(), 0);
    await page.screenshot({ path: path.resolve('.tmp/planned-items-mobile.png'), fullPage: true });
    await planned.getByRole('button', { name: 'Change planned week: Rice', exact: true }).click();
    await dialog.getByRole('combobox').selectOption(weeks[0]);
    await dialog.getByRole('button', { name: 'Save planned item', exact: true }).click();
    await thisWeek.getByText('Rice', { exact: true }).waitFor();
    await planned.getByRole('checkbox', { name: 'Select for trip: Rice', exact: true }).check();
    await planned.getByRole('button', { name: 'Plan trip with selected items →', exact: true }).click();
    await page.waitForURL('**/location');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('smartcart.shopping-session.v1'))?.basket?.length === 1);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('smartcart.shopping-session.v1')));
    assert.deepEqual(session.basket.map(item => item.id), ['db-1']);
    assert.deepEqual(JSON.parse(session.savedItemsToUse).items.map(item => item.id), ['catalogue:1']);
    assert.deepEqual(errors, []);
    console.log('PASS: trends scheduling, four-week limit, persistence, checklist cancel/save, current-week list, rescheduling, and selected-only trip items (mobile).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

