const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('god4.translation'));
  await page.evaluate(() => localStorage.removeItem('god4.compare'));
  await page.reload();
});

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

test('header cross mark includes an activated heart and four motion rays', async ({ page }) => {
  await page.goto('/');
  const mark = page.locator('#brandMark');
  await expect(mark).toHaveAccessibleName('Activate cross heart');
  const initial = await mark.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    crossWidth: getComputedStyle(element.querySelector('.brand-cross')).strokeWidth,
    crossColor: getComputedStyle(element.querySelector('.brand-cross')).stroke,
    heartCount: element.querySelectorAll('.brand-heart').length,
    rayCount: element.querySelectorAll('.brand-rays path').length,
    heartCenter: (() => { const box = element.querySelector('.brand-heart').getBBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; })(),
    heartAnimation: getComputedStyle(element.querySelector('.brand-heart')).animationDuration,
    raysAnimation: getComputedStyle(element.querySelector('.brand-rays')).animationDuration
  }));
  expect(initial.width).toBe(60);
  expect(initial.height).toBe(60);
  expect(Number.parseFloat(initial.crossWidth)).toBeGreaterThanOrEqual(5);
  expect(initial.crossColor).toBe('rgb(184, 134, 43)');
  expect(initial.heartCount).toBe(1);
  expect(initial.rayCount).toBe(4);
  expect(initial.heartCenter.x).toBeCloseTo(36, 1);
  expect(initial.heartCenter.y).toBeCloseTo(36, 1);
    expect(initial.heartAnimation).toBe('3s');
    expect(initial.raysAnimation).toBe('3s');
  await expect(mark).toHaveClass(/brand-mark--pulse/);

  await mark.click();
  await expect(mark).toHaveClass(/brand-mark--pulse/);
  await expect.poll(() => mark.evaluate((element) => ({ heart: getComputedStyle(element.querySelector('.brand-heart')).animationDuration, rays: getComputedStyle(element.querySelector('.brand-rays')).animationDuration }))).toEqual({ heart: '3s', rays: '3s' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mark.click();
  await expect.poll(() => mark.evaluate((element) => ({ heart: getComputedStyle(element.querySelector('.brand-heart')).animationName, rays: getComputedStyle(element.querySelector('.brand-rays')).animationName }))).toEqual({ heart: 'none', rays: 'none' });
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
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#results .result-card')).toHaveCount(10);
  await expect(page.locator('#results .search-status')).toContainText(/Showing 10 of \d+ matches/);
});

test('Search the Word searches complete BibleData and opens references', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  const search = page.locator('#searchInput');
  const results = page.locator('#results');
  const runSearch = async (query) => {
    await search.fill(query);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    if(!(await results.locator('.result-card').count())) throw new Error(`No result for query: ${query}`);
    await expect(results.locator('.result-card').first()).toBeVisible();
  };

  await runSearch('Genesis 1');
  await expect(results).toContainText('Genesis 1');
  await results.locator('.result-card').first().click();
  await expect(page.locator('#readerContent')).toContainText('Genesis 1');

  await runSearch('John 1:1');
  await expect(results).toContainText('John 1:1');
  await results.locator('.result-card').first().click();
  await expect(page.locator('#readerContent')).toContainText('John 1');
  await expect(page.locator('#verseSelect')).toHaveValue('1');

  await runSearch('(John 1:1)');
  await runSearch('John chapter 1');
  await runSearch('John chapter 1 verse 1');
  await runSearch('Romans 8 verse 28');
  await runSearch('show me John 3:16');
  await runSearch('what does John 3:16 say');

  for (const reference of ['Genesis 1:1', 'Psalms 23:1', 'Isaiah 1:1', 'Matthew 1:1', 'John 1:1', 'Romans 1:1', '1 Corinthians 1:1', 'Revelation 1:1']) {
    await runSearch(reference);
    await expect(results.locator('.ref').first()).toContainText(reference);
  }

  await runSearch('Revelation 22:21');
  await expect(results).toContainText('Revelation 22:21');
  await search.fill('NotABook 999:999');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(results).toContainText('No verses matched');
});

test('Search exact verse references returns one result and opens that verse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  const search = page.locator('#searchInput');
  const results = page.locator('#results .result-card');
  for (const query of ['Genesis 1:26', '(Genesis 1:26)', 'Genesis chapter 1 verse 26', 'John 3:16', 'show me John 3:16', 'Revelation 22:21']) {
    await search.fill(query);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(results).toHaveCount(1);
  }
  await search.fill('Genesis 1:26');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await results.first().click();
  await expect(page.locator('#bookSelect')).toHaveValue('genesis');
  await expect(page.locator('#chapterSelect')).toHaveValue('1');
  await expect(page.locator('#verseSelect')).toHaveValue('26');
  await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number', '26');
});

test('Search results progressively reveal broad matches and clear cleanly', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  const search = page.locator('#searchInput');
  const results = page.locator('#results');
  const searchButton = page.getByRole('button', { name: 'Search', exact: true });
  await search.fill('faith');
  await searchButton.click();
  await expect(results.locator('.result-card')).toHaveCount(10);
  await expect(results.locator('.search-status')).toContainText(/Showing 10 of \d+ matches/);
  await expect(results.locator('.search-more')).toBeVisible();
  await results.locator('.search-more').click();
  await expect(results.locator('.result-card')).toHaveCount(20);

  await search.fill('John 3:16');
  await searchButton.click();
  await expect(results.locator('.result-card')).toHaveCount(1);
  await search.fill('');
  await expect(results.locator('.result-card')).toHaveCount(0);
  await expect(results.locator('.search-more, .search-status, .no-results')).toHaveCount(0);

  await search.fill('faith');
  await searchButton.click();
  await page.locator('#searchClear').click();
  await expect(search).toHaveValue('');
  await expect(results.locator('.result-card, .search-more, .search-status, .no-results')).toHaveCount(0);

  await search.fill('faith');
  await searchButton.click();
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(results.locator('.result-card')).toHaveCount(0);

  await search.fill('Genesis 1:26');
  await searchButton.click();
  await expect(results.locator('.result-card')).toHaveCount(1);
  await search.fill('Revelation 22:21');
  await searchButton.click();
  await expect(results.locator('.result-card')).toHaveCount(1);
});

test('Bible data interface exposes the current local dataset', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
  await expect(page.locator('#readerTranslation option:checked')).not.toHaveText('');
  expect(await page.evaluate(() => ({
    translations: BibleData.listTranslations().map((translation) => translation.id),
    books: BibleData.listBooks('demo-local').map((book) => book.id),
    chapterCount: BibleData.getChapterCount('demo-local', 'john'),
    verse: BibleData.getVerse('demo-local', 'john', 1, 1).text
  }))).toEqual({
    translations: ['demo-local', 'web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv'],
    books: ['john', 'psalms', 'romans', 'genesis', 'matthew', 'philippians'],
    chapterCount: 3,
    verse: 'In the beginning was the Word, and the Word was with God, and the Word was God.'
  });
});

test('ASV is complete and available through BibleData', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'asv'),
    bookCount: BibleData.listBooks('asv').length,
    genesis: BibleData.getChapter('asv', 'genesis', 1),
    psalm23: BibleData.getChapter('asv', 'psalms', 23),
    john3: BibleData.getChapter('asv', 'john', 3),
    romans8: BibleData.getChapter('asv', 'romans', 8),
    firstCorinthians13: BibleData.getChapter('asv', '1-corinthians', 13)
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'ASV', name: 'American Standard Version (1901)', copyrightStatus: 'Public domain' });
  expect(result.bookCount).toBe(66);
  expect(result.genesis.verses.length).toBeGreaterThan(0);
  expect(result.psalm23.verses.length).toBeGreaterThan(0);
  expect(result.john3.verses.length).toBeGreaterThan(0);
  expect(result.romans8.verses.length).toBeGreaterThan(0);
  expect(result.firstCorinthians13.verses.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => BibleData.getVerse('asv', '1-corinthians', 13, 4).text)).toBeTruthy();
});

