/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.CATALOGUE_CONTROLS_BASE_URL || 'http://127.0.0.1:3101';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    const fixtures = Array.from({ length: 21 }, (_, index) => ({
      item_id: index + 1, item_code: String(index + 1), item_name: `Item ${String(index + 1).padStart(2, '0')}`,
      item_name_en: `Item ${String(index + 1).padStart(2, '0')}`, item_name_ms: `Item ${String(index + 1).padStart(2, '0')}`,
      category: null, unit: '1 kg', package_size: '1 kg', sara_eligible: null,
      sara_category_candidate: index % 2 === 0,
      price_range: index === 20 ? null : { min_rm: index + 1, max_rm: index + 1, store_count: 1, oldest_observed_date: null, price_source: 'store' },
    }));
    fixtures[2].item_name_en = 'Item 03 extra long household product name with package details';
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/items/search')) {
        const params = Object.fromEntries(url.searchParams); requests.push(params);
        let items = fixtures.filter(item => params.sara_category_only !== 'true' || item.sara_category_candidate);
        items = [...items].sort((a, b) => {
          if (params.sort?.startsWith('name')) return (params.sort === 'name_desc' ? -1 : 1) * a.item_name.localeCompare(b.item_name);
          if (!a.price_range) return 1;
          if (!b.price_range) return -1;
          return (params.sort === 'price_desc' ? -1 : 1) * (a.price_range.min_rm - b.price_range.min_rm);
        });
        const pageNumber = Number(params.page), size = Number(params.page_size || 25), total = items.length;
        items = items.slice((pageNumber - 1) * size, pageNumber * size);
        return route.fulfill({ json: { items, count: items.length, total, page: pageNumber, page_size: size, total_pages: Math.ceil(total / size), price_context: 'ready', price_store_count: 1 } });
      }
      if (url.pathname.endsWith('/items/categories')) return route.fulfill({ json: { categories: [], count: 0 } });
      return route.fulfill({ status: 503, json: {} });
    });
    await page.goto(`${base}/shop`);
    const checkbox = page.getByRole('checkbox', { name: 'SARA categories only', exact: true });
    const sort = page.getByRole('button', { name: /^Sort by:/ });
    await page.locator('.product-card h3').first().waitFor();
    assert.equal(await sort.getAttribute('aria-label'), 'Sort by: Cheapest first');
    assert.equal(await checkbox.isChecked(), false);
    assert.equal(requests.at(-1).sort, 'price_asc');
    assert.equal((await page.locator('.product-card h3').first().innerText()).toLowerCase(), 'item 01');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('heading', { name: /^Item 16$/i, exact: true }).waitFor();
    await checkbox.check();
    await page.getByRole('heading', { name: /^Item 01$/i, exact: true }).waitFor();
    assert.equal(requests.at(-1).page, '1');
    assert.equal(requests.at(-1).sara_category_only, 'true');
    const names = await page.locator('.product-card h3').allTextContents();
    assert.equal(names.length, 11);
    assert(names.every(name => Number(name.split(' ')[1]) % 2 === 1));
    await sort.click();
    await page.getByRole('menuitemradio', { name: 'Highest price first', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.product-card h3')?.textContent.toLowerCase() === 'item 19');
    assert.equal((await page.locator('.product-card h3').allTextContents()).at(-1).toLowerCase(), 'item 21');
    await sort.click();
    await page.getByRole('menuitemradio', { name: 'Name: Z–A', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.product-card h3')?.textContent.toLowerCase() === 'item 21');
    await checkbox.uncheck();
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length === 15);
    assert.equal(requests.at(-1).sara_category_only, 'false');
    const add = async name => {
      await page.getByRole('button', { name: new RegExp(`Add to basket: ${name}`, 'i') }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Add to basket', exact: true }).click();
    };
    await sort.click();
    await page.getByRole('menuitemradio', { name: 'Cheapest first', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.product-card h3')?.textContent.toLowerCase() === 'item 01');
    await add('Item 01'); await add('Item 02'); await add('Item 03');
    const rows = page.locator('.basket-rail .basket-row');
    assert.equal(await rows.count(), 3);
    const rowHeights = await rows.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    assert(Math.max(...rowHeights) - Math.min(...rowHeights) <= 1, 'Basket rows with and without SARA tags differ in height');
    for (const row of await rows.all()) {
      const box = await row.boundingBox();
      assert(box.height <= 112, `Basket row is too tall: ${box.height}px`);
      const quantity = await row.locator('.quantity-selector').boundingBox();
      assert(quantity.x + quantity.width <= box.x + box.width + 1);
      const metadata = await row.locator('.basket-sara').boundingBox();
      assert(Math.abs(quantity.y + quantity.height - metadata.y - metadata.height) <= 1, 'Quantity controls do not align with the metadata bottom');
      const remove = await row.locator('.basket-remove').boundingBox();
      assert(remove.y + remove.height <= quantity.y, 'Remove overlaps quantity controls');
      assert.equal(await row.locator('.basket-product-icon').isVisible(), true);
      const name = await row.locator('h3').boundingBox();
      const unit = await row.locator('.basket-sara > small').boundingBox();
      const thumbnail = await row.locator('.basket-product-icon').boundingBox();
      assert(Math.abs(name.x - unit.x) <= 1, 'Basket text is misaligned');
      assert(Math.abs(name.y - thumbnail.y) <= 3, 'Image and title are misaligned');
      assert(Math.abs((name.y + name.height / 2) - (remove.y + remove.height / 2)) <= 3, 'Title and remove button are misaligned');
      if (await row.locator('.basket-sara > span').count()) {
        const tag = await row.locator('.basket-sara > span').boundingBox();
        assert(Math.abs((unit.y - name.y - name.height) - (tag.y - unit.y - unit.height)) <= 1, 'Basket text gaps differ');
      }
    }
    const longName = rows.locator('h3').filter({ hasText: /extra long/i });
    assert.equal(await longName.evaluate(node => getComputedStyle(node).textOverflow), 'ellipsis');
    assert(await longName.evaluate(node => node.scrollWidth > node.clientWidth));
    const firstRow = rows.filter({ has: page.locator('h3', { hasText: /Item 01/i }) });
    await firstRow.getByRole('button', { name: /Increase .* quantity/i }).click();
    assert.equal(await firstRow.getByRole('textbox').inputValue(), '2');
    await firstRow.getByRole('button', { name: /Decrease .* quantity/i }).click();
    assert.equal(await firstRow.getByRole('textbox').inputValue(), '1');
    await rows.filter({ has: page.locator('h3', { hasText: /Item 02/i }) }).getByRole('button', { name: /^Remove /i }).click();
    assert.equal(await rows.count(), 2);
    await sort.click();
    const desktopMenu = page.getByRole('menu', { name: 'Sort options', exact: true });
    const desktopBarBox = await page.locator('.catalogue-controls').boundingBox();
    assert(Math.abs(desktopBarBox.width - (await desktopMenu.boundingBox()).width) < 2);
    const categoryWidth = (await page.locator('.catalogue-categories > button').boundingBox()).width;
    assert(Math.abs(categoryWidth / (await sort.boundingBox()).width - 2) < 0.03);
    await page.screenshot({ path: path.resolve('.tmp/catalogue-controls-desktop.png'), fullPage: false, animations: "disabled" });
    await page.keyboard.press('Escape');
    await page.locator('.catalogue-categories > button').click();
    const categoryPopup = page.locator('#category-options');
    assert(Math.abs((await categoryPopup.boundingBox()).width - desktopBarBox.width) < 2);
    await sort.click();
    assert.equal(await categoryPopup.count(), 0);
    await page.keyboard.press('Escape');
    await page.locator('.basket-rail-action button').click();
    await page.waitForURL('**/basket');
    await page.waitForFunction(() => { const node = document.querySelector('.basket-review-actions'); return node && getComputedStyle(node).display === 'grid'; });
    const backToShop = page.getByRole('button', { name: 'Back to shop', exact: true });
    const compare = page.getByRole('button', { name: 'Compare Stores', exact: true });
    const backBox = await backToShop.boundingBox(), compareBox = await compare.boundingBox();
    assert(Math.abs(backBox.y - compareBox.y) < 1);
    assert(Math.abs(backBox.width - compareBox.width) <= 1, 'Basket footer button widths differ');
    assert(backBox.x + backBox.width < compareBox.x);
    assert.equal(await page.locator('.basket-review .basket-row').count(), 2);
    const saraColumn = await page.locator('.basket-columns > span').nth(1).boundingBox();
    const sizeColumn = await page.locator('.basket-columns > span').nth(2).boundingBox();
    assert(saraColumn.width <= 128 && sizeColumn.width >= 112);
    await page.screenshot({ path: path.resolve('.tmp/basket-review-desktop.png'), fullPage: false, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.basket-review h1').evaluate(node => getComputedStyle(node).marginTop), '0px');
    const mobileRows = page.locator('.basket-review .basket-row');
    for (const row of await mobileRows.all()) {
      const box = await row.boundingBox();
      const title = await row.locator('h3').boundingBox();
      const unit = await row.locator('.basket-compact-size').boundingBox();
      const image = await row.locator('.basket-product-icon').boundingBox();
      const metadata = await row.locator('.basket-sara').boundingBox();
      const quantity = await row.locator('.quantity-selector').boundingBox();
      const remove = await row.locator('.basket-remove').boundingBox();
      assert(box.height <= 112);
      assert(Math.abs(title.x - unit.x) <= 1);
      assert(Math.abs(title.y - image.y) <= 3);
      assert(Math.abs(quantity.y + quantity.height - metadata.y - metadata.height) <= 1);
      assert(remove.y + remove.height <= quantity.y);
      assert.equal(await row.locator('h3').evaluate(node => getComputedStyle(node).textOverflow), 'ellipsis');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert(Math.abs((await backToShop.boundingBox()).width - (await compare.boundingBox()).width) <= 1);
    await page.screenshot({ path: path.resolve('.tmp/basket-review-mobile.png'), fullPage: false, animations: 'disabled' });
    await backToShop.click();
    await page.waitForURL('**/shop');
    assert.equal(await page.locator('.basket-rail .basket-row').count(), 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await checkbox.scrollIntoViewIfNeeded();
    const bounds = await page.locator('.catalogue-controls').boundingBox();
    const categories = await page.locator('.catalogue-categories > button').boundingBox();
    assert(categories.x >= bounds.x && categories.x <= bounds.x + 2);
    assert(bounds.height <= 48);
    assert((await checkbox.boundingBox()).y > bounds.y + bounds.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await checkbox.check();
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length === 11);
    await page.screenshot({ path: path.resolve('.tmp/catalogue-controls-mobile.png'), fullPage: false, animations: "disabled" });
    await sort.click();
    const menu = page.getByRole('menu', { name: 'Sort options', exact: true });
    const menuBounds = await menu.boundingBox();
    assert(Math.abs(menuBounds.width - bounds.width) < 2);
    assert(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 390);
    await page.screenshot({ path: path.resolve('.tmp/catalogue-sort-popup-mobile.png'), fullPage: false, animations: "disabled" });
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.product-card h3')?.textContent.toLowerCase() === 'item 01');
    assert.equal(await menu.count(), 0);
    assert.equal(await sort.getAttribute('aria-label'), 'Sort by: Cheapest first');
    await sort.click();
    await page.keyboard.press('Escape');
    assert.equal(await sort.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(errors, []);
    console.log('PASS: filters and sorting, full-width popups, 2:1 controls, compact basket rows, quantity/remove actions, and responsive layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

