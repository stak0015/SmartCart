/* eslint-disable @typescript-eslint/no-require-imports */
// Run against a local Next.js server: NODE_PATH=<playwright modules> node scripts/check-feedback-ui.cjs
// All API traffic is mocked; this check never calls Google or the database.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_CHECK_BROWSER || "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['geolocation'], geolocation: { latitude: 3.139, longitude: 101.6869 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let lastRecommendation;
  let lastCandidatePreparation;
  let reverseLabel = 'Jalan Tun Perak, Kuala Lumpur';
  let reverseDelay = 0;
  const items = [
    { item_id: 1, item_name: 'BERAS', item_name_en: 'Rice', item_name_ms: 'Beras', item_category: 'BERAS', unit: '1kg', package_size: '1kg', sara_eligible: null, sara_category_candidate: true },
    { item_id: 2, item_name: 'TELUR', item_name_en: 'Eggs', item_name_ms: 'Telur', item_category: 'TELUR', unit: '10 pcs', package_size: '10 pcs', sara_eligible: null, sara_category_candidate: true },
  ];
  const stores = [2, 1, 0].map((priced, i) => ({
    premiseId: String(i + 1), premiseCode: String(i + 1), googlePlaceId: `place-${i}`, name: `Test Store ${i + 1}`, address: 'Kuala Lumpur', district: 'KL', state: 'KL',
    straightLineDistanceKm: 1, routeDistanceKm: 2, estimatedTravelMinutes: 12, estimatedRoundTripCostRm: 2,
    basketCostRm: priced ? priced * 5 : 0, estimatedTotalCostRm: priced ? priced * 5 + 2 : null,
    pricedItemCount: priced, basketItemCount: 2, isCompleteBasket: priced === 2,
    basketSubtotalRm: priced ? priced * 5 : null, combinedTotalRm: priced ? priced * 5 + 2 : null,
    pricedCount: priced, basketLineCount: 2, missingItems: items.slice(priced).map(item => item.item_name), saraStatus: 'candidate',
    saraCreditRm: null, cashNeededRm: priced ? priced * 5 : null, priceObservedDaysAgo: 1, exceedsLimit: false,
    basketPrices: items.map((item, index) => ({ itemId: String(item.item_id), itemName: item.item_name, packageSize: item.package_size, quantity: 1, unitPriceRm: index < priced ? 5 : null, lineTotalRm: index < priced ? 5 : null, priceObservedDate: '2026-09-05' })), basketLines: [],
  }));
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body;
    if (url.pathname.endsWith('/items/categories')) body = { categories: ['BERAS', 'TELUR'], count: 2 };
    else if (url.pathname.endsWith('/items/search')) body = { items, count: 2, total: 2, page: 1, page_size: 20, total_pages: 1 };
    else if (url.pathname.endsWith('/locations/reverse')) { if (reverseDelay) await new Promise(resolve => setTimeout(resolve, reverseDelay)); body = { label: reverseLabel }; }
    else if (url.pathname.endsWith('/locations/autocomplete')) body = { suggestions: [] };
    else if (url.pathname.endsWith('/basket-alternatives')) body = {
      lines: items.map(item => ({ quantity: 1, source: { itemId: String(item.item_id), itemName: item.item_name, packageSize: item.package_size, unit: item.unit, unitPriceRm: 5, lineTotalRm: 5, observedDate: '2026-09-05', saraEligible: null, saraCategoryCandidate: true, isSaraCreditCandidate: true }, alternative: null, savingsRm: null,
        packOptions: item.item_id === 1 ? [
          { itemId: '1', itemName: 'BERAS', packageSize: '1kg', totalPriceRm: 5, pricePerUnitRm: 5, unitKind: 'KG', isBestValue: false },
          { itemId: '3', itemName: 'BERAS', packageSize: '2kg', totalPriceRm: 8, pricePerUnitRm: 4, unitKind: 'KG', isBestValue: true },
        ] : [],
      })), premiseId: '1', generatedAt: new Date().toISOString(),
    };
    else if (url.pathname.endsWith('/recommendations/prepare')) {
      lastCandidatePreparation = route.request().postDataJSON();
      body = {
        candidateCacheId: 'candidate-cache-1234567890',
        candidateCount: 3,
        reachableCount: 3,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    } else if (url.pathname.endsWith('/recommendations')) {
      lastRecommendation = route.request().postDataJSON();
      body = { recommendations: stores, totalCandidatesEvaluated: 3, totalReachable: 3, routeProvider: 'google', rankingMethod: 'Products priced first', costAssumptions: {}, routeWarning: null, expandedSearch: false };
    } else throw new Error(`Unexpected API request: ${url.pathname}`);
    await route.fulfill({ json: body });
  });
  const output = process.env.UI_CHECK_OUTPUT || path.join(require('node:os').tmpdir(), 'smartcart-feedback-ui');
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto(process.env.UI_CHECK_URL || 'http://localhost:3100');
    await page.getByRole('heading', { name: 'Ready to shop?' }).waitFor();
    await page.waitForFunction(() => document.documentElement.lang === 'en-MY');
    await page.waitForFunction(() => window.localStorage.getItem('smartcart-locale') === 'en');
    await page.getByRole('button', { name: 'Start a shopping trip', exact: true }).click();
    await page.getByRole('button', { name: 'Both', exact: true }).click();
    await page.getByRole('button', { name: '10 km', exact: true }).click();
    await page.getByRole('button', { name: '30 min', exact: true }).click();
    await page.getByRole('button', { name: 'Public transport', exact: true }).click();
    await page.getByRole('button', { name: 'Use my precise location' }).click();
    await page.getByRole('status').filter({ hasText: 'Location detected.' }).waitFor();
    assert.equal(await page.getByRole('combobox').inputValue(), 'Jalan Tun Perak, Kuala Lumpur');
    await page.screenshot({ path: path.join(output, 'travel.png'), fullPage: true });
    const candidatePreparationResponse = page.waitForResponse(response => response.url().endsWith('/recommendations/prepare'));
    await page.getByRole('button', { name: 'Build my basket', exact: true }).click();
    await candidatePreparationResponse;
    await page.getByRole('heading', { name: 'Shop household essentials' }).waitFor();
    assert.deepEqual(lastCandidatePreparation.travel.limit, { type: 'both', distanceKm: 10, timeMinutes: 30 });
    const addRice = page.getByRole('button', { name: '+ Add to basket: RICE', exact: true });
    await addRice.click();
    await page.screenshot({ path: path.join(output, 'item-select.png'), fullPage: true });
    await page.getByRole('status').filter({ hasText: 'Added 1 × RICE' }).waitFor();
    await addRice.click();
    assert.equal(await page.locator('[data-notification-id]').getAttribute('data-notification-id'), '2');
    const basket = page.locator('aside');
    await basket.getByText('RICE', { exact: true }).waitFor();
    assert(await basket.isVisible());
    await page.getByRole('button', { name: '+ Add to basket: EGGS', exact: true }).click();
    await page.getByRole('button', { name: 'Categories All categories' }).click();
    await page.getByRole('checkbox', { name: 'Rice', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Eggs', exact: true }).check();
    await page.getByRole('button', { name: 'Categories Rice, Eggs' }).click();
    await page.getByRole('textbox', { name: 'Search household essentials' }).fill('rice');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Search household essentials' }).inputValue(), '');
    assert(await page.getByRole('textbox', { name: 'Search household essentials' }).evaluate(el => el === document.activeElement));
    await page.screenshot({ path: path.join(output, 'desktop-shop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Tukar ke Bahasa Melayu' }).click();
    await basket.getByText('BERAS', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await basket.getByRole('button', { name: 'View basket' }).click();
    await page.getByRole('button', { name: 'Search stores', exact: true }).click();
    await page.getByText('Test Store 1', { exact: true }).waitFor();
    assert.deepEqual(lastRecommendation.travel.limit, { type: 'both', distanceKm: 10, timeMinutes: 30 });
    assert.equal(lastRecommendation.candidateCacheId, 'candidate-cache-1234567890');
    assert.equal(await page.getByRole('tab').count(), 0);
    await page.getByText('Partial basket + transport', { exact: true }).waitFor();
    const routeUrl = new URL(await page.getByRole('link', { name: 'View route' }).first().getAttribute('href'));
    assert.equal(routeUrl.searchParams.get('travelmode'), 'transit');
    assert.equal(routeUrl.searchParams.get('destination_place_id'), 'place-0');
    const saved = await page.evaluate(() => localStorage.getItem('smartcart-travel-preferences'));
    assert(!/latitude|longitude|origin|Jalan/.test(saved));
    await page.screenshot({ path: path.join(output, 'ranking.png'), fullPage: true });
    await page.getByRole('button', { name: 'Select store Test Store 1', exact: true }).click();
    await page.getByText('Compare 2 pack sizes', { exact: true }).click();
    const selectedPack = page.getByText('Selected', { exact: true });
    await selectedPack.waitFor();
    assert(await selectedPack.evaluate(el => el.parentElement.parentElement.className.includes('ring-1')));
    const selectPack = page.getByRole('button', { name: 'Select pack: BERAS', exact: true });
    await selectPack.click();
    await page.getByText('Pack changed', { exact: true }).first().waitFor();
    assert(await selectedPack.evaluate(el => el.parentElement.parentElement.textContent.includes('2kg')));
    await page.screenshot({ path: path.join(output, 'selected-pack.png'), fullPage: true });

    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    await page.getByRole('heading', { name: 'Ready to shop?' }).waitFor();
    await page.getByRole('button', { name: /^Checklist/ }).click();
    await page.getByRole('checkbox', { name: /Mark .* as bought/ }).first().click();
    const editItem = page.getByRole('button', { name: /Edit item/ }).first();
    await editItem.click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'checklist.png'), fullPage: true });
    await page.getByRole('button', { name: 'Record shopping trip', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Record shopping trip', exact: true }).click();
    await page.getByRole('heading', { name: 'Shopping history' }).waitFor();
    assert((await page.locator('details').first().innerText()).includes('RM18.00'));
    assert((await page.locator('details').first().innerText()).includes('Return travel (estimated)'));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, 'receipt.png'), fullPage: true });
    await page.getByRole('button', { name: 'SmartCart home' }).click();
    await page.getByRole('button', { name: /^Report/ }).click();
    await page.getByRole('tab', { name: 'Inbox' }).waitFor();
    await page.getByRole('tab', { name: 'Statistics' }).click();
    assert((await page.getByRole('tabpanel').innerText()).includes('RM16.00'));
    await page.screenshot({ path: path.join(output, 'statistics.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole('button', { name: 'Start a shopping trip', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Both', exact: true }).getAttribute('aria-pressed'), 'true');
    reverseLabel = null;
    await page.getByRole('button', { name: 'Use my precise location' }).click();
    await page.getByRole('status').filter({ hasText: 'Location detected; address unavailable.' }).waitFor();
    assert(await page.getByRole('button', { name: 'Build my basket' }).isEnabled());
    reverseLabel = 'Stale address';
    reverseDelay = 300;
    await page.getByRole('button', { name: 'Use my precise location' }).click();
    await page.getByRole('combobox').fill('New chosen search');
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('combobox').inputValue(), 'New chosen search');
    assert(await page.getByRole('button', { name: 'Build my basket' }).isDisabled());
    await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1, PERMISSION_DENIED: 1 }); });
    await page.getByRole('button', { name: 'Use my precise location' }).click();
    await page.getByText('Location access was not allowed. Search for a location instead.').waitFor();

    reverseLabel = 'Jalan Tun Perak, Kuala Lumpur';
    reverseDelay = 0;
    await page.reload();
    await page.getByRole('button', { name: 'Start a shopping trip', exact: true }).click();
    await page.getByRole('button', { name: 'Use my precise location' }).click();
    await page.getByRole('status').filter({ hasText: 'Location detected.' }).waitFor();
    assert.equal(await page.getByRole('combobox').inputValue(), 'Jalan Tun Perak, Kuala Lumpur');
    await page.getByRole('button', { name: 'Build my basket', exact: true }).click();
    await page.getByRole('button', { name: '+ Add to basket: RICE', exact: true }).click();
    assert(!(await page.getByRole('complementary', { name: 'Your basket', includeHidden: true }).isVisible()));
    await page.getByRole('button', { name: 'View basket', exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(output, 'mobile-shop.png'), fullPage: true });
    await page.reload();
    await page.getByText('1 of 2 items bought').waitFor();
    await page.getByRole('button', { name: /^Checklist/ }).click();
    await page.getByRole('heading', { name: 'Test Store 1' }).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, 'mobile-checklist.png'), fullPage: true });
    await page.getByRole('button', { name: 'SmartCart home' }).click();
    await page.getByText('1 trip recorded').waitFor();
    await page.getByRole('button', { name: /^Report/ }).click();
    await page.getByRole('tab', { name: 'Statistics' }).click();
    await page.getByText('RM16.00').waitFor();
    await page.screenshot({ path: path.join(output, 'mobile-statistics.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`Feedback UI checks passed. Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