test('Reader switches between WEB and ASV and persists ASV', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('asv');
  await page.locator('#bookSelect').selectOption('genesis');
  await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  await expect(page.locator('#readerContent')).toContainText('Genesis 1');
  await page.reload();
  await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  await page.locator('#readerTranslation').selectOption('web');
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
});

test('Compare renders WEB and ASV for the same current reference and excludes DEMO', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3:16');
  await expect(page.locator('#compareGrid [data-compare-side="left"]')).toHaveValue('web');
  await expect(page.locator('#compareGrid [data-compare-side="right"]')).toHaveValue('asv');
  await expect(page.locator('#compareGrid [data-compare-side="left"] option[value="demo-local"]')).toHaveCount(0);
  await expect(page.locator('#compareGrid [data-compare-side="right"] option[value="demo-local"]')).toHaveCount(0);
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['16']);
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['16']);
  await page.locator('#compareGrid [data-compare-side="left"]').selectOption('asv');
  await expect(page.locator('#compareGrid [data-compare-side="right"]')).toHaveValue('web');
});

test('KJV is complete and preserves the imported source wording', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'kjv'),
    bookCount: BibleData.listBooks('kjv').length,
    genesis: BibleData.getChapter('kjv', 'genesis', 1),
    psalm23: BibleData.getChapter('kjv', 'psalms', 23),
    john3: BibleData.getChapter('kjv', 'john', 3),
    romans8: BibleData.getChapter('kjv', 'romans', 8),
    firstCorinthians13: BibleData.getChapter('kjv', '1-corinthians', 13),
    john316: BibleData.getVerse('kjv', 'john', 3, 16).text
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'KJV', name: 'King James Version' });
  expect(result.bookCount).toBe(66);
  expect(result.genesis.verses.length).toBeGreaterThan(0);
  expect(result.psalm23.verses.length).toBeGreaterThan(0);
  expect(result.john3.verses.length).toBeGreaterThan(0);
  expect(result.romans8.verses.length).toBeGreaterThan(0);
  expect(result.firstCorinthians13.verses.length).toBeGreaterThan(0);
  expect(result.john316).toBe('For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.');
});

test('Compare independently selects WEB, ASV, and KJV without exposing DEMO', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();

  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  await expect(left).toHaveValue('web');
  await expect(right).toHaveValue('asv');
  await expect(left.locator('option[value="demo-local"]')).toHaveCount(0);
  await expect(right.locator('option[value="demo-local"]')).toHaveCount(0);
  await expect(left.locator('option[value="kjv"]')).toHaveCount(1);
  await expect(right.locator('option[value="kjv"]')).toHaveCount(1);

  await left.selectOption('kjv');
  await expect(left).toHaveValue('kjv');
  await expect(right).toHaveValue('asv');
  await right.selectOption('web');
  await expect(right).toHaveValue('web');
  await expect(left).toHaveValue('kjv');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['16']);
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['16']);
});

test('YLT is complete and Compare keeps all real translations independent', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'ylt'),
    bookCount: BibleData.listBooks('ylt').length,
    chapters: ['genesis', 'psalms', 'john', 'romans', '1-corinthians'].map((bookId, index) => BibleData.getChapter('ylt', bookId, [1, 23, 3, 8, 13][index]).verses.length),
    john316: BibleData.getVerse('ylt', 'john', 3, 16).text
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'YLT', name: 'Young’s Literal Translation', copyrightStatus: 'Public domain' });
  expect(result.bookCount).toBe(66);
  expect(result.chapters.every((count) => count > 0)).toBeTruthy();
  expect(result.john316).toBe('for God did so love the world, that His Son — the only begotten — He gave, that every one who is believing in him may not perish, but may have life age-during.');

  await page.locator('#readerTranslation').selectOption('web');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  await expect(left).toHaveValue('web');
  await expect(right).toHaveValue('asv');
  for (const selector of [left, right]) {
    await expect(selector.locator('option[value="demo-local"]')).toHaveCount(0);
    await expect(selector.locator('option[value="ylt"]')).toHaveCount(1);
  }
  await left.selectOption('ylt');
  await expect(left).toHaveValue('ylt');
  await expect(right).toHaveValue('asv');
  await right.selectOption('kjv');
  await expect(right).toHaveValue('kjv');
  await expect(left).toHaveValue('ylt');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['16']);
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['16']);
});

test('DBY is complete and independently available in Reader and Compare', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'dby'),
    bookCount: BibleData.listBooks('dby').length,
    chapters: ['genesis', 'psalms', 'john', 'romans', '1-corinthians'].map((bookId, index) => BibleData.getChapter('dby', bookId, [1, 23, 3, 8, 13][index]).verses.length),
    john316: BibleData.getVerse('dby', 'john', 3, 16).text
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'DBY', name: 'Darby Translation', copyrightStatus: 'Public domain' });
  expect(result.bookCount).toBe(66);
  expect(result.chapters.every((count) => count > 0)).toBeTruthy();
  expect(result.john316).toBe('For God so loved the world, that he gave his only-begotten Son, that whosoever believes on him may not perish, but have life eternal.');

  await page.locator('#readerTranslation').selectOption('dby');
  await expect(page.locator('#readerTranslation')).toHaveValue('dby');
  await page.reload();
  await expect(page.locator('#readerTranslation')).toHaveValue('dby');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  await expect(left).toHaveValue('dby');
  await expect(right).toHaveValue('web');
  await expect(left.locator('option[value="demo-local"]')).toHaveCount(0);
  await expect(right.locator('option[value="demo-local"]')).toHaveCount(0);
  await left.selectOption('asv');
  await expect(left).toHaveValue('asv');
  await expect(right).toHaveValue('web');
  await right.selectOption('ylt');
  await expect(right).toHaveValue('ylt');
  await expect(left).toHaveValue('asv');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['16']);
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['16']);
});

test('WBS is complete and independently available in Reader and Compare', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'webster'),
    bookCount: BibleData.listBooks('webster').length,
    chapters: ['genesis', 'psalms', 'john', 'romans', '1-corinthians'].map((bookId, index) => BibleData.getChapter('webster', bookId, [1, 23, 1, 8, 13][index]).verses.length),
    johnOne: BibleData.getChapter('webster', 'john', 1),
    johnThree: BibleData.getChapter('webster', 'john', 3)
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'WBS', name: 'Webster Bible (1833)', copyrightStatus: 'Public domain' });
  expect(result.bookCount).toBe(66);
  expect(result.chapters.every((count) => count > 0)).toBeTruthy();
  expect(result.johnOne.verses.length).toBeGreaterThan(0);
  expect(result.johnThree.verses.length).toBeGreaterThan(0);
  await page.locator('#readerTranslation').selectOption('webster');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('1');
  await expect(page.locator('#readerTranslation')).toHaveValue('webster');
  await page.reload();
  await expect(page.locator('#readerTranslation')).toHaveValue('webster');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  await expect(left).toHaveValue('webster');
  await expect(right).not.toHaveValue('webster');
  await expect(left.locator('option[value="demo-local"]')).toHaveCount(0);
  await expect(right.locator('option[value="demo-local"]')).toHaveCount(0);
  await left.selectOption('web');
  await expect(left).toHaveValue('web');
  await expect(right).not.toHaveValue('web');
  await right.selectOption('webster');
  await expect(right).toHaveValue('webster');
  await expect(left).toHaveValue('web');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['16']);
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['16']);
});

