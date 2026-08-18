const { test, expect } = require('@playwright/test');

test('homepage and primary navigation load without browser errors', async ({ page }) => {
  const errors = [];
  const failedLocalRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4173/')) {
      failedLocalRequests.push(`${request.url()}: ${request.failure().errorText}`);
    }
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/GOD4\.US/);
  await expect(page.locator('nav')).toContainText('Open Bibles');
  await expect(page.locator('nav')).toContainText('Sacred Verses');
  await expect(page.locator('nav')).toContainText('Study');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  expect([...errors, ...failedLocalRequests], [...errors, ...failedLocalRequests].join('\n')).toEqual([]);
});

test('hero verse can be saved, unsaved, and shown in the saved-verses tray', async ({ page }) => {
  await page.goto('/');
  const saveButton = page.locator('#heroFav');
  await saveButton.click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await expect(saveButton).toHaveText('♥');

  await page.locator('.saved-pill').click();
  await expect(page.locator('#tray')).toHaveCSS('right', '0px');
  await expect(page.locator('#trayList')).toContainText('John 3:16');

  await page.locator('#tray button').first().click();
  await saveButton.click();
  await expect(page.locator('#savedCount')).toHaveText('0');
});

test('verse rotation and Scripture search work', async ({ page }) => {
  await page.goto('/');
  const reference = page.locator('#verseRef');
  const initial = await reference.textContent();
  await page.getByRole('button', { name: 'Another verse' }).click();
  await expect(reference).not.toHaveText(initial);

  await page.locator('#searchInput').fill('faith');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.locator('#results .result-card')).toHaveCount(1);
  await expect(page.locator('#results')).toContainText('Hebrews 11:1');
});

test('reader controls, highlighting, fullscreen, compare, and plan views work', async ({ page }) => {
  await page.goto('/');
  const reader = page.locator('#view-reader');
  await expect(reader).toHaveClass(/active/);

  await page.locator('#bookSelect').selectOption('psalms');
  await expect(page.locator('#readerContent')).toContainText('Psalms 1');
  await page.locator('#chapterSelect').selectOption('2');
  await expect(page.locator('#readerContent')).toContainText('Psalms 2');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#readerContent')).toContainText('Psalms 3');
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.locator('#readerContent')).toContainText('Psalms 2');

  const verseNumber = page.locator('#readerContent .vnum').first();
  await verseNumber.click();
  await expect(verseNumber).toHaveClass(/highlighted/);

  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await expect(page.locator('#fsOverlay')).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Exit Fullscreen' }).click();
  await expect(page.locator('#fsOverlay')).not.toHaveClass(/active/);

  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await page.locator('#compareBook').selectOption('psalm23');
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid')).toContainText('The LORD is my shepherd');

  await page.getByRole('button', { name: 'Plan' }).click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await expect(page.locator('#planDone')).toHaveText('14 of 30 days');

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(reader).toHaveClass(/active/);
});
