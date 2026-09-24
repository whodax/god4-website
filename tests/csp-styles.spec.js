const { test, expect } = require('@playwright/test');

async function expectNoAppInlineStyles(page) {
  expect(await page.evaluate(() => document.querySelectorAll('nav [style], main [style], #tray [style], #accountDialog [style]').length)).toBe(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('search results use finite stagger classes and never create inline styles', async ({ page }) => {
  await page.locator('#searchInput').fill('Genesis 1');
  await page.locator('#searchInput').press('Enter');
  const cards = page.locator('#results .result-card');
  await expect(cards).toHaveCount(10);
  for (const [index, delay] of [[0, '0s'], [1, '0.03s'], [9, '0.27s']]) {
    await expect(cards.nth(index)).toHaveClass(new RegExp(`search-delay-${index}`));
    await expect(cards.nth(index)).toHaveCSS('animation-delay', delay);
  }
  await page.locator('#results .search-more').click();
  await expect(cards).toHaveCount(20);
  await expect(cards.nth(10)).toHaveClass(/search-delay-9/);
  await expect(cards.nth(10)).toHaveCSS('animation-delay', '0.27s');
  await expect(page.locator('#results .result-card[style]')).toHaveCount(0);
});

test('hero rotation uses the fading class and restores opacity', async ({ page }) => {
  await page.locator('.refresh-btn').click();
  await expect(page.locator('#leafCard')).toHaveClass(/is-fading/);
  await expect(page.locator('#leafCard')).not.toHaveClass(/is-fading/);
  await expect(page.locator('#leafCard')).toHaveCSS('opacity', '1');
  await expect(page.locator('#leafCard[style]')).toHaveCount(0);
});

test('Saved Verses empty state, row styling, and tray position use classes', async ({ page }) => {
  await expect(page.locator('#trayEmpty')).toBeVisible();
  await page.locator('#heroFav').click();
  await expect(page.locator('#trayEmpty')).toBeHidden();
  await page.locator('.saved-pill').click();
  await expect(page.locator('#tray')).toHaveClass(/is-open/);
  await expect(page.locator('#tray')).toHaveCSS('right', '0px');
  const row = page.locator('#trayList .saved-verse-row');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveCSS('padding-bottom', '12px');
  await expect(row.locator('.saved-verse-text')).toHaveCSS('font-style', 'italic');
  await expect(row.locator('.saved-verse-text')).toHaveCSS('font-size', '14px');
  await expect(row.locator('.saved-verse-details')).toHaveCSS('display', 'flex');
  await expect(row.locator('.saved-verse-reference')).toHaveCSS('text-transform', 'uppercase');
  await expect(row.locator('.saved-verse-remove')).toHaveCSS('cursor', 'pointer');
  await expect(page.locator('#tray [style]')).toHaveCount(0);
  await page.locator('#closeTray').click();
  await expect(page.locator('#tray')).not.toHaveClass(/is-open/);
  await expect(page.locator('#tray')).toHaveCSS('right', '-360px');
  await expect(page.locator('.saved-pill')).toBeFocused();
  await expect(page.locator('#tray [style]')).toHaveCount(0);
});

test('Reader chapter caption keeps its computed styling without inline markup', async ({ page }) => {
  const caption = page.locator('#readerContent .reader-chapter-caption');
  await expect(caption).toBeVisible();
  await expect(caption).toHaveCSS('text-align', 'center');
  await expect(caption).toHaveCSS('font-size', '14px');
  await expect(caption).toHaveCSS('font-style', 'italic');
  await expect(caption).toHaveCSS('margin-bottom', '20px');
  await expect(caption).not.toHaveAttribute('style');
});

test('representative application flows create no first-party inline styles', async ({ page }) => {
  await expectNoAppInlineStyles(page);
  await page.locator('#searchInput').fill('Genesis 1');
  await page.locator('#searchInput').press('Enter');
  await page.locator('#results .search-more').click();
  await expectNoAppInlineStyles(page);
  await page.locator('.refresh-btn').click();
  await expect(page.locator('#leafCard')).not.toHaveClass(/is-fading/);
  await page.locator('#heroFav').click();
  await page.locator('.saved-pill').click();
  await expectNoAppInlineStyles(page);
  await page.locator('#closeTray').click();
  await expect(page.locator('#readerContent .reader-chapter-caption')).toBeVisible();
  await page.locator('[aria-controls="view-compare"].bs-btn').click();
  await expect(page.locator('#compareGrid .compare-col').first()).toBeVisible();
  await expectNoAppInlineStyles(page);
  await page.locator('[aria-controls="view-plan"].bs-btn').click();
  await page.locator('[data-plan-day="1"]').click();
  await expect(page.locator('#planFill')).toHaveClass(/plan-progress-days-1/);
  await expectNoAppInlineStyles(page);
  await page.locator('#accountTrigger').click();
  await expect(page.locator('#accountDialog')).toBeVisible();
  await expectNoAppInlineStyles(page);
});