test('RV is complete and independently available in Reader and Compare', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'rv'),
    bookCount: BibleData.listBooks('rv').length,
    chapters: ['genesis', 'psalms', 'john', 'romans', '1-corinthians'].map((bookId, index) => BibleData.getChapter('rv', bookId, [1, 23, 1, 8, 13][index]).verses.length),
    john316: BibleData.getVerse('rv', 'john', 3, 16).text
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'RV', name: 'Revised Version (1895)', copyrightStatus: 'Public domain' });
  expect(result.bookCount).toBe(66);
  expect(result.chapters.every((count) => count > 0)).toBeTruthy();
  await page.locator('#readerTranslation').selectOption('rv');
  await expect(page.locator('#readerTranslation')).toHaveValue('rv');
  await page.reload();
  await expect(page.locator('#readerTranslation')).toHaveValue('rv');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await page.getByRole('button', { name: 'Compare' }).click();
  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  await expect(left).toHaveValue('rv');
  await expect(right).not.toHaveValue('rv');
  await expect(left.locator('option[value="demo-local"]')).toHaveCount(0);
  await expect(right.locator('option[value="demo-local"]')).toHaveCount(0);
  const johnThreeVerseCount = await page.evaluate(() => BibleData.getChapter('rv', 'john', 3).verses.length);
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveCount(johnThreeVerseCount);
  await page.locator('#compareVerse').selectOption('16');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3:16');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['16']);
  await left.selectOption('web');
  await expect(left).toHaveValue('web');
  await expect(right).not.toHaveValue('web');
  await right.selectOption('rv');
  await expect(right).toHaveValue('rv');
  await expect(left).toHaveValue('web');
});

test('GNV preserves historical spelling and works independently in Reader and Compare', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'gnv'),
    bookCount: BibleData.listBooks('gnv').length,
    chapters: ['genesis', 'psalms', 'john', 'romans', '1-corinthians'].map((bookId, index) => BibleData.getChapter('gnv', bookId, [1, 23, 1, 8, 13][index]).verses.length),
    johnOne: BibleData.getVerse('gnv', 'john', 1, 1).text,
    john316: BibleData.getVerse('gnv', 'john', 3, 16).text,
    residual: BibleData.listBooks('gnv').flatMap((book) => {
      const matches = [];
      for(let chapter = 1; chapter <= BibleData.getChapterCount('gnv', book.id); chapter++){
        BibleData.getChapter('gnv', book.id, chapter).verses.forEach((text, index) => {
          if(/\\[A-Za-z+]|strong=\"/i.test(text)) matches.push(`${book.id} ${chapter}:${index + 1}`);
        });
      }
      return matches;
    })
  }));
  expect(result.metadata).toMatchObject({ abbreviation: 'GNV', name: 'Geneva Bible 1599', copyrightStatus: 'Public domain' });
  expect(result.bookCount).toBe(66);
  expect(result.chapters.every((count) => count > 0)).toBeTruthy();
  expect(result.johnOne).toContain('In the beginning was that Word');
  expect(result.john316).toContain('loued');
  expect(result.john316).toContain('whosoeuer beleeueth');
  expect(result.residual).toEqual([]);
  await page.locator('#readerTranslation').selectOption('gnv');
  await expect(page.locator('#readerTranslation')).toHaveValue('gnv');
  await page.reload();
  await expect(page.locator('#readerTranslation')).toHaveValue('gnv');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  await expect(left).toHaveValue('gnv');
  await expect(right).not.toHaveValue('gnv');
  await expect(left.locator('option[value="demo-local"]')).toHaveCount(0);
  await expect(right.locator('option[value="demo-local"]')).toHaveCount(0);
  await left.selectOption('web');
  await expect(left).toHaveValue('web');
  await expect(right).not.toHaveValue('web');
  await right.selectOption('gnv');
  await expect(right).toHaveValue('gnv');
  await expect(left).toHaveValue('web');
});

test('DBY strips inline USFM markup without losing verse words', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const residual = [];
    BibleData.listBooks('dby').forEach((book) => {
      for (let chapterNumber = 1; chapterNumber <= BibleData.getChapterCount('dby', book.id); chapterNumber++) {
        const chapter = BibleData.getChapter('dby', book.id, chapterNumber);
        chapter.verses.forEach((text, index) => {
          if (/\\\+?w(?:\*|\s)|strong="/i.test(text)) residual.push(`${book.id} ${chapterNumber}:${index + 1}`);
        });
      }
    });
    return {
      johnOne: BibleData.getVerse('dby', 'john', 1, 1).text,
      plusWordVerse: BibleData.getVerse('dby', 'matthew', 1, 21).text,
      residual
    };
  });
  expect(result.johnOne).toContain('In [the] beginning was the Word');
  expect(result.plusWordVerse).toContain('he shall save his people from their sins');
  expect(result.johnOne).not.toMatch(/\\\+?w|strong="/i);
  expect(result.plusWordVerse).not.toMatch(/\\\+?w|strong="/i);
  expect(result.residual).toEqual([]);
});

test('translation selector keeps a visible label when changed', async ({ page }) => {
  await page.goto('/');
  const translation = page.locator('#readerTranslation');
  await translation.selectOption('web');
  await expect(translation).toHaveValue('web');
  await expect(translation.locator('option:checked')).toHaveText(/WEB.*World English Bible Protestant Edition/);
  await translation.selectOption('demo-local');
  await expect(translation.locator('option:checked')).toHaveText(/DEMO.*Current Demo Bible/);
});

test('translation preference persists across reloads', async ({ page }) => {
  await page.goto('/');
  const translation = page.locator('#readerTranslation');
  await translation.selectOption('demo-local');
  await page.reload();
  await expect(translation).toHaveValue('demo-local');
  await expect(translation.locator('option:checked')).toHaveText(/DEMO.*Current Demo Bible/);
});

test('translation selector safely selects the first option when state is invalid', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('god4.translation', 'missing-translation'));
  await page.goto('/');
  const translation = page.locator('#readerTranslation');
  await expect(translation).toHaveValue('demo-local');
  await expect(translation.locator('option:checked')).not.toHaveText('');
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
  await expect(page.locator('#compareSummary')).toContainText('Comparing John 1');
  await expect(page.locator('#compareGrid .compare-col').first()).toContainText('In the beginning was the Word');
});

test('Compare opens from the live Reader reference with and without a selected verse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('1');
  await expect(page.locator('#verseSelect')).toHaveValue('');

  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1');
  await expect(page.locator('#compareGrid .compare-col').first()).toContainText('In the beginning was the Word');
  await expect(page.locator('#compareGrid .compare-col').first()).not.toContainText('For God so loved the world');

  await page.getByRole('button', { name: 'Reader' }).click();
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3:16');
});

