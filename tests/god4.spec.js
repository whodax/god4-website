const { test, expect } = require('@playwright/test');

test('homepage and primary navigation load without browser errors', async ({ page }, testInfo) => {
  const errors = [];
  const failedLocalRequests = [];
  const localOrigin = new URL(testInfo.project.use.baseURL).origin;
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(`${localOrigin}/`)) {
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

  await page.locator('#tray button[onclick="toggleTray()"]').click();
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
  await expect.poll(() => page.locator('#results .result-card').count()).toBeGreaterThan(0);
  await expect(page.locator('#results')).toContainText('Hebrews 11:1');
});

test('Bible data interface exposes the current local dataset', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => ({
    translations: BibleData.listTranslations().map((translation) => translation.id),
    books: BibleData.listBooks('demo-local').map((book) => book.id),
    chapterCount: BibleData.getChapterCount('demo-local', 'john'),
    verse: BibleData.getVerse('demo-local', 'john', 1, 1).text
  }))).toEqual({
    translations: ['demo-local', 'web'],
    books: ['john', 'psalms', 'romans', 'genesis', 'matthew', 'philippians'],
    chapterCount: 3,
    verse: 'In the beginning was the Word, and the Word was with God, and the Word was God.'
  });
});

test('WEB data is complete, attributed, searchable, and selectable', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'web'),
    bookCount: BibleData.listBooks('web').length,
    chapterCount: BibleData.getChapterCount('web', 'john'),
    verse: BibleData.getVerse('web', 'john', 3, 16).text,
    searchMatch: BibleData.search('web', 'only born Son').some((match) => match.bookId === 'john' && match.chapter === 3 && match.verse === 16)
  }))).toMatchObject({
    metadata: {
      abbreviation: 'WEB',
      copyrightStatus: 'Public domain',
      provider: 'web-library'
    },
    bookCount: 66,
    chapterCount: 21,
    verse: 'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.',
    searchMatch: true
  });

  await page.locator('#readerTranslation').selectOption('web');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  await expect(page.locator('#readerContent')).toContainText('In the beginning was the Word');

  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareGrid select').first().selectOption('web');
  await expect(page.locator('#compareGrid .compare-col').first()).toContainText('For God so loved the world');
});

test('reader read-aloud controls speak only chapter verses and manage playback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [], pauses: 0, resumes: 0, cancels: 0 };
    const utterance = function(text) {
      this.text = text;
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    const synthesis = {
      speaking: false,
      paused: false,
      speak(utterance) {
        this.speaking = true;
        this.lastUtterance = utterance;
        window.__speech.spoken.push(utterance.text);
      },
      pause() {
        this.paused = true;
        window.__speech.pauses++;
      },
      resume() {
        this.paused = false;
        window.__speech.resumes++;
      },
      cancel() {
        this.speaking = false;
        this.paused = false;
        window.__speech.cancels++;
      }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  expect(await page.evaluate(() => window.__speech.spoken[0])).toBe('In the beginning was the Word, and the Word was with God, and the Word was God.');
  expect(await page.evaluate(() => window.__speech.spoken[0])).not.toContain('John 1');

  await page.getByRole('button', { name: 'Pause reading aloud' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud paused.');
  await page.getByRole('button', { name: 'Resume reading aloud' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Ready to read aloud.');

  await page.getByRole('button', { name: 'Play' }).click();
  const cancelsBeforeNavigation = await page.evaluate(() => window.__speech.cancels);
  await page.locator('#chapterSelect').selectOption('2');
  expect(await page.evaluate(() => window.__speech.cancels)).toBeGreaterThan(cancelsBeforeNavigation);
  await expect(page.locator('#readAloudStatus')).toHaveText('Ready to read aloud.');
});

test('reader read-aloud controls are disabled when Web Speech API is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('#readAloudStatus')).toHaveText('Read aloud is unavailable in this browser.');
  await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeDisabled();
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
  await expect(page.locator('#planDone')).toHaveText(/\d+ of 30 days/);

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(reader).toHaveClass(/active/);
});