test('Compare follows a selected verse in another Reader book', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bookSelect').selectOption('colossians');
  await page.locator('#chapterSelect').selectOption('2');
  await page.locator('#verseSelect').selectOption('1');
  await page.getByRole('button', { name: 'Compare' }).click();

  await expect(page.locator('#compareSummary')).toHaveText('Comparing Colossians 2:1');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['1']);
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
  await page.locator('#readerTranslation').selectOption('demo-local');

  await page.locator('#readAloudPlay').click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  expect(await page.evaluate(() => window.__speech.spoken[0])).toBe('In the beginning was the Word, and the Word was with God, and the Word was God.');
  expect(await page.evaluate(() => window.__speech.spoken[0])).not.toContain('John 1');

  await page.getByRole('button', { name: 'Pause reading aloud' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud paused.');
  await page.getByRole('button', { name: 'Resume reading aloud' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  await page.locator('#readAloudStop').click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Ready to read aloud.');

  await page.locator('#readAloudPlay').click();
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
  await expect(page.locator('#readAloudPlay')).toBeDisabled();
  await expect(page.locator('#readAloudStop')).toBeDisabled();
});

test('verse read-aloud shares chapter speech and applies persisted speed and voice', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [], cancels: 0, voices: [
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Extra One', lang: 'en-US', localService: true },
      { name: 'Extra Two', lang: 'en-US', localService: true },
      { name: 'Extra Three', lang: 'en-US', localService: true },
      { name: 'Extra Four', lang: 'en-US', localService: true },
      { name: 'Extra Five', lang: 'en-US', localService: true }
    ] };
    const utterance = function(text) {
      this.text = text;
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    const synthesis = {
      getVoices() { return window.__speech.voices; },
      addEventListener(type, handler) { this.voiceChangedHandler = handler; },
      speak(value) { this.lastUtterance = value; window.__speech.spoken.push(value); },
      pause() {},
      resume() {},
      cancel() { window.__speech.cancels++; }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  });
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('demo-local');

  await expect(page.locator('#readAloudSpeed option')).toHaveText(['50%', '75%', '100%', '125%', '150%', '175%', '200%', '225%', '250%']);
  await expect(page.locator('#readAloudSpeed')).toHaveValue('1');
  await expect(page.locator('#readAloudVoice option')).toHaveCount(7);
  await page.evaluate(() => {
    window.__speech.voices = [
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Refreshed Voice', lang: 'en-US', localService: true },
      { name: 'Extra One', lang: 'en-US', localService: true },
      { name: 'Extra Two', lang: 'en-US', localService: true },
      { name: 'Extra Three', lang: 'en-US', localService: true },
      { name: 'Extra Four', lang: 'en-US', localService: true }
    ];
    window.speechSynthesis.voiceChangedHandler();
  });
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Automatic', 'Samantha', 'Daniel', 'Refreshed Voice', 'Extra One', 'Extra Two', 'Extra Three']);
  await page.locator('#readAloudVoice').selectOption('Samantha');
  await page.locator('#readAloudSpeed').selectOption('1.5');
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => ({ text: window.__speech.spoken[0].text, rate: window.__speech.spoken[0].rate, voice: window.__speech.spoken[0].voice.name }))).toEqual({
    text: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
    rate: 1.5,
    voice: 'Samantha'
  });

  const cancelsBeforeVerse = await page.evaluate(() => window.__speech.cancels);
  await page.locator('#readerContent [data-verse-speech="2"]').click();
  expect(await page.evaluate(() => ({
    utterance: window.__speech.spoken[1],
    cancels: window.__speech.cancels,
    storedSpeed: localStorage.getItem('god4.speech.speed'),
    storedVoice: localStorage.getItem('god4.speech.voice')
  }))).toEqual({
    utterance: expect.objectContaining({ text: 'He was with God in the beginning.' }),
    cancels: cancelsBeforeVerse + 1,
    storedSpeed: '1.5',
    storedVoice: 'Samantha'
  });
  expect(await page.evaluate(() => window.__speech.spoken[1].text)).not.toContain('Read aloud');
  await page.locator('#readAloudStop').click();
  await page.locator('#readAloudSpeed').selectOption('0.5');
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => window.__speech.spoken[2].rate)).toBe(0.5);
  await page.locator('#readAloudSpeed').selectOption('2.5');
  await page.locator('#readerContent [data-verse-speech="1"]').click();
  expect(await page.evaluate(() => window.__speech.spoken[3].rate)).toBe(2.5);
});

test('voice commands use the shared BibleSpeech engine', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('god4.translation', 'demo-local'));
  await page.addInitScript(() => {
    window.__speech = { spoken: [], pauses: 0, resumes: 0, cancels: 0 };
    const utterance = function(text) { this.text = text; };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    const synthesis = {
      speak(value) { this.lastUtterance = value; window.__speech.spoken.push(value); },
      pause() { window.__speech.pauses++; },
      resume() { window.__speech.resumes++; },
      cancel() { window.__speech.cancels++; }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  });
  await page.goto('/');
  await page.evaluate(() => handleVoiceCommand('read'));
  await page.evaluate(() => handleVoiceCommand('pause'));
  await page.evaluate(() => handleVoiceCommand('resume'));
  await page.evaluate(() => handleVoiceCommand('stop'));
  expect(await page.evaluate(() => window.__speech.spoken[0].text)).toContain('In the beginning was the Word');
  expect(await page.evaluate(() => ({ pauses: window.__speech.pauses, resumes: window.__speech.resumes, cancels: window.__speech.cancels }))).toEqual({ pauses: 1, resumes: 1, cancels: 3 });
});

test('reader controls, highlighting, fullscreen, compare, and plan views work', async ({ page }) => {
  await page.goto('/');
  const reader = page.locator('#view-reader');
  await expect(reader).toHaveClass(/active/);

  await page.locator('#bookSelect').selectOption('psalms');
  await expect(page.locator('#readerContent')).toContainText('Psalms 1');
  await page.locator('#chapterSelect').selectOption('2');
  await expect(page.locator('#readerContent')).toContainText('Psalms 2');
  await page.locator('.reader-controls-top').getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#readerContent')).toContainText('Psalms 3');
  await page.locator('.reader-controls-top').getByRole('button', { name: 'Previous' }).click();
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
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('1');
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid')).toContainText('In the beginning was the Word');

  await page.getByRole('button', { name: 'Plan' }).click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await expect(page.locator('#planDone')).toHaveText(/\d+ of 30 days/);

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(reader).toHaveClass(/active/);
});

test('Compare follows the Reader current passage and translation choices from BibleData', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');

  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await expect(page.locator('#compareSummary')).toContainText('Comparing John 3:16');
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid [data-compare-side]')).toHaveCount(2);
  await expect(page.locator('#compareGrid [data-compare-side="left"]')).toHaveAccessibleName('Left translation');
  await expect(page.locator('#compareGrid [data-compare-side="right"]')).toHaveAccessibleName('Right translation');

  const translations = await page.locator('#compareGrid [data-compare-side="left"]').locator('option').allTextContents();
  expect(translations.some((label) => label.startsWith('WEB'))).toBeTruthy();
  expect(translations.some((label) => label.startsWith('DEMO'))).toBeFalsy();
  const rightTranslations = await page.locator('#compareGrid [data-compare-side="right"]').locator('option').allTextContents();
  expect(rightTranslations.some((label) => label.startsWith('DEMO'))).toBeFalsy();

  const rightBefore = await page.locator('#compareGrid [data-compare-side="right"]').inputValue();
  await page.locator('#compareGrid [data-compare-side="left"]').selectOption('web');
  await expect(page.locator('#compareGrid [data-compare-side="right"]')).toHaveValue(rightBefore);

  await page.locator('#chapterSelect').selectOption('2');
  await expect(page.locator('#compareSummary')).toContainText('Comparing John 2');
  await expect(page.locator('#compareGrid .compare-col').first()).not.toContainText('Passage unavailable in this translation.');
});

test('Compare supports full chapters, specific verses, independent translations, and changing books', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid [data-compare-side]')).toHaveCount(2);
  await expect(page.locator('#compareGrid [data-compare-side="left"]')).toHaveAccessibleName('Left translation');
  await expect(page.locator('#compareGrid [data-compare-side="right"]')).toHaveAccessibleName('Right translation');

  await page.locator('#compareBook').selectOption('romans');
  await page.locator('#compareChapter').selectOption('8');
  await expect(page.locator('#compareVerse')).toHaveValue('');
  const chapterVerseCount = await page.evaluate(() => BibleData.getChapter('web', 'romans', 8).verses.length);
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveCount(chapterVerseCount);

  await page.locator('#compareVerse').selectOption('28');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Romans 8:28');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['28']);

  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['28']);
  const compareOptions = await page.locator('#compareGrid [data-compare-side] option').allTextContents();
  expect(compareOptions.some((label) => label.startsWith('DEMO'))).toBeFalsy();
  const rightBeforeSelection = await page.locator('#compareGrid [data-compare-side="right"]').inputValue();
  await page.locator('#compareGrid [data-compare-side="left"]').selectOption('web');
  await expect(page.locator('#compareGrid [data-compare-side="right"]')).toHaveValue(rightBeforeSelection);
  await page.locator('#compareBook').selectOption('colossians');
  await page.locator('#compareChapter').selectOption('2');
  await page.locator('#compareVerse').selectOption('1');
  await expect(page.locator('#compareGrid .compare-col').first()).not.toContainText('Passage unavailable in this translation.');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['1']);
  await expect(page.locator('#compareGrid .compare-col').nth(1)).not.toContainText('Passage unavailable in this translation.');
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['1']);
  expect(errors).toEqual([]);
});

test('Compare versions stack on smaller screens', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect.poll(() => page.locator('#compareGrid').evaluate((grid) => {
    return getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
  })).toBe(1);
});

test('Compare selector block keeps the reference above balanced centered controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  const layout = await page.locator('#view-compare').evaluate((view) => {
    const summary = document.getElementById('compareSummary');
    const row = view.querySelector('.compare-selector-row');
    const controls = [document.getElementById('compareBook'), document.getElementById('compareChapter'), document.getElementById('compareVerse')];
    const sizes = controls.map((control) => ({ width: control.getBoundingClientRect().width, height: control.getBoundingClientRect().height }));
    const rowTops = controls.map((control) => control.getBoundingClientRect().top);
    return {
      summaryBelowRow: summary.getBoundingClientRect().top > row.getBoundingClientRect().bottom,
      summaryAboveRow: summary.getBoundingClientRect().bottom < row.getBoundingClientRect().top,
      sizes,
      textAlignments: controls.map((control) => getComputedStyle(control).textAlign),
      gridColumns: getComputedStyle(row).gridTemplateColumns.split(/\s+/).length,
      sameRow: Math.max(...rowTops) - Math.min(...rowTops) < 1,
      arrowPairs: view.querySelectorAll('.compare-arrow-pair').length,
      oldButtons: view.querySelectorAll('#comparePrevious, #compareNext').length
    };
  });
  expect(layout.summaryAboveRow).toBeTruthy();
  expect(layout.summaryBelowRow).toBeFalsy();
  expect(layout.sizes[0]).toEqual(layout.sizes[1]);
  expect(layout.sizes[1]).toEqual(layout.sizes[2]);
  expect(layout.textAlignments).toEqual(['center', 'center', 'center']);
  expect(layout.gridColumns).toBe(3);
  expect(layout.sameRow).toBeTruthy();
  expect(layout.arrowPairs).toBe(2);
  expect(layout.oldButtons).toBe(0);
});

test('Compare edition count sits compactly beneath the Compare tab', async ({ page }) => {
  await page.goto('/');
  const compareButton = page.locator('.compare-tab-control > .bs-btn');
  const countControl = page.locator('.compare-tab-control .compare-edition-control');
  await expect(countControl).toBeVisible();
  const layout = await page.locator('.compare-tab-control').evaluate((wrapper) => {
    const button = wrapper.querySelector('.bs-btn').getBoundingClientRect();
    const control = wrapper.querySelector('.compare-edition-control').getBoundingClientRect();
    return { below: control.top >= button.bottom, centered: Math.abs((control.left + control.width / 2) - (button.left + button.width / 2)) < 1, height: control.height, inCompareView: Boolean(wrapper.closest('#view-compare')) };
  });
  await expect(compareButton).toHaveText('Compare');
  expect(layout.below).toBeTruthy();
  expect(layout.centered).toBeTruthy();
  expect(layout.height).toBeLessThan(30);
  expect(layout.inCompareView).toBeFalsy();
  await expect(countControl).toContainText('2');
  await expect(countControl).toContainText('3');
  await expect(countControl).toContainText('4');
});

test('Compare navigation advances verses and preserves both translations', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('1');
  await page.locator('#verseSelect').selectOption('1');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1:1');
  const left = page.locator('#compareGrid [data-compare-side="left"]');
  const right = page.locator('#compareGrid [data-compare-side="right"]');
  const leftTranslation = await left.inputValue();
  const rightTranslation = await right.inputValue();
  await page.locator('#compareVerseNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1:2');
  await expect(page.locator('#compareVerse')).toHaveValue('2');
  await expect(left).toHaveValue(leftTranslation);
  await expect(right).toHaveValue(rightTranslation);
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['2']);
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['2']);
});

test('Compare navigation crosses chapter and book boundaries in verse mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('1');
  const johnOneLastVerse = await page.evaluate(() => BibleData.getChapter('web', 'john', 1).verses.length);
  await page.locator('#compareVerse').selectOption(String(johnOneLastVerse));
  await page.locator('#compareVerseNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2:1');
  await page.locator('#compareBook').selectOption('genesis');
  await page.locator('#compareChapter').selectOption('50');
  const genesisLastVerse = await page.evaluate(() => BibleData.getChapter('web', 'genesis', 50).verses.length);
  await page.locator('#compareVerse').selectOption(String(genesisLastVerse));
  await page.locator('#compareVerseNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Exodus 1:1');
  await page.locator('#compareBook').selectOption('exodus');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('1');
  await page.locator('#compareVersePrevious').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Genesis 50:26');
});

test('Compare navigation moves whole chapters and disables at canonical endpoints', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('genesis');
  await page.locator('#compareChapter').selectOption('1');
  await expect(page.locator('#compareVerse')).toHaveValue('');
  await expect(page.locator('#compareChapterPrevious')).toBeDisabled();
  await expect(page.locator('#compareVersePrevious')).toBeDisabled();
  await expect(page.locator('#compareVerseNext')).toBeDisabled();
  await page.locator('#compareChapterNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Genesis 2');
  await expect(page.locator('#compareVerse')).toHaveValue('');
  await page.locator('#compareBook').selectOption('revelation');
  await page.locator('#compareChapter').selectOption('22');
  await expect(page.locator('#compareChapterNext')).toBeDisabled();
  await expect(page.locator('#compareVersePrevious')).toBeDisabled();
  await expect(page.locator('#compareVerseNext')).toBeDisabled();
  await page.locator('#compareVerse').selectOption('21');
  await expect(page.locator('#compareVerseNext')).toBeDisabled();
});

test('Compare switches between 2, 3, and 4 independently selected editions', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('god4.compare'));
  await page.reload();
  await page.getByRole('button', { name: 'Compare' }).click();
  const countControl = page.locator('.compare-edition-control');
  await expect(countControl).toBeVisible();
  await expect(countControl).toContainText('Compare:');
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);

  const selectors = () => page.locator('#compareGrid [data-compare-index]');
  const firstTwo = [await selectors().nth(0).inputValue(), await selectors().nth(1).inputValue()];
  expect(firstTwo[0]).not.toBe(firstTwo[1]);
  await countControl.locator('[data-compare-count="3"]').click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(3);
  expect(await selectors().nth(0).inputValue()).toBe(firstTwo[0]);
  expect(await selectors().nth(1).inputValue()).toBe(firstTwo[1]);
  await expect(selectors().nth(2)).toHaveValue(/.+/);

  await countControl.locator('[data-compare-count="4"]').click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(4);
  const values = await selectors().evaluateAll((items) => items.map((item) => item.value));
  expect(new Set(values).size).toBe(4);
  expect(values.every((value) => value !== 'demo-local')).toBeTruthy();

  await page.locator('#compareGrid [data-compare-index="0"]').selectOption('asv');
  await expect(page.locator('#compareGrid [data-compare-index="1"]')).not.toHaveValue('asv');
  await page.locator('#compareGrid [data-compare-index="3"]').selectOption('kjv');
  await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('asv');
  await expect(page.locator('#compareGrid [data-compare-index="3"]')).toHaveValue('kjv');

  await countControl.locator('[data-compare-count="2"]').click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await countControl.locator('[data-compare-count="4"]').click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(4);
  await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('asv');
  await expect(page.locator('#compareGrid [data-compare-index="3"]')).toHaveValue('kjv');
});

test('Compare edition count and translation slots persist with the shared reference', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('god4.compare'));
  await page.reload();
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('.compare-edition-control [data-compare-count="3"]').click();
  await page.locator('#compareGrid [data-compare-index="2"]').selectOption('kjv');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3:16');
  await expect(page.locator('#compareGrid .compare-col .vnum')).toHaveCount(3);
  await page.reload();
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('.compare-edition-control [data-compare-count="3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(3);
  await expect(page.locator('#compareGrid [data-compare-index="2"]')).toHaveValue('kjv');
  await page.getByRole('button', { name: 'Reader' }).click();
  await page.locator('#bookSelect').selectOption('john');
  await page.locator('#chapterSelect').selectOption('3');
  await page.locator('#verseSelect').selectOption('16');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3:16');
  await page.locator('#compareChapterNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 4:16');
  await expect(page.locator('#compareGrid .compare-col .vnum')).toHaveText(['16', '16', '16']);
});

test('Compare Chapter arrows preserve verse mode forward and backward', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('3');
  await page.locator('#compareChapterNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2:3');
  await expect(page.locator('#compareVerse')).toHaveValue('3');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['3']);
  await page.locator('#compareChapterPrevious').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1:3');
  await expect(page.locator('#compareVerse')).toHaveValue('3');
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['3']);
});

test('Compare Chapter arrows clamp verse mode in shorter destination chapters', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('matthew');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('25');
  await page.locator('#compareChapterNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Matthew 2:23');
  await expect(page.locator('#compareVerse')).toHaveValue('23');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['23']);
});

test('Compare Chapter arrows keep explicitly selected Whole chapter mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('');
  await page.locator('#compareChapterNext').click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2');
  await expect(page.locator('#compareVerse')).toHaveValue('');
  await expect(page.locator('#compareVerseNext')).toBeDisabled();
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveCount(await page.evaluate(() => BibleData.getChapter('web', 'john', 2).verses.length));
});

test('Compare Chapter dropdown preserves verse mode and synchronized panels', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('3');
  await page.locator('#compareChapter').selectOption('2');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2:3');
  await expect(page.locator('#compareVerse')).toHaveValue('3');
  await expect(page.locator('#compareGrid .compare-col .vnum')).toHaveText(['3', '3']);
});

test('Compare Chapter dropdown clamps a preserved verse in a shorter chapter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('matthew');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('25');
  await page.locator('#compareChapter').selectOption('2');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Matthew 2:23');
  await expect(page.locator('#compareVerse')).toHaveValue('23');
});

test('Compare Chapter dropdown preserves Whole chapter mode when explicitly selected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('1');
  await page.locator('#compareVerse').selectOption('');
  await page.locator('#compareChapter').selectOption('2');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2');
  await expect(page.locator('#compareVerse')).toHaveValue('');
  await expect(page.locator('#compareVerseNext')).toBeDisabled();
});

test('Compare Book dropdown preserves chapter and verse mode across panels', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('3');
  await page.locator('#compareVerse').selectOption('16');
  await page.locator('#compareBook').selectOption('luke');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Luke 3:16');
  await expect(page.locator('#compareChapter')).toHaveValue('3');
  await expect(page.locator('#compareVerse')).toHaveValue('16');
  await expect(page.locator('#compareGrid .compare-col .vnum')).toHaveText(['16', '16']);
});

test('Compare Book dropdown clamps chapter and verse for a shorter destination', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('21');
  const johnLastVerse = await page.evaluate(() => BibleData.getChapter('web', 'john', 21).verses.length);
  await page.locator('#compareVerse').selectOption(String(johnLastVerse));
  await page.locator('#compareBook').selectOption('philemon');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Philemon 1:25');
  await expect(page.locator('#compareChapter')).toHaveValue('1');
  await expect(page.locator('#compareVerse')).toHaveValue('25');
  await page.locator('#compareBook').selectOption('genesis');
  await page.locator('#compareChapter').selectOption('50');
  await page.locator('#compareVerse').selectOption('26');
  await page.locator('#compareBook').selectOption('philemon');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Philemon 1:25');
});

test('Compare Book dropdown preserves explicitly selected Whole chapter mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareBook').selectOption('john');
  await page.locator('#compareChapter').selectOption('3');
  await page.locator('#compareVerse').selectOption('');
  await page.locator('#compareBook').selectOption('luke');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Luke 3');
  await expect(page.locator('#compareVerse')).toHaveValue('');
  await expect(page.locator('#compareVerseNext')).toBeDisabled();
});

test('Compare panels use only their translation dropdown for identity', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid .compare-col .compare-translation-meta')).toHaveCount(0);
  await expect(page.locator('#compareGrid [data-compare-index]')).toHaveCount(2);
});

test('top and bottom Reader controls stay synchronized', async ({ page }) => {
  await page.goto('/');
  const topControls = page.locator('.reader-controls-top');
  await expect(page.locator('[data-reader-controls]')).toHaveCount(1);
  await expect(topControls.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await topControls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#readerContent')).toContainText('John 2');
  await expect(topControls.getByRole('button', { name: 'Previous' })).toBeEnabled();

  await page.evaluate(() => {
    window.SpeechRecognition = function FakeRecognition() {};
    window.SpeechRecognition.prototype.start = function() {};
    window.SpeechRecognition.prototype.stop = function() {};
  });
  const voiceButton = page.locator('.reader-audio-controls [data-voice-command-button]');
  await voiceButton.click();
  await expect(voiceButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#voiceStatusTop')).toHaveText('Listening for a command...');
  await expect(page.locator('.voice-status')).toHaveCount(1);
});

test('blocked microphone access is reported without breaking the Reader', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    function FakeRecognition() { window.fakeRecognition = this; }
    FakeRecognition.prototype.start = function() {};
    FakeRecognition.prototype.stop = function() {};
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
  });
  await page.locator('.reader-audio-controls [data-voice-command-button]').click();
  await page.evaluate(() => window.eval("voiceRecognition.onerror({ error: 'not-allowed' })"));
  await expect(page.locator('#voiceStatusTop')).toHaveText('Microphone access is blocked. Allow microphone access in your browser to use Voice Commands.');
  await page.locator('#bookSelect').selectOption('psalms');
  await expect(page.locator('#readerContent')).toContainText('Psalms 1');
});

test('Voice Commands reports clear recognition errors and handles intentional stops', async ({ page }) => {
  await page.addInitScript(() => {
    window.__recognition = { starts: 0, stops: 0 };
    function FakeRecognition() { window.fakeRecognition = this; }
    FakeRecognition.prototype.start = function() { window.__recognition.starts++; };
    FakeRecognition.prototype.stop = function() { window.__recognition.stops++; };
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
  });
  await page.goto('/');
  const button = page.locator('.reader-audio-controls [data-voice-command-button]');
  const status = page.locator('#voiceStatusTop');

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(status).toHaveText('Listening for a command...');
  await button.click();
  expect(await page.evaluate(() => window.__recognition.starts)).toBe(1);
  await page.evaluate(() => window.fakeRecognition.onerror({ error: 'aborted' }));
  await page.evaluate(() => window.fakeRecognition.onend());
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(status).toHaveText('Ready for a voice command.');

  const expectedMessages = {
    'not-allowed': 'Microphone access is blocked. Allow microphone access in your browser to use Voice Commands.',
    'service-not-allowed': 'Voice recognition is blocked by the browser or operating system.',
    'audio-capture': 'No microphone was detected. Check your microphone and try again.',
    'no-speech': 'No speech was detected. Try again.',
    'network': 'Voice recognition could not connect. Check your internet connection or try again.'
  };
  for (const [error, message] of Object.entries(expectedMessages)) {
    await button.click();
    await page.evaluate((value) => window.fakeRecognition.onerror({ error: value }), error);
    await expect(status).toHaveText(message);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  }

  await button.click();
  await page.evaluate(() => window.fakeRecognition.onerror({ error: 'unexpected-error' }));
  await expect(status).toHaveText('Voice command error: unexpected-error');
});

test('Voice Commands stays available independently from Read Aloud when recognition is unsupported', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
    window.__speech = { spoken: [] };
    const utterance = function(text) { this.text = text; };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(value) { window.__speech.spoken.push(value.text); },
      cancel() {},
      pause() {},
      resume() {}
    } });
  });
  await page.goto('/');
  await page.locator('.reader-audio-controls [data-voice-command-button]').click();
  await expect(page.locator('#voiceStatusTop')).toHaveText('Voice commands are not supported in this browser. Read Aloud is still available.');
  await expect(page.locator('#readAloudPlay')).toBeEnabled();
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__speech.spoken.length)).toBeGreaterThan(0);
});

test('Voice Commands handles safe chapter aliases and recognition end', async ({ page }) => {
  await page.addInitScript(() => {
    function FakeRecognition() { window.fakeRecognition = this; }
    FakeRecognition.prototype.start = function() {};
    FakeRecognition.prototype.stop = function() {};
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
  });
  await page.goto('/');
  await page.evaluate(() => handleVoiceCommand('next'));
  await expect(page.locator('#readerContent')).toContainText('John 2');
  await page.evaluate(() => handleVoiceCommand('go to previous chapter'));
  await expect(page.locator('#readerContent')).toContainText('John 1');
  const button = page.locator('.reader-audio-controls [data-voice-command-button]');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => toggleVoiceCommands());
  await page.evaluate(() => window.fakeRecognition.onend());
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('Voice Commands waits through an early end event and accepts one final result', async ({ page }) => {
  await page.addInitScript(() => {
    window.__recognition = { starts: 0, stops: 0 };
    function FakeRecognition() { window.fakeRecognition = this; }
    FakeRecognition.prototype.start = function() { window.__recognition.starts++; };
    FakeRecognition.prototype.stop = function() { window.__recognition.stops++; };
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak() {}, cancel() {}, pause() {}, resume() {}
    } });
  });
  await page.goto('/');
  const button = page.locator('.reader-audio-controls [data-voice-command-button]');
  const status = page.locator('#voiceStatusTop');
  await button.click();
  await expect(status).toHaveText('Listening for a command...');
  await page.evaluate(() => window.fakeRecognition.onend());
  await page.waitForTimeout(100);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(status).toHaveText('Listening for a command...');
  await page.evaluate(() => toggleVoiceCommands());
  await page.evaluate(() => window.fakeRecognition.onend());
  expect(await page.evaluate(() => window.__recognition.starts)).toBe(1);

  await button.click();
  await page.evaluate(() => window.fakeRecognition.onresult({ results: [Object.assign([{ transcript: 'read' }], { isFinal: true })] }));
  await expect(status).toHaveText('Command recognized: read');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1300);
  await expect(status).toHaveText('Ready for a voice command.');
});

test('speech voice labels shorten Microsoft display names but retain full voice objects', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [] };
    const availableVoices = [
      { name: 'Microsoft Mark', lang: 'en-US', localService: true },
      { name: 'Microsoft Zira', lang: 'en-US', localService: true },
      { name: 'Microsoft David', lang: 'en-US', localService: true }
    ];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices() { return availableVoices; },
      speak(utterance) { window.__speech.spoken.push(utterance); },
      cancel() {}, pause() {}, resume() {}, addEventListener() {}
    } });
  });
  await page.goto('/');
  expect(await page.locator('#readAloudVoice option').allTextContents()).toEqual(expect.arrayContaining(['Automatic', 'Mark', 'Zira', 'David']));
  await page.locator('#readAloudVoice').selectOption({ label: 'Mark' });
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => window.__speech.spoken[0].voice.name)).toBe('Microsoft Mark');
});

test('spoken book commands navigate deterministically and only play when requested', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [] };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) { window.__speech.spoken.push(utterance.text); },
      cancel() {}, pause() {}, resume() {}
    } });
  });
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  await page.evaluate(() => handleVoiceCommand('play Matthew'));
  await expect(page.locator('#readerContent')).toContainText('Matthew 1');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBeGreaterThan(0);

  await page.locator('#readAloudStop').click();
  await page.evaluate(() => handleVoiceCommand('read John 3'));
  await expect(page.locator('#readerContent')).toContainText('John 3');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBeGreaterThan(1);

  await page.locator('#readAloudStop').click();
  const speechCountBeforeOpen = await page.evaluate(() => window.__speech.spoken.length);
  await page.evaluate(() => handleVoiceCommand('open Genesis 1'));
  await expect(page.locator('#readerContent')).toContainText('Genesis 1');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(speechCountBeforeOpen);

  await page.evaluate(() => handleVoiceCommand('go to Romans 8'));
  await expect(page.locator('#readerContent')).toContainText('Romans 8');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(speechCountBeforeOpen);

  await page.evaluate(() => handleVoiceCommand('open NotABook'));
  await expect(page.locator('#voiceStatusTop')).toHaveText('Book, chapter, or verse not found.');
});

test('natural chapter and verse references navigate and focus data-backed verses', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [] };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) { window.__speech.spoken.push(utterance.text); },
      cancel() {}, pause() {}, resume() {}
    } });
  });
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');

  await page.evaluate(() => handleVoiceCommand('John 3:16'));
  await expect(page.locator('#readerContent')).toContainText('John 3');
  await expect(page.locator('#chapterSelect')).toHaveValue('3');
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toHaveClass(/verse-focused/);
  await expect(page.locator('#verseSelect')).toHaveValue('16');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);

  await page.evaluate(() => handleVoiceCommand('John 3 verse 16'));
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toHaveClass(/verse-focused/);

  await page.evaluate(() => handleVoiceCommand('Read John 3:16'));
  await expect(page.locator('#readerContent')).toContainText('John 3');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(1);
  expect(await page.evaluate(() => window.__speech.spoken[0])).toBe(await page.evaluate(() => BibleData.getVerse('web', 'john', 3, 16).text));

  await page.evaluate(() => handleVoiceCommand('Open Genesis 1'));
  await expect(page.locator('#readerContent')).toContainText('Genesis 1');
  await expect(page.locator('#verseSelect option')).toHaveCount(32);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(1);

  await page.evaluate(() => handleVoiceCommand('Go to Romans 8 verse 28'));
  await expect(page.locator('#readerContent')).toContainText('Romans 8');
  await expect(page.locator('#readerContent [data-verse-number="28"]')).toHaveClass(/verse-focused/);
});

test('natural chapter words work for navigation and Read commands', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [] };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) { window.__speech.spoken.push(utterance.text); },
      cancel() {}, pause() {}, resume() {}
    } });
  });
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');

  await page.evaluate(() => handleVoiceCommand('Colossians chapter 2 verse 1'));
  await expect(page.locator('#bookSelect')).toHaveValue('colossians');
  await expect(page.locator('#chapterSelect')).toHaveValue('2');
  await expect(page.locator('#verseSelect')).toHaveValue('1');
  await expect(page.locator('#readerContent')).toContainText('Colossians 2');
  await expect(page.locator('#readerContent [data-verse-number="1"]')).toHaveClass(/verse-focused/);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);

  await page.evaluate(() => handleVoiceCommand('Colossians chapter 2'));
  await expect(page.locator('#chapterSelect')).toHaveValue('2');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);

  await page.evaluate(() => handleVoiceCommand('John chapter 3 verse 16'));
  await expect(page.locator('#bookSelect')).toHaveValue('john');
  await expect(page.locator('#chapterSelect')).toHaveValue('3');
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toHaveClass(/verse-focused/);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);

  await page.evaluate(() => handleVoiceCommand('1 Corinthians chapter 13 verse 4'));
  await expect(page.locator('#bookSelect')).toHaveValue('1-corinthians');
  await expect(page.locator('#chapterSelect')).toHaveValue('13');
  await expect(page.locator('#readerContent [data-verse-number="4"]')).toHaveClass(/verse-focused/);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);

  await page.evaluate(() => handleVoiceCommand('Read Colossians chapter 2 verse 1'));
  await expect(page.locator('#readerContent')).toContainText('Colossians 2');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(1);
  expect(await page.evaluate(() => window.__speech.spoken[0])).toBe(await page.evaluate(() => BibleData.getVerse('web', 'colossians', 2, 1).text));
});

test('ordinal Bible book names normalize to numbered metadata books', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [] };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) { window.__speech.spoken.push(utterance.text); },
      cancel() {}, pause() {}, resume() {}
    } });
  });
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');

  await page.evaluate(() => handleVoiceCommand('First Corinthians chapter 13 verse 4'));
  await expect(page.locator('#bookSelect')).toHaveValue('1-corinthians');
  await expect(page.locator('#chapterSelect')).toHaveValue('13');
  await expect(page.locator('#verseSelect')).toHaveValue('4');
  await expect(page.locator('#readerContent [data-verse-number="4"]')).toHaveClass(/verse-focused/);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);

  await page.evaluate(() => handleVoiceCommand('1 Corinthians chapter 13 verse 4'));
  await expect(page.locator('#bookSelect')).toHaveValue('1-corinthians');
  await expect(page.locator('#readerContent [data-verse-number="4"]')).toHaveClass(/verse-focused/);

  await page.evaluate(() => handleVoiceCommand('Read First Corinthians chapter 13 verse 4'));
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(1);
  expect(await page.evaluate(() => window.__speech.spoken[0])).toBe(await page.evaluate(() => BibleData.getVerse('web', '1-corinthians', 13, 4).text));

  await page.locator('#readAloudStop').click();
  await page.evaluate(() => handleVoiceCommand('Play Second Samuel chapter 3'));
  await expect(page.locator('#bookSelect')).toHaveValue('2-samuel');
  await expect(page.locator('#chapterSelect')).toHaveValue('3');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(2);

  await page.locator('#readAloudStop').click();
  await page.evaluate(() => handleVoiceCommand('Open First John chapter 4 verse 8'));
  await expect(page.locator('#bookSelect')).toHaveValue('1-john');
  await expect(page.locator('#chapterSelect')).toHaveValue('4');
  await expect(page.locator('#readerContent [data-verse-number="8"]')).toHaveClass(/verse-focused/);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(2);

  await page.evaluate(() => handleVoiceCommand('Go to Third John chapter 1 verse 2'));
  await expect(page.locator('#bookSelect')).toHaveValue('3-john');
  await expect(page.locator('#chapterSelect')).toHaveValue('1');
  await expect(page.locator('#readerContent [data-verse-number="2"]')).toHaveClass(/verse-focused/);
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(2);
});

test('manual verse selector updates with the chapter and focuses the selected verse', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('demo-local');
  await page.locator('#bookSelect').selectOption('genesis');
  await page.locator('#chapterSelect').selectOption('1');

  const chapterOneVerseOptionCount = await page.evaluate(() =>
    BibleData.getChapter('demo-local', 'genesis', 1).verses.length + 1
  );
  await expect(page.locator('#verseSelect option')).toHaveCount(chapterOneVerseOptionCount);

  await page.locator('#verseSelect').selectOption('2');
  await expect(page.locator('#readerContent [data-verse-number="2"]')).toHaveClass(/verse-focused/);

  await page.locator('#chapterSelect').selectOption('2');
  await expect(page.locator('#verseSelect')).toHaveValue('');

  const chapterTwoVerseOptionCount = await page.evaluate(() =>
    BibleData.getChapter('demo-local', 'genesis', 2).verses.length + 1
  );
  await expect(page.locator('#verseSelect option')).toHaveCount(chapterTwoVerseOptionCount);
});

test('numbered Bible book references resolve from BibleData metadata', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  await page.evaluate(() => handleVoiceCommand('Open 1 Samuel 1'));
  await expect(page.locator('#bookSelect')).toHaveValue('1-samuel');
  await expect(page.locator('#readerContent')).toContainText('1 Samuel 1');
});

test('invalid chapter and verse references report a concise status', async ({ page }) => {
  await page.goto('/');
  await page.locator('#readerTranslation').selectOption('web');
  await page.evaluate(() => handleVoiceCommand('John 999'));
  await expect(page.locator('#voiceStatusTop')).toHaveText('Book, chapter, or verse not found.');
  await page.evaluate(() => handleVoiceCommand('John 3:999'));
  await expect(page.locator('#voiceStatusTop')).toHaveText('Book, chapter, or verse not found.');
});

test('recognized navigation commands execute Reader actions through the recognition callback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [] };
    function FakeRecognition() { window.fakeRecognition = this; }
    FakeRecognition.prototype.start = function() {};
    FakeRecognition.prototype.stop = function() {};
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function(text) { this.text = text; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(utterance) { window.__speech.spoken.push(utterance.text); },
      cancel() {}, pause() {}, resume() {}
    } });
  });
  await page.goto('/');
  const voiceButton = page.locator('.reader-audio-controls [data-voice-command-button]');
  const recognize = async (transcript) => {
    await voiceButton.click();
    await page.evaluate((value) => window.fakeRecognition.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: value }], { isFinal: true })]
    }), transcript);
  };

  await recognize('Next chapter');
  await expect(page.locator('#bookSelect')).toHaveValue('john');
  await expect(page.locator('#chapterSelect')).toHaveValue('2');
  await expect(page.locator('#readerContent')).toContainText('John 2');
  await expect(page.locator('#voiceStatusTop')).toHaveText('Command recognized: Next chapter');

  await recognize('previous');
  await expect(page.locator('#chapterSelect')).toHaveValue('1');
  await expect(page.locator('#readerContent')).toContainText('John 1');

  await page.locator('#readerTranslation').selectOption('web');
  await recognize('read John 3');
  await expect(page.locator('#bookSelect')).toHaveValue('john');
  await expect(page.locator('#chapterSelect')).toHaveValue('3');
  await expect(page.locator('#readerContent')).toContainText('John 3');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBeGreaterThan(0);

  await page.locator('#readAloudStop').click();
  const speechCountBeforeOpen = await page.evaluate(() => window.__speech.spoken.length);
  await recognize('open Genesis 1');
  await expect(page.locator('#bookSelect')).toHaveValue('genesis');
  await expect(page.locator('#chapterSelect')).toHaveValue('1');
  await expect(page.locator('#readerContent')).toContainText('Genesis 1');
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(speechCountBeforeOpen);
});

test('Reader exposes one unified chapter audio control group', async ({ page }) => {
  await page.goto('/');
  const reader = page.locator('#view-reader');
  await expect(reader.getByRole('button', { name: 'Play', exact: true })).toHaveCount(1);
  await expect(reader.getByRole('button', { name: 'Pause reading aloud', exact: true })).toHaveCount(1);
  await expect(reader.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(1);
  await expect(reader.getByRole('button', { name: 'Voice Commands', exact: true })).toHaveCount(1);
  await expect(reader.locator('#readAloudVoice')).toBeVisible();
  await expect(reader.locator('#readAloudSpeed')).toBeVisible();
});

test('Reader keeps one navigation group and one voice status through repeated navigation', async ({ page }) => {
  await page.goto('/');
  for (let index = 0; index < 3; index++) {
    await page.evaluate(() => handleVoiceCommand('next chapter'));
    await page.evaluate(() => handleVoiceCommand('previous chapter'));
  }
  await expect(page.locator('[data-reader-controls]')).toHaveCount(1);
  await expect(page.locator('.voice-status')).toHaveCount(1);
  await expect(page.locator('.reader-audio-controls')).toHaveCount(1);
  await expect(page.locator('#readerContent')).toContainText('John 1');
});

test('unified Reader audio controls fit the narrow viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/');
  const reader = page.locator('#view-reader');
  await expect(reader.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Pause reading aloud', exact: true })).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Voice Commands', exact: true })).toBeVisible();
  await expect(reader.locator('#readAloudVoice')).toBeVisible();
  await expect(reader.locator('#readAloudSpeed')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
});